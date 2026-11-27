/**
 * Test: GET /publico/busqueda/precios no descarta por antigüedad los precios de
 * sucursales de negocios; los de locales comunes mantienen la ventana hoy+ayer.
 *
 * Usa el router y el buscador en memoria reales. No requiere base de datos
 * (el historial de búsquedas está simulado).
 *
 * Uso: node back/test_busqueda_precios_negocio.js
 * Sale con codigo distinto de cero si algun caso falla.
 */

const assert = require('assert')
const express = require('express')
const buscador = require('./controllers/busqueda_productos')
const precios_negocio = require('./controllers/precios_negocio')

global.knex = () => ({ insert: async () => [] })

const NEGOCIO = 1
const COMUN = 2
global.branchs_diccio = {
    [NEGOCIO]: { id: NEGOCIO, enterprise_id: 10, propietario_id: 7 },
    [COMUN]: { id: COMUN, enterprise_id: 10 },
}
global.enterprice_diccio = { 10: { id: 10, name: 'Comercio' } }
global.branch_enterprice_diccio = { 10: Object.values(global.branchs_diccio) }
global.alias_busqueda = {}

// Mediodía de hace `dias` días
function hace(dias) {
    const d = new Date()
    d.setDate(d.getDate() - dias)
    d.setHours(12, 0, 0, 0)
    return d
}

function cargar(product_id, branch_id, dias, price = 100) {
    buscador.agregar_a_buscador({ product_id, product_name: `Arroz ${product_id}`, branch_id, price, date_time: hace(dias), time: hace(dias) })
}

async function main() {
    precios_negocio.marcar(NEGOCIO, true)
    for (const [local, prefijo] of [[NEGOCIO, 'neg'], [COMUN, 'com']]) {
        for (const dias of [0, 1, 2, 400]) cargar(`${prefijo}-${dias}`, local, dias)
    }
    // Local sin entrada en el diccionario: sigue descartado aunque sea de negocio
    precios_negocio.marcar(99, true)
    cargar('huerfano', 99, 0)

    const app = express()
    app.use('/publico/busqueda', require('./routes/busqueda'))
    const server = app.listen(0, '127.0.0.1')
    await new Promise(r => server.once('listening', r))
    const base = `http://127.0.0.1:${server.address().port}/publico/busqueda/precios?product_name=arroz`
    const pedir = async (extra = '') => (await fetch(base + extra)).json()
    const ids = r => r.items.map(i => i.product_id).sort()
    const ESPERADOS = ['com-0', 'com-1', 'neg-0', 'neg-1', 'neg-2', 'neg-400']

    try {
        for (const orden of ['', '&orden=precio_desc', '&orden=relevancia']) {
            const r = await pedir(orden)
            assert.deepStrictEqual(ids(r), ESPERADOS, `ventana (${orden || 'sin orden'})`)
            assert.strictEqual(r.total, ESPERADOS.length)
        }
        console.log('OK  negocio sin ventana; locales comunes hoy+ayer')

        const r = await pedir()
        assert.ok(r.items.every(i => !('negocio' in i)))
        console.log('OK  no se expone la marca de negocio')

        const paginas = [await pedir('&pagina=1&cantidad=4'), await pedir('&pagina=2&cantidad=4')]
        assert.deepStrictEqual(paginas.flatMap(ids).sort(), ESPERADOS)
        assert.deepStrictEqual(paginas.map(p => [p.total, p.hay_mas]), [[6, true], [6, false]])
        console.log('OK  paginación y total incluyen los precios antiguos de negocio')

        // La purga periódica del índice tampoco los quita
        const limite = hace(1)
        limite.setHours(0, 0, 0, 0)
        buscador.purgar_anteriores(limite)
        assert.deepStrictEqual(ids(await pedir()), ESPERADOS)
        console.log('OK  purga del índice')

        // Un local que deja de ser de negocio vuelve a la ventana
        precios_negocio.marcar(NEGOCIO, false)
        assert.deepStrictEqual(ids(await pedir()), ['com-0', 'com-1', 'neg-0', 'neg-1'])
        console.log('OK  local que deja de ser de negocio')
    } finally {
        server.close()
    }
}

main().then(() => console.log('Todos los casos pasaron'))
    .catch(e => { console.error('FALLO', e); process.exitCode = 1 })
