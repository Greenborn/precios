/**
 * Test: DELETE /api/negocio/mi-cuenta/datos mantiene price_today, buscador y caches en memoria.
 *
 * Cubre:
 * - Precios en locales propios: desaparecen de price_today, buscador, caches y diccionarios
 *   de sucursales/comercios, y los locales salen del conjunto de negocios.
 * - Precios del usuario en un negocio ajeno: queda el ultimo de `price`, sin ventana.
 * - Precios del usuario en un local comun: queda el anterior solo si es de hoy o ayer.
 * - Precios y locales de terceros sin cambios.
 *
 * Usa el router, el buscador y las caches reales. Las consultas se generan con knex
 * (dialecto mysql2) y se ejecutan en una base SQLite en memoria (node:sqlite, Node >= 22.13).
 * La sesion y sso estan simulados. No requiere base de datos.
 *
 * Uso: node back/test_baja_datos_cuenta.js
 * Sale con codigo distinto de cero si algun caso falla.
 */

const assert = require('assert')
const path = require('path')
const express = require('express')
const { DatabaseSync } = require('node:sqlite')
const Knex = require('knex')
const ClienteMysql = require('knex/lib/dialects/mysql2')

// ---------- knex sobre SQLite en memoria ----------
const db = new DatabaseSync(':memory:')
class ClienteMemoria extends ClienteMysql {
    _driver() { return {} }
    async acquireRawConnection() { return {} }
    async destroyRawConnection() {}
    validateConnection() { return true }
    async _query(conexion, obj) {
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
const USUARIO = 987654321
const OTRO = 8
simular('./sso', { requirePermission: () => (req, res, next) => next() })
simular('./middleware/SesionUsuario', (req, res, next) => {
    req.user = { id: USUARIO }
    req.session = { u_data: { id: USUARIO, es_negocio: true } }
    next()
})
// El test nunca toca los archivos subidos reales
const cfg = require('./config/negocio')
cfg.FOTOS_DIR = path.join(__dirname, 'no-existe-test', 'articulos')
cfg.PERFIL_IMG_DIR = path.join(__dirname, 'no-existe-test', 'perfiles')

const buscador = require('./controllers/busqueda_productos')
const sync_cache = require('./controllers/sync_cache')
const precios_negocio = require('./controllers/precios_negocio')

const PRECIO = `id TEXT PRIMARY KEY, product_id TEXT, branch_id INTEGER, price REAL, date_time TEXT, time TEXT,
  es_oferta INTEGER, confiabilidad INTEGER, notas TEXT, url TEXT, user_id INTEGER, user_nombre TEXT, user_apellido TEXT`
db.exec(`
CREATE TABLE price (${PRECIO});
CREATE TABLE price_today (${PRECIO}, price_id TEXT, product_name TEXT);
CREATE TABLE precios_negocio (id TEXT PRIMARY KEY, usuario_id INTEGER, product_id TEXT, branch_id INTEGER, price REAL);
CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT);
CREATE TABLE product_category (product_id TEXT, category_id INTEGER);
CREATE TABLE branch (id INTEGER PRIMARY KEY, propietario_id INTEGER, enterprise_id INTEGER);
CREATE TABLE enterprice (id INTEGER PRIMARY KEY);
CREATE TABLE articulo_fotos (user_id INTEGER, branch_id INTEGER);
CREATE TABLE perfiles (usuario_id INTEGER);
CREATE TABLE negocio_contactos (usuario_id INTEGER);
CREATE TABLE promociones_hoy (branch_id INTEGER);
CREATE TABLE estadistica_aumento_diario (branch_id INTEGER);
CREATE TABLE branch_category (branch_id INTEGER);
`)

const PROPIO = 1     // local del usuario
const NEGOCIO = 2    // negocio ajeno
const COMUN = 3      // local comun

function hace(dias) {
    const d = new Date()
    d.setHours(0, 0, 1, 0)
    d.setDate(d.getDate() - dias)
    return d.toISOString()
}

// Cada producto representa un escenario: [producto, local, [[id, precio, diasAtras, usuario]], idEnPriceToday]
const ESCENARIOS = [
    ['propio', PROPIO, [['a1', 10, 0, USUARIO]], 'a1'],
    ['propio-tercero', PROPIO, [['a2', 11, 0, OTRO]], 'a2'],
    ['negocio-anterior', NEGOCIO, [['b0', 20, 30, OTRO], ['b1', 21, 0, USUARIO]], 'b1'],
    ['negocio-solo', NEGOCIO, [['b2', 22, 0, USUARIO]], 'b2'],
    ['comun-ayer', COMUN, [['c0', 30, 1, OTRO], ['c1', 31, 0, USUARIO]], 'c1'],
    ['comun-vencido', COMUN, [['c2', 32, 2, OTRO], ['c3', 33, 0, USUARIO]], 'c3'],
    ['comun-solo', COMUN, [['c4', 34, 0, USUARIO]], 'c4'],
    ['comun-no-vigente', COMUN, [['c5', 35, 1, USUARIO], ['c6', 36, 0, OTRO]], 'c6'],
    ['comun-tercero', COMUN, [['c7', 37, 0, OTRO]], 'c7'],
]
// Precio que debe quedar visible por producto tras el borrado (null = ninguno)
const ESPERADO = {
    'propio': null, 'propio-tercero': null, 'negocio-anterior': 20, 'negocio-solo': null,
    'comun-ayer': 30, 'comun-vencido': null, 'comun-solo': null, 'comun-no-vigente': 36, 'comun-tercero': 37,
}

async function preparar() {
    await global.knex('enterprice').insert([{ id: 100 }, { id: 200 }, { id: 300 }])
    const locales = [
        { id: PROPIO, propietario_id: USUARIO, enterprise_id: 100 },
        { id: NEGOCIO, propietario_id: OTRO, enterprise_id: 200 },
        { id: COMUN, propietario_id: null, enterprise_id: 300 },
    ]
    await global.knex('branch').insert(locales)
    await precios_negocio.cargar_ids(global.knex)
    global.branchs_diccio = Object.fromEntries(locales.map((l) => [l.id, l]))
    global.enterprice_diccio = { 100: { id: 100 }, 200: { id: 200 }, 300: { id: 300 } }
    global.branch_enterprice_diccio = { 100: [locales[0]], 200: [locales[1]], 300: [locales[2]] }
    global.precios_diccio = {}
    global.products_category_diccio = { by_product_id: {}, by_category_id: {} }

    for (const [producto, local, precios, en_hoy] of ESCENARIOS) {
        await global.knex('products').insert({ id: producto, name: `Arroz ${producto}` })
        await global.knex('product_category').insert({ product_id: producto, category_id: 5 })
        for (const [id, price, dias, user_id] of precios) {
            const fila = { id, product_id: producto, branch_id: local, price, date_time: hace(dias), user_id }
            await global.knex('price').insert(fila)
            if (user_id === USUARIO) await global.knex('precios_negocio').insert({ id, usuario_id: user_id, product_id: producto, branch_id: local, price })
            if (id === en_hoy) {
                const hoy = { ...fila, id: `hoy-${id}`, price_id: id, product_name: `Arroz ${producto}` }
                await global.knex('price_today').insert(hoy)
                buscador.agregar_a_buscador(hoy)
                await sync_cache.actualizar_precio(hoy)
            }
        }
    }
}

// Precios que muestra cada estructura en memoria para un producto
function memoria(producto) {
    const del_producto = (arr) => (arr || []).filter((r) => r.product_id === producto).map((r) => Number(r.price))
    return {
        buscador: del_producto(buscador.busqueda_ranking('arroz')),
        precios: del_producto(global.precios_diccio[producto]),
        categoria: del_producto(global.products_category_diccio.by_category_id[5]),
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

    await caso('el borrado responde 200', async () => {
        const r = await fetch(`http://127.0.0.1:${servidor.address().port}/api/negocio/mi-cuenta/datos`, { method: 'DELETE' })
        assert.strictEqual(r.status, 200, await r.text())
    })

    for (const [producto, precio] of Object.entries(ESPERADO)) {
        await caso(`buscador y caches: ${producto}`, async () => {
            const v = precio === null ? [] : [precio]
            assert.deepStrictEqual(memoria(producto), { buscador: v, precios: v, categoria: v })
        })
    }

    await caso('price_today: repone solo lo de hoy/ayer en locales ajenos', async () => {
        const filas = await global.knex('price_today').select('price_id').orderBy('price_id')
        assert.deepStrictEqual(filas.map((f) => f.price_id), ['c0', 'c6', 'c7'])
    })

    await caso('locales y comercios eliminados salen de diccionarios y de negocios', async () => {
        assert.deepStrictEqual(Object.keys(global.branchs_diccio), ['2', '3'])
        assert.deepStrictEqual(Object.keys(global.enterprice_diccio), ['200', '300'])
        assert.deepStrictEqual(Object.keys(global.branch_enterprice_diccio), ['200', '300'])
        assert.strictEqual(precios_negocio.es_negocio(PROPIO), false)
        assert.strictEqual(precios_negocio.es_negocio(NEGOCIO), true)
    })

    servidor.close()
    await global.knex.destroy()
    console.log(fallos ? `\n${fallos} caso(s) con fallos` : '\nTodos los casos OK')
    process.exit(fallos ? 1 : 0)
})()
