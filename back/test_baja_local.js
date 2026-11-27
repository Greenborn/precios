/**
 * Test: DELETE /api/mis-locales/:id borra el local con sus precios y limpia las caches.
 *
 * Cubre:
 * - Solo el dueño puede eliminarlo (403/404 sin cambios).
 * - Si falla la transaccion no cambia nada (base, caches ni fotos).
 * - Se borran las filas del local (price_today con FK RESTRICT, price, precios_negocio,
 *   promociones_hoy, estadistica_aumento_diario, branch_category, articulo_fotos) y sus
 *   archivos de foto; `promociones` se conserva.
 * - Buscador, precios_diccio, cache por categoria, diccionarios de comercios y marca de negocio.
 * - Otros locales (del mismo dueño y ajenos) sin cambios.
 *
 * Usa el router, el repositorio, el buscador y las caches reales. Las consultas se generan con
 * knex (dialecto mysql2) y se ejecutan en SQLite en memoria (node:sqlite, Node >= 22.13).
 * Las fotos se crean en un directorio temporal. No requiere base de datos.
 *
 * Uso: node back/test_baja_local.js
 * Sale con codigo distinto de cero si algun caso falla.
 */

const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const express = require('express')
const { DatabaseSync } = require('node:sqlite')
const Knex = require('knex')
const ClienteMysql = require('knex/lib/dialects/mysql2')

// ---------- knex sobre SQLite en memoria ----------
const db = new DatabaseSync(':memory:')
let fallar_en = null // expresion: la sentencia que coincida falla
class ClienteMemoria extends ClienteMysql {
    _driver() { return {} }
    async acquireRawConnection() { return {} }
    async destroyRawConnection() {}
    validateConnection() { return true }
    async _query(conexion, obj) {
        if (fallar_en?.test(obj.sql)) throw new Error('fallo simulado')
        const args = (obj.bindings || []).map((v) => (v instanceof Date ? v.toISOString() : typeof v === 'boolean' ? Number(v) : v))
        const sentencia = db.prepare(obj.sql)
        obj.response = /^\s*select/i.test(obj.sql)
            ? [sentencia.all(...args).map((f) => ({ ...f })), []]
            : [{ affectedRows: Number(sentencia.run(...args).changes) }, []]
        return obj
    }
}
global.knex = Knex({ client: ClienteMemoria, connection: {}, pool: { min: 0, max: 1 } })

// ---------- modulos simulados ----------
function simular(ruta, exports) {
    const archivo = require.resolve(ruta)
    require.cache[archivo] = { id: archivo, filename: archivo, loaded: true, exports }
}
const DUENO = 7
const OTRO = 8
let sesion_usuario = DUENO
simular('./sso', { requirePermission: () => (req, res, next) => next() })
simular('./middleware/SesionUsuario', (req, res, next) => {
    req.user = { id: sesion_usuario }
    req.session = { u_data: { id: sesion_usuario, es_negocio: true } }
    next()
})
// El test nunca toca los archivos subidos reales
const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'test-baja-local-'))
const cfg = require('./config/negocio')
cfg.FOTOS_DIR = temporal
cfg.PERFIL_IMG_DIR = path.join(temporal, 'perfiles')

const buscador = require('./controllers/busqueda_productos')
const sync_cache = require('./controllers/sync_cache')
const precios_negocio = require('./controllers/precios_negocio')

const PRECIO = `product_id TEXT, price REAL, date_time TEXT, time TEXT, es_oferta INTEGER, confiabilidad INTEGER,
  notas TEXT, url TEXT, user_id INTEGER, user_nombre TEXT, user_apellido TEXT`
