/**
 * Test: sincronizacion de buscador y caches al editar o borrar un precio
 * (PUT/DELETE /api/negocio/mis-precios/:id y borrado admin DELETE /:id).
 *
 * En locales de negocio el vigente es el ultimo registro de `price` por (producto, local),
 * con desempate por id, este o no en price_today. Cubre:
 * - Editar/borrar el vigente, con y sin fila en price_today.
 * - Editar/borrar uno que no es el vigente (no debe pisar al vigente).
 * - Borrar con y sin precios anteriores.
 * - Locales que no son de negocio: sin cambios de comportamiento.
 *
 * Usa el buscador, las caches y los routers reales. Las consultas se generan con knex
 * (dialecto mysql2) y se ejecutan en una base SQLite en memoria (node:sqlite, Node >= 22.13).
 * sso y la sesion estan simulados. No requiere base de datos.
 *
 * Uso: node back/test_precios_negocio_sync.js
 * Sale con codigo distinto de cero si algun caso falla.
 */

const assert = require('assert')
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
const USUARIO = 7
simular('./sso', { requirePermission: () => (req, res, next) => next() })
simular('./middleware/SesionUsuario', (req, res, next) => {
    req.user = { id: USUARIO }
    req.session = { u_data: { id: USUARIO, es_negocio: true } }
    next()
})

const buscador = require('./controllers/busqueda_productos')
const sync_cache = require('./controllers/sync_cache')
const precios_negocio = require('./controllers/precios_negocio')

const NEGOCIO = 1
const COMUN = 2
const PROD = 'prod-1'

db.exec(`
CREATE TABLE price (id TEXT PRIMARY KEY, product_id TEXT, branch_id INTEGER, price REAL, date_time TEXT, time TEXT,
  es_oferta INTEGER, confiabilidad INTEGER, notas TEXT, url TEXT, user_id INTEGER, user_nombre TEXT, user_apellido TEXT);
CREATE TABLE price_today (id TEXT PRIMARY KEY, price_id TEXT, product_id TEXT, branch_id INTEGER, product_name TEXT, price REAL,
  date_time TEXT, time TEXT, es_oferta INTEGER, confiabilidad INTEGER, notas TEXT, url TEXT, user_id INTEGER, user_nombre TEXT, user_apellido TEXT);
CREATE TABLE precios_negocio (id TEXT PRIMARY KEY, usuario_id INTEGER, product_id TEXT, branch_id INTEGER, price REAL, actualizado_el TEXT);
CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT);
CREATE TABLE product_category (product_id TEXT, category_id INTEGER);
CREATE TABLE branch (id INTEGER PRIMARY KEY, propietario_id INTEGER);
INSERT INTO products VALUES ('prod-1', 'Arroz'), ('prod-2', 'Fideos');
INSERT INTO product_category VALUES ('prod-1', 5);
INSERT INTO branch VALUES (1, 7), (2, NULL);
`)

// precios: lista [id, precio, dia]; en_hoy: id que ademas figura en price_today
// La memoria arranca como tras regenerar diccionarios, mostrando `mostrado`
async function preparar({ local = NEGOCIO, precios, en_hoy = null, mostrado }) {
    db.exec('DELETE FROM price; DELETE FROM price_today; DELETE FROM precios_negocio')
    for (const [id, precio, dia] of precios) {
        const fecha = `2020-01-0${dia} 10:00:00`
        await global.knex('price').insert({ id, product_id: PROD, branch_id: local, price: precio, date_time: fecha, user_id: USUARIO })
        await global.knex('precios_negocio').insert({ id, usuario_id: USUARIO, product_id: PROD, branch_id: local, price: precio })
        if (id === en_hoy) {
            await global.knex('price_today').insert({ id: 'hoy-1', price_id: id, product_id: PROD, branch_id: local, product_name: 'Arroz', price: precio, date_time: fecha, user_id: USUARIO })
        }
    }
    await precios_negocio.cargar_ids(global.knex)
    global.precios_diccio = {}
    global.products_category_diccio = { by_product_id: { [PROD]: [5] }, by_category_id: {} }
    buscador.eliminar_de_buscador(PROD, local)
    if (mostrado) {
        const datos = { product_id: PROD, branch_id: local, product_name: 'Arroz', price: mostrado[1], price_id: mostrado[0], date_time: '2020-01-01 10:00:00' }
        buscador.agregar_a_buscador(datos)
        await sync_cache.actualizar_precio(datos)
    }
}

// Lo que muestran las tres estructuras en memoria
function memoria(local = NEGOCIO) {
    const del_local = (arr) => (arr || []).filter((r) => String(r.branch_id) === String(local)).map((r) => Number(r.price))
    return {
        buscador: del_local(buscador.busqueda_ranking('arroz')),
        precios: del_local(global.precios_diccio[PROD]),
        categoria: del_local(global.products_category_diccio.by_category_id[5]),
    }
}
function esperar(precio, local) {
    const v = precio === null ? [] : [precio]
    assert.deepStrictEqual(memoria(local), { buscador: v, precios: v, categoria: v })
}

// ---------- servidor de prueba ----------
const app = express()
app.use(express.json())
app.use('/admin', require('./routes/preciosComunitarios'))
app.use('/api', require('./routes/negocio'))
const servidor = app.listen(0)
const base = `http://127.0.0.1:${servidor.address().port}`

