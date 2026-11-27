/**
 * Test: reglas de las cargas de precios.
 * - Las importaciones no escriben precios en sucursales de negocio (POST /importar,
 *   /importar_oferta e importar_productos.js) y registran el motivo del descarte.
 * - Ninguna carga admite fechas posteriores a mañana (calendario de Argentina).
 * - "Precios de hoy" (admin) muestra solo precios fechados desde ayer.
 *
 * No usa base de datos ni servicios (knex y servicio de colas simulados en este proceso).
 *
 * Uso: node back/test_reglas_importacion.js
 * Sale con codigo distinto de cero si algun caso falla.
 */

const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')
const { pathToFileURL } = require('url')
const express = require('express')

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reglas-importacion-'))
const CSV = path.join(dir, 'descartados.csv')
process.env.CSV_DESCARTADOS = CSV
process.env.KEY_INT = 'clave-test'

const COMUN = 1, NEGOCIO = 2, SIN_LOCAL = 3, MISMA_EMPRESA = 4
const branchs = [
    { id: COMUN, enterprise_id: 10, propietario_id: null },
    { id: NEGOCIO, enterprise_id: 11, propietario_id: 7 },
    { id: SIN_LOCAL, enterprise_id: 12, propietario_id: 7, sin_local: 1 },
    { id: MISMA_EMPRESA, enterprise_id: 11, propietario_id: null },
]
const tablas_usadas = []
let transacciones = 0
global.knex = (tabla) => {
    tablas_usadas.push(tabla)
    let filas = tabla === 'branch' ? branchs : []
    const b = {
        select: () => b,
        whereIn(c, v) { filas = filas.filter(f => v.map(String).includes(String(f[c]))); return b },
        where(f) { filas = filas.filter(x => Object.entries(f).every(([k, v]) => String(x[k]) === String(v))); return b },
        first: async () => filas[0],
        then: (ok, error) => Promise.resolve(filas).then(ok, error),
    }
    return b
}
// Nunca resuelve: alcanza con saber si la importación llegó a pedirla
global.knex.transaction = () => { transacciones++; return new Promise(() => {}) }

const { dia_desde_hoy, validar_fecha_precio, MENSAJES_FECHA } = require('./helpers/fecha_precio')

let fallos = 0
async function caso(nombre, fn) {
    try { await fn(); console.log(`   ✓ ${nombre}`) }
    catch (error) { fallos++; console.log(`   ✗ ${nombre}: ${error.message}`) }
}
const escuchar = (srv) => new Promise((ok) => { const s = srv.listen(0, '127.0.0.1', () => ok(s)) })
const csv = () => fs.existsSync(CSV) ? fs.readFileSync(CSV, 'utf8') : ''