const OTRAS = ['promociones', 'promociones_hoy', 'estadistica_aumento_diario', 'branch_category']
db.exec(`
CREATE TABLE enterprice (id INTEGER PRIMARY KEY);
CREATE TABLE branch (id INTEGER PRIMARY KEY, propietario_id INTEGER, enterprise_id INTEGER);
CREATE TABLE price (id TEXT PRIMARY KEY, branch_id INTEGER, ${PRECIO});
CREATE TABLE price_today (id TEXT PRIMARY KEY, branch_id INTEGER REFERENCES branch(id), ${PRECIO}, price_id TEXT, product_name TEXT);
CREATE TABLE precios_negocio (id TEXT PRIMARY KEY, usuario_id INTEGER, product_id TEXT, branch_id INTEGER, price REAL);
CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT);
CREATE TABLE product_category (product_id TEXT, category_id INTEGER);
CREATE TABLE articulo_fotos (branch_id INTEGER, product_id TEXT, archivo TEXT);
${OTRAS.map((t) => `CREATE TABLE ${t} (branch_id INTEGER);`).join('\n')}
`)

const BAJA = 1     // local que se elimina
const MISMO = 11   // otro local del dueño (su id empieza igual que BAJA)
const AJENO = 2
const LOCALES = [
    { id: BAJA, propietario_id: DUENO, enterprise_id: 100 },
    { id: MISMO, propietario_id: DUENO, enterprise_id: 110 },
    { id: AJENO, propietario_id: OTRO, enterprise_id: 200 },
]
const TABLAS_BORRADAS = ['price_today', 'price', 'precios_negocio', 'articulo_fotos', 'promociones_hoy', 'estadistica_aumento_diario', 'branch_category']

async function preparar() {
    await global.knex('enterprice').insert(LOCALES.map((l) => ({ id: l.enterprise_id })))
    await global.knex('branch').insert(LOCALES)
    await precios_negocio.cargar_ids(global.knex)
    global.branchs_diccio = Object.fromEntries(LOCALES.map((l) => [l.id, l]))
    global.enterprice_diccio = Object.fromEntries(LOCALES.map((l) => [l.enterprise_id, { id: l.enterprise_id }]))
    global.branch_enterprice_diccio = Object.fromEntries(LOCALES.map((l) => [l.enterprise_id, [l]]))
    global.precios_diccio = {}
    global.products_category_diccio = { by_product_id: {}, by_category_id: {} }
    await global.knex('products').insert({ id: 'p', name: 'Arroz' })
    await global.knex('product_category').insert({ product_id: 'p', category_id: 5 })

    for (const { id, propietario_id } of LOCALES) {
        const base = { product_id: 'p', branch_id: id, price: id * 10, date_time: new Date().toISOString(), user_id: propietario_id }
        const hoy = { ...base, id: `hoy-${id}`, price_id: `n-${id}`, product_name: 'Arroz' }
        await global.knex('price').insert([
            { ...base, id: `n-${id}` },
            // Historico cargado por un tercero en el mismo local
            { ...base, id: `v-${id}`, date_time: '2020-01-01T00:00:00.000Z', user_id: OTRO },
        ])
        await global.knex('price_today').insert(hoy)
        await global.knex('precios_negocio').insert({ id: `n-${id}`, usuario_id: propietario_id, product_id: 'p', branch_id: id, price: id * 10 })
        await global.knex('articulo_fotos').insert({ branch_id: id, product_id: 'p', archivo: `${id}_p.jpg` })
        fs.writeFileSync(path.join(temporal, `${id}_p.jpg`), 'x')
        for (const t of OTRAS) await global.knex(t).insert({ branch_id: id })
        buscador.agregar_a_buscador(hoy)
        await sync_cache.actualizar_precio(hoy)
    }
}

async function filas_por_local(tabla) {
    return (await global.knex(tabla).select('branch_id')).map((f) => f.branch_id).sort((a, b) => a - b)
}