async function pedir(metodo, ruta, cuerpo) {
    const r = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: cuerpo && JSON.stringify(cuerpo) })
    const texto = await r.text()
    assert.strictEqual(r.status, 200, texto)
}
const editar = (id, precio) => pedir('PUT', `/api/negocio/mis-precios/${id}`, { precio })
const borrar = (id) => pedir('DELETE', `/api/negocio/mis-precios/${id}`)

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

const DOS = [['a', 10, 1], ['b', 20, 2]]

;(async () => {
    const log = console.log
    console.log = (...a) => { if (!String(a[0]).startsWith('[busqueda_productos]')) log(...a) }

    for (const en_hoy of [null, 'b']) {
        const hoy = en_hoy ? 'con price_today' : 'sin price_today'
        await caso(`negocio, editar el vigente (${hoy})`, async () => {
            await preparar({ precios: DOS, en_hoy, mostrado: ['b', 20] })
            await editar('b', 25)
            esperar(25)
        })
        await caso(`negocio, borrar el vigente con anterior (${hoy})`, async () => {
            await preparar({ precios: DOS, en_hoy, mostrado: ['b', 20] })
            await borrar('b')
            esperar(10)
        })
        await caso(`negocio, borrar el unico precio (${hoy})`, async () => {
            await preparar({ precios: [['b', 20, 2]], en_hoy, mostrado: ['b', 20] })
            await borrar('b')
            esperar(null)
        })
        await caso(`negocio, borrado admin del vigente (${hoy})`, async () => {
            await preparar({ precios: DOS, en_hoy, mostrado: ['b', 20] })
            await pedir('DELETE', '/admin/b')
            esperar(10)
        })
    }

    // 'a' queda en price_today aunque el vigente es 'b'
    for (const en_hoy of [null, 'a']) {
        const hoy = en_hoy ? 'el viejo en price_today' : 'sin price_today'
        await caso(`negocio, editar uno no vigente no pisa (${hoy})`, async () => {
            await preparar({ precios: DOS, en_hoy, mostrado: ['b', 20] })
            await editar('a', 15)
            esperar(20)
        })
        await caso(`negocio, borrar uno no vigente no pisa (${hoy})`, async () => {
            await preparar({ precios: [['z', 5, 1], ...DOS.map(([i, p, d]) => [i, p, d + 1])], en_hoy, mostrado: ['b', 20] })
            await borrar('a')
            esperar(20)
        })
    }

    const EMPATE = [['a', 10, 2], ['b', 20, 2], ['c', 30, 2]]
    await caso('negocio, misma fecha: editar uno de id menor no pisa', async () => {
        await preparar({ precios: EMPATE, en_hoy: 'a', mostrado: ['c', 30] })
        await editar('a', 15)
        esperar(30)
    })
    await caso('negocio, misma fecha: al borrar el vigente queda el de mayor id', async () => {
        await preparar({ precios: EMPATE, mostrado: ['c', 30] })
        await borrar('c')
        esperar(20)
    })

    await caso('negocio, otro producto con fecha posterior no interfiere', async () => {
        await preparar({ precios: DOS, mostrado: ['b', 20] })
        await global.knex('price').insert({ id: 'otro', product_id: 'prod-2', branch_id: NEGOCIO, price: 99, date_time: '2020-01-09 10:00:00' })
        await borrar('b')
        esperar(10)
    })

    await caso('local comun, sin price_today: editar no toca la memoria', async () => {
        await preparar({ local: COMUN, precios: DOS, mostrado: null })
        await editar('b', 25)
        esperar(null, COMUN)
    })
    await caso('local comun, editar el de price_today actualiza la memoria', async () => {
        await preparar({ local: COMUN, precios: DOS, en_hoy: 'b', mostrado: ['b', 20] })
        await editar('b', 25)
        esperar(25, COMUN)
    })
    await caso('local comun, borrar el de price_today restaura el anterior si es reciente', async () => {
        await preparar({ local: COMUN, precios: DOS, en_hoy: 'b', mostrado: ['b', 20] })
        await global.knex('price').where({ id: 'a' }).update({ date_time: new Date().toISOString() })
        await borrar('b')
        esperar(10, COMUN)
    })
    await caso('local comun, borrar el de price_today con anterior vencido lo quita', async () => {
        await preparar({ local: COMUN, precios: DOS, en_hoy: 'b', mostrado: ['b', 20] })
        await borrar('b')
        esperar(null, COMUN)
        assert.deepStrictEqual(await global.knex('price_today'), [])
    })
    for (const [caso_admin, local] of [['negocio', NEGOCIO], ['comun', COMUN]]) {
        await caso(`${caso_admin}, borrado admin quita la copia de precios_negocio`, async () => {
            await preparar({ local, precios: DOS, mostrado: ['b', 20] })
            await pedir('DELETE', '/admin/b')
            assert.deepStrictEqual((await global.knex('precios_negocio').select('id')).map((f) => f.id), ['a'])
        })
    }

    console.log = log
    servidor.close()
    await global.knex.destroy()
    console.log(fallos ? `\n${fallos} caso(s) con fallos` : '\nTodos los casos OK')
    process.exit(fallos ? 1 : 0)
})()