async function main() {
    const encolados = []
    const cola = await escuchar(http.createServer((req, res) => {
        let cuerpo = ''
        req.on('data', (d) => { cuerpo += d })
        req.on('end', () => {
            encolados.push(JSON.parse(cuerpo).data)
            res.setHeader('content-type', 'application/json')
            res.end('{"success":true}')
        })
    }))
    process.env.QUEUE_SERVICE_URL = `http://127.0.0.1:${cola.address().port}`

    const productos = require('./routes/productos')
    const importar_productos = require('./controllers/importar_productos')
    const sso = require('./sso')
    sso.requirePermission = () => (req, res, next) => next()
    const precios_hoy = require('./routes/preciosHoy')

    const app = express()
    app.use(express.json())
    app.use('/productos', productos)
    app.use('/precios_hoy', precios_hoy)
    const api = await escuchar(http.createServer(app))
    const url = `http://127.0.0.1:${api.address().port}`
    const post = async (ruta, cuerpo) => (await fetch(url + ruta, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
    })).json()

    await caso('fechas: hoy y mañana sí, pasado mañana no, según Argentina', () => {
        // 01:30 UTC del 28 es todavía el 27 en Argentina
        const ahora = new Date('2026-11-28T01:30:00Z')
        const v = (x) => validar_fecha_precio(x, { ahora })
        for (const x of ['2026-11-27', '2026-11-28', '2026-11-28T23:59:59', '2026-11-28 23:59:59.123456',
            '2026-11-29T02:59:59Z', '2026-11-29T01:00:00.000Z', new Date('2026-11-29T02:00:00Z'), '2020-01-01'])
            assert.strictEqual(v(x).ok, true, String(x))
        for (const x of ['2026-11-29', '2026-11-29T00:00:00', '2026-11-29T03:00:00Z', '2026-11-28T23:00:00-05:00',
            new Date('2026-11-29T03:00:00Z')])
            assert.strictEqual(v(x).mensaje, MENSAJES_FECHA.futura, String(x))
        for (const x of ['', 'abc', '27/11/2026', '26-11-27', '2026-02-31', '2026-11-27T25:00:00', null, undefined, true, {}])
            assert.strictEqual(v(x).mensaje, MENSAJES_FECHA.no_valida, String(x))
        assert.strictEqual(v('2026-11-29T01:00:00Z').fecha, '2026-11-28 22:00:00')
        assert.strictEqual(v('2026-11-28T10:00:00').fecha, '2026-11-28T10:00:00')
    })

    await caso('formularios: comunitario y negocio rechazan pasado mañana', () => {
        const filas = [{ nombre: 'Arroz', precio: 10 }]
        for (const validar of [
            (fecha) => productos.validar_carga_precios_formulario(filas, fecha),
            (fecha) => productos.validar_carga_precios_negocio({ sin_local: true, fecha, productos: filas }),
        ]) {
            assert.deepStrictEqual(validar(dia_desde_hoy(0)), [])
            assert.deepStrictEqual(validar(dia_desde_hoy(1)), [])
            assert.deepStrictEqual(validar(dia_desde_hoy(2)), [{ campo: 'fecha', mensaje: MENSAJES_FECHA.futura }])
            assert.strictEqual(validar('2026-02-31')[0].mensaje, MENSAJES_FECHA.no_valida)
        }
    })

    await caso('front: misma ventana que el back', async () => {
        const front = await import(pathToFileURL(path.join(__dirname, '..', 'front', 'src', 'utils', 'fecha.js')))
        const ahora = new Date('2026-12-01T02:00:00Z')
        assert.strictEqual(front.dia_desde_hoy(0, ahora), '2026-11-30')
        for (const n of [-1, 0, 1, 2]) assert.strictEqual(front.dia_desde_hoy(n, ahora), dia_desde_hoy(n, ahora))
        assert.strictEqual(front.es_fecha_futura('2026-12-01', ahora), false)
        assert.strictEqual(front.es_fecha_futura('2026-12-02', ahora), true)
        assert.strictEqual(front.MENSAJE_FECHA_FUTURA, MENSAJES_FECHA.futura)
    })

    await caso('POST /importar: descarta sucursales de negocio y fechas futuras', async () => {
        const item = (name, branch_id, dias = 0) => ({ name, branch_id, price: 10, fecha_registro: `${dia_desde_hoy(dias)}T10:00:00` })
        const r = await post('/productos/importar', { key: 'clave-test', lst_importa: [
            item('comun', COMUN), item('negocio', NEGOCIO), item('sinlocal', String(SIN_LOCAL)),
            item('misma-empresa', MISMA_EMPRESA, 1), item('futuro', COMUN, 2),
        ] })
        assert.deepStrictEqual([r.stat, r.count, r.rechazados], [true, 2, 3])
        assert.deepStrictEqual(encolados.map((i) => i.name), ['comun', 'misma-empresa'])
        assert.match(csv(), /"negocio","2","sucursal de negocio/)
        assert.match(csv(), /"sinlocal","3","sucursal de negocio/)
        assert.match(csv(), /"futuro","1","La fecha no puede ser posterior a mañana/)
    })

    await caso('POST /importar_oferta: descarta fechas futuras', async () => {
        encolados.length = 0
        const r = await post('/productos/importar_oferta', { key: 'clave-test', lst_importa: [
            { titulo: 'ok', branch_id: NEGOCIO, fecha_registro: dia_desde_hoy(1) },
            { titulo: 'tarde', branch_id: COMUN, fecha_registro: dia_desde_hoy(2) },
        ] })
        assert.deepStrictEqual([r.count, r.rechazados], [1, 1])
        assert.deepStrictEqual(encolados.map((i) => i.titulo), ['ok'])
        assert.match(csv(), /"oferta","tarde"/)
    })

    await caso('importar_productos.js: descarta antes de abrir la transacción', async () => {
        const articulo = (branch_id, dias = 0) => ({ name: 'x', category_name: 'c', price: 10, branch_id, fecha_registro: dia_desde_hoy(dias) })
        for (const id of [NEGOCIO, SIN_LOCAL])
            assert.match((await importar_productos.procesar_articulo(articulo(id))).text, /sucursal de negocio/)
        tablas_usadas.length = 0
        assert.match((await importar_productos.procesar_articulo(articulo(COMUN, 2))).text, /posterior a mañana/)
        assert.match((await importar_productos.procesar_articulo({ ...articulo(COMUN), fecha_registro: undefined }, dia_desde_hoy(2))).text, /posterior a mañana/)
        assert.deepStrictEqual(tablas_usadas, [])
        assert.strictEqual(transacciones, 0)
        // Sucursal común de la misma empresa: pasa las reglas y llega a la transacción
        importar_productos.procesar_articulo(articulo(MISMA_EMPRESA))
        await new Promise((ok) => setTimeout(ok, 100))
        assert.strictEqual(transacciones, 1)
    })

    await caso('Precios de hoy (admin): solo desde ayer, también negocios; mañana se muestra', async () => {
        const hora = (dias) => new Date(`${dia_desde_hoy(dias)}T12:00:00-03:00`)
        const fila = (id, date_time, negocio) => ({ id, product_id: id, branch_id: negocio ? NEGOCIO : COMUN, price: 1, date_time, negocio })
        global.branchs_diccio = {}
        global.enterprice_diccio = {}
        const filas = [
            fila('hoy', hora(0)), fila('ayer', hora(-1), true), fila('manana', hora(1), true),
            fila('ayer-texto', dia_desde_hoy(-1)), fila('inicio-ayer', new Date(`${dia_desde_hoy(-1)}T00:00:00-03:00`)),
            fila('viejo', hora(-2)), fila('viejo-negocio', hora(-30), true),
            fila('fin-anteayer', new Date(`${dia_desde_hoy(-2)}T23:59:59-03:00`), true), fila('sin-fecha', null, true),
        ]
        global.precios_diccio = Object.fromEntries(filas.map((f) => [f.id, [f]]))
        const r = await (await fetch(`${url}/precios_hoy/list?pageSize=100`)).json()
        assert.deepStrictEqual(r.data.rows.map((f) => f.id).sort(), ['ayer', 'ayer-texto', 'hoy', 'inicio-ayer', 'manana'])
        assert.strictEqual(r.data.totalRecords, 5)
        assert.strictEqual(Object.keys(global.precios_diccio).length, filas.length)
    })

    api.closeAllConnections(); api.close()
    cola.closeAllConnections(); cola.close()
    fs.rmSync(dir, { recursive: true, force: true })
    console.log(fallos ? `\n${fallos} caso(s) fallaron` : '\nTodos los casos pasaron')
    process.exit(fallos ? 1 : 0)
}

main()