async function estado() {
    const base = {}
    for (const t of [...TABLAS_BORRADAS, 'promociones']) base[t] = await filas_por_local(t)
    base.branch = (await global.knex('branch').select('id').orderBy('id')).map((f) => f.id)
    base.enterprice = (await global.knex('enterprice').select('id').orderBy('id')).map((f) => f.id)
    const locales = (arr) => [...new Set((arr || []).map((r) => Number(r.branch_id)))].sort((a, b) => a - b)
    return {
        base,
        buscador: locales(buscador.busqueda_ranking('arroz')),
        precios: locales(global.precios_diccio.p),
        categoria: locales(global.products_category_diccio.by_category_id[5]),
        sucursales: Object.keys(global.branchs_diccio).map(Number),
        comercios: Object.keys(global.enterprice_diccio).map(Number),
        listas: Object.keys(global.branch_enterprice_diccio).map(Number),
        negocios: LOCALES.map((l) => l.id).filter((id) => precios_negocio.es_negocio(id)),
        fotos: fs.readdirSync(temporal).sort(),
    }
}

let fallos = 0
async function caso(nombre, fn) {
    try {
        await fn()
        console.log(`OK    ${nombre}`)
    } catch (e) {
        fallos++
        console.log(`FAIL  ${nombre}`)
        console.log(`      ${String(e.message).split('\n').join('\n      ')}`)
    }
}

;(async () => {
    const log = console.log
    console.log = (...a) => { if (!String(a[0]).startsWith('[busqueda_productos]')) log(...a) }

    await preparar()
    const app = express()
    app.use(express.json())
    app.use('/api', require('./routes/negocio'))
    const servidor = app.listen(0)
    const borrar = async (id) => (await fetch(`http://127.0.0.1:${servidor.address().port}/api/mis-locales/${id}`, { method: 'DELETE' })).status
    const inicial = await estado()

    await caso('un usuario que no es el dueño recibe 403 y nada cambia', async () => {
        sesion_usuario = OTRO
        assert.strictEqual(await borrar(BAJA), 403)
        sesion_usuario = DUENO
        assert.strictEqual(await borrar(AJENO), 403)
        assert.strictEqual(await borrar(999), 404)
        assert.deepStrictEqual(await estado(), inicial)
    })

    await caso('una transaccion fallida no cambia base, caches ni fotos', async () => {
        const error = console.error
        console.error = () => {}
        fallar_en = /^delete from `branch` /
        try {
            assert.strictEqual(await borrar(BAJA), 500)
        } finally {
            fallar_en = null
            console.error = error
        }
        assert.deepStrictEqual(await estado(), inicial)
    })

    await caso('el dueño elimina el local con price_today (FK RESTRICT)', async () => {
        assert.strictEqual(await borrar(BAJA), 204)
    })

    const final = await estado()
    const quedan = [AJENO, MISMO] // en orden numerico
    await caso('base: solo se borra lo del local eliminado; promociones se conserva', async () => {
        for (const t of TABLAS_BORRADAS) {
            assert.deepStrictEqual(final.base[t], inicial.base[t].filter((id) => id !== BAJA), t)
        }
        assert.deepStrictEqual(final.base.promociones, inicial.base.promociones)
        assert.deepStrictEqual(final.base.branch, quedan)
        assert.deepStrictEqual(final.base.enterprice, [110, 200])
    })

    await caso('buscador y caches de precios', async () => {
        assert.deepStrictEqual([final.buscador, final.precios, final.categoria], [quedan, quedan, quedan])
    })

    await caso('diccionarios de comercios y marca de negocio', async () => {
        assert.deepStrictEqual(final.sucursales, quedan)
        assert.deepStrictEqual(final.comercios, [110, 200])
        assert.deepStrictEqual(final.listas, [110, 200])
        assert.deepStrictEqual(final.negocios, [MISMO, AJENO])
    })

    await caso('fotos: solo se borran las del local eliminado', async () => {
        assert.deepStrictEqual(final.fotos, ['11_p.jpg', '2_p.jpg'])
    })

    servidor.close()
    await global.knex.destroy()
    fs.rmSync(temporal, { recursive: true, force: true })
    console.log(fallos ? `\n${fallos} caso(s) con fallos` : '\nTodos los casos OK')
    process.exit(fallos ? 1 : 0)
})()
