/**
 * Test: las respuestas publicas de precios no exponen user_id; nombre y apellido de quien
 * cargo el precio solo salen en locales comunes (nunca en sucursales de negocio).
 *
 * Cubre /busqueda/precios (productos y alquiler), /busqueda/promociones, /productos/all y
 * /estadistica/data?id_estadistica=variacion_precio con los routers reales, y que las caches
 * en memoria no se modifiquen. No requiere base de datos (knex simulado).
 *
 * Uso: node back/test_precios_publicos.js
 * Sale con codigo distinto de cero si algun caso falla.
 */

const assert = require('assert')
const express = require('express')

const AUTOR = { user_id: 7, user_nombre: 'Ana', user_apellido: 'Perez' }
const COMUN = 1, NEGOCIO = 2, SIN_LOCAL = 3, SIN_MARCAR = 4, SOLO_MARCADO = 5, DESCONOCIDO = 99
const ahora = new Date()

const tablas = {
    price: [COMUN, NEGOCIO].map(b => ({ id: `h${b}`, product_id: 'p', branch_id: b, price: 10, date_time: ahora, time: ahora, ...AUTOR })),
    propiedades_alquiler: [{ id: 1, titulo: 'alquiler casa', precio: 5, ultima_fecha: ahora, especificaciones: '{}' }],
    promociones_hoy: [{ id: 1, id_producto: 'p', precio: 5, fecha: ahora, branch_id: NEGOCIO, titulo: 'arroz', datos_extra: '{}' }],
}
global.knex = (tabla) => {
    let filas = tablas[tabla.trim()] || []
    const b = {
        select: () => b, whereRaw: () => b, andWhere: () => b, orderBy: () => b, limit: () => b,
        where(f) { if (typeof f === 'object') filas = filas.filter(x => Object.entries(f).every(([k, v]) => String(x[k]) === String(v))); return b },
        first: async () => filas[0],
        insert: async () => [],
        then: (ok, error) => Promise.resolve(filas.map(f => ({ ...f }))).then(ok, error),
    }
    return b
}

const buscador = require('./controllers/busqueda_productos')
const precios_negocio = require('./controllers/precios_negocio')
const { precio_publico } = require('./helpers/precio_publico')

global.branchs_diccio = {
    [COMUN]: { id: COMUN, enterprise_id: 10, propietario_id: null, sin_local: null },
    [NEGOCIO]: { id: NEGOCIO, enterprise_id: 10, propietario_id: 7 },
    [SIN_LOCAL]: { id: SIN_LOCAL, enterprise_id: 10, propietario_id: 7, sin_local: 1 },
    // Negocio segun la sucursal, pero ausente del conjunto de negocios y sin marca en el precio
    [SIN_MARCAR]: { id: SIN_MARCAR, enterprise_id: 10, propietario_id: 8 },
    // Negocio segun el conjunto, con la fila del diccionario desactualizada
    [SOLO_MARCADO]: { id: SOLO_MARCADO, enterprise_id: 10, propietario_id: null },
}
global.enterprice_diccio = { 10: { id: 10, name: 'Comercio' } }
global.branch_enterprice_diccio = { 10: [global.branchs_diccio[COMUN]] }
global.alias_busqueda = {}
for (const id of [NEGOCIO, SIN_LOCAL, SOLO_MARCADO]) precios_negocio.marcar(id, true)

const locales = [COMUN, NEGOCIO, SIN_LOCAL, SIN_MARCAR, SOLO_MARCADO]
const en_cache = locales.map(b => ({ id: `c${b}`, product_id: `p${b}`, product_name: `Arroz ${b}`, branch_id: String(b), price: 10, date_time: ahora, time: ahora, ...AUTOR }))
global.products_category_diccio = { by_product_id: {}, by_category_id: { 5: en_cache } }
const original = structuredClone(en_cache)
for (const p of en_cache) buscador.agregar_a_buscador(p)

function verificar(items, esperados) {
    assert.strictEqual(items.length, esperados)
    for (const i of items) {
        assert.ok(!('user_id' in i), `user_id expuesto (local ${i.branch_id})`)
        if (Number(i.branch_id) === COMUN) {
            assert.strictEqual(i.user_nombre, 'Ana')
            assert.strictEqual(i.user_apellido, 'Perez')
        } else {
            assert.ok(!('user_nombre' in i) && !('user_apellido' in i), `autor expuesto (local ${i.branch_id})`)
        }
    }
}

async function main() {
    console.log = () => {}
    const app = express()
    for (const r of ['busqueda', 'productos', 'estadistica']) app.use(`/${r}`, require(`./routes/${r}`))
    const server = app.listen(0, '127.0.0.1')
    await new Promise(r => server.once('listening', r))
    const base = `http://127.0.0.1:${server.address().port}`
    const pedir = async (ruta) => {
        const r = await (await fetch(base + ruta)).json()
        assert.strictEqual(r.stat, true, ruta)
        return r
    }

    try {
        for (const extra of ['', '&pagina=1&cantidad=10'])
            verificar((await pedir('/busqueda/precios?product_name=arroz' + extra)).items, locales.length)
        salida('OK  busqueda/precios')

        verificar((await pedir('/busqueda/precios?product_name=alquiler')).items, 1)
        verificar((await pedir('/busqueda/promociones?product_name=cod_todas_las_ofertas')).items, 1)
        salida('OK  alquiler y promociones')

        verificar((await pedir('/productos/all?category_id=5')).items, locales.length)
        assert.strictEqual((await pedir('/productos/all?category_id=404')).items, undefined)
        salida('OK  productos/all')

        for (const local of [COMUN, NEGOCIO]) {
            const { items } = await pedir(`/estadistica/data?id_estadistica=variacion_precio&id_producto=p&id_local=${local}`)
            assert.strictEqual(items.length, 1)
            assert.deepStrictEqual(Object.keys(items[0]).sort(), ['branch_id', 'date_time', 'id', 'price', 'product_id', 'time'])
        }
        salida('OK  estadistica variacion_precio sin datos de usuario')

        // Ni las caches ni el indice del buscador se modifican
        assert.deepStrictEqual(global.products_category_diccio.by_category_id[5], original)
        assert.ok(buscador.busqueda_ranking('arroz').every(i => i.user_id === 7 && i.user_nombre === 'Ana' && !i.empresa))
        salida('OK  caches intactas')

        // Ante la duda se oculta: sucursal desconocida o precio marcado como de negocio
        for (const p of [{ branch_id: DESCONOCIDO }, { branch_id: COMUN, negocio: true }]) {
            const r = precio_publico({ ...p, ...AUTOR })
            assert.ok(!('user_nombre' in r) && !('user_apellido' in r) && !('user_id' in r))
        }
        global.branchs_diccio = {}
        assert.ok(!('user_nombre' in precio_publico({ branch_id: COMUN, ...AUTOR })))
        salida('OK  estado incompleto oculta el autor')
    } finally {
        server.close()
    }
}

const salida = console.info

main().then(() => salida('Todos los casos pasaron'))
    .catch(e => { console.error('FALLO', e); process.exitCode = 1 })
