/**
 * Test: borrado de precios del panel admin (routes/preciosComunitarios.js, DELETE /:id)
 *
 * price.id es varchar(36) (UUID v7, UUID v1 e ids numericos antiguos). Cubre:
 * - El id llega a todas las consultas como string, sin conversion a numero.
 * - Solo se borra la fila pedida, aunque otras empiecen con los mismos digitos.
 * - Formatos de id invalidos se rechazan con 400 sin consultar la base.
 * - 404 si no existe y 400 si el precio no fue cargado por un usuario.
 * - Si era el precio vigente, price_today se restaura con el anterior.
 *
 * Usa un knex falso en memoria (sso, buscador y caches simulados) y monta el router real
 * sobre express en un puerto efimero. No requiere base de datos. El knex falso compara
 * como MySQL cuando recibe un numero contra una columna de texto (convierte el texto).
 *
 * Uso: node back/test_eliminar_precio_admin.js
 * Sale con codigo distinto de cero si algun caso falla.
 */

const assert = require('assert')
const express = require('express')

// ---------- modulos simulados ----------
function simular(ruta, exports) {
    const archivo = require.resolve(ruta)
    require.cache[archivo] = { id: archivo, filename: archivo, loaded: true, exports }
}
const buscador = []
simular('./sso', { requirePermission: () => (req, res, next) => next() })
simular('./controllers/busqueda_productos', {
    agregar_a_buscador: (d) => buscador.push(['agregar', d.price_id]),
    eliminar_de_buscador: (p, b) => buscador.push(['eliminar', p, b]),
})
simular('./controllers/sync_cache', { actualizar_precio: async () => {} })

// ---------- knex falso ----------
const V7_A = '0192f0c1-1111-7aaa-8bbb-000000000001'
const V7_B = '0192f0c1-2222-7aaa-8bbb-000000000002'
const V1 = '5f0c2a10-9b1e-11ee-b9d1-0242ac120002'
let tablas = {}
let consultas = []
function reset() {
    const ahora = Date.now()
    const precio = (id, extra) => ({ id, product_id: 'prod-1', branch_id: 1, user_id: 7, price: 10, date_time: new Date(ahora - 3000), ...extra })
    tablas = {
        price: [
            precio(V7_A, { date_time: new Date(ahora - 1000), price: 30 }),
            precio(V7_B, { date_time: new Date(ahora - 2000), price: 20 }),
            precio(V1, { product_id: 'prod-2' }),
            precio('192', { product_id: 'prod-3' }),
            precio('86', { product_id: 'prod-4', user_id: null }),
        ],
        price_today: [{ id: 'hoy-1', price_id: V7_A, product_id: 'prod-1', branch_id: 1, price: 30 }],
        products: [{ id: 'prod-1', name: 'Producto 1' }],
        precios_negocio: [{ id: V7_A }, { id: V7_B }],
    }
    consultas = []
    buscador.length = 0
    global.precios_diccio = {}
    global.products_category_diccio = { by_product_id: {}, by_category_id: {} }
}

const igual = (celda, v) => (typeof v === 'number' && typeof celda === 'string' ? parseFloat(celda) === v : celda === v)

function consulta(tabla) {
    let filtro = {}
    let orden = null
    const filas = () => {
        const r = tablas[tabla].filter((f) => Object.entries(filtro).every(([k, v]) => igual(f[k], v)))
        if (orden) r.sort((a, b) => b[orden] - a[orden])
        return r
    }
    return {
        where(a, b) {
            const nuevo = typeof a === 'object' ? a : { [a]: b }
            consultas.push({ tabla, filtro: nuevo })
            Object.assign(filtro, nuevo)
            return this
        },
        orderBy(col) { orden = col; return this },
        async first() { return filas()[0] },
        async del() { const r = filas(); tablas[tabla] = tablas[tabla].filter((f) => !r.includes(f)); return r.length },
        async update(cambios) { const r = filas(); r.forEach((f) => Object.assign(f, cambios)); return r.length },
    }
}
global.knex = (tabla) => consulta(tabla)
global.knex.client = { config: { client: 'mysql2' } }
global.knex.transaction = async () => Object.assign((t) => consulta(t), { commit: async () => {}, rollback: async () => {} })

// ---------- servidor de prueba ----------
const router = require('./routes/preciosComunitarios')
const app = express()
app.use('/', router)
const servidor = app.listen(0)
const base = `http://127.0.0.1:${servidor.address().port}`

async function borrar(id) {
    const r = await fetch(`${base}/${id}`, { method: 'DELETE' })
    return { status: r.status, json: await r.json() }
}
const ids = () => tablas.price.map((f) => f.id).sort()

let fallos = 0
async function caso(nombre, fn) {
    try {
        reset()
        await fn()
        console.log(`OK    ${nombre}`)
    } catch (e) {
        fallos++
        console.log(`FAIL  ${nombre}`)
        console.log(`      ${String(e.message).split('\n').join('\n      ')}`)
    }
}

;(async () => {
    for (const [tipo, id] of [['UUID v7', V7_B], ['UUID v1', V1], ['numerico antiguo', '192']]) {
        await caso(`borra solo la fila pedida (${tipo})`, async () => {
            const esperados = ids().filter((x) => x !== id)
            const r = await borrar(id)
            assert.strictEqual(r.status, 200, JSON.stringify(r.json))
            assert.strictEqual(r.json.data.id, id)
            assert.deepStrictEqual(ids(), esperados)
            const porId = consultas.filter((c) => 'id' in c.filtro && c.tabla === 'price')
            assert.ok(porId.length >= 2 && porId.every((c) => c.filtro.id === id), JSON.stringify(porId))
        })
    }

    await caso('borra solo la copia de precios_negocio del precio', async () => {
        const r = await borrar(V7_B)
        assert.strictEqual(r.status, 200, JSON.stringify(r.json))
        assert.deepStrictEqual(tablas.precios_negocio.map((f) => f.id), [V7_A])
    })

    await caso('anterior de antes de ayer: se quita de price_today y de memoria', async () => {
        tablas.price.find((f) => f.id === V7_B).date_time = new Date(Date.now() - 3 * 86400000)
        const r = await borrar(V7_A)
        assert.strictEqual(r.status, 200, JSON.stringify(r.json))
        assert.deepStrictEqual(tablas.price_today, [])
        assert.deepStrictEqual(buscador, [['eliminar', 'prod-1', 1]])
    })

    await caso('precio vigente: restaura price_today con el anterior', async () => {
        const r = await borrar(V7_A)
        assert.strictEqual(r.status, 200, JSON.stringify(r.json))
        assert.strictEqual(tablas.price_today[0].price_id, V7_B)
        assert.strictEqual(tablas.price_today[0].price, 20)
        assert.deepStrictEqual(buscador, [['agregar', V7_B]])
    })

    await caso('rechaza formatos invalidos con 400 sin consultar la base', async () => {
        const antes = ids()
        for (const id of ['abc_def', '1.5', '%20', '1%20OR%201', "a'b", 'a'.repeat(37)]) {
            const r = await borrar(id)
            assert.strictEqual(r.status, 400, `id ${id}: ${r.status}`)
            assert.strictEqual(r.json.status, false)
        }
        assert.strictEqual(consultas.length, 0)
        assert.deepStrictEqual(ids(), antes)
    })

    await caso('404 para un id inexistente que comparte prefijo numerico', async () => {
        const antes = ids()
        const r = await borrar('192abc')
        assert.strictEqual(r.status, 404, JSON.stringify(r.json))
        assert.deepStrictEqual(ids(), antes)
    })

    await caso('400 si el precio no fue cargado por un usuario', async () => {
        const antes = ids()
        const r = await borrar('86')
        assert.strictEqual(r.status, 400, JSON.stringify(r.json))
        assert.deepStrictEqual(ids(), antes)
    })

    servidor.close()
    console.log(fallos ? `\n${fallos} caso(s) con fallos` : '\nTodos los casos OK')
    process.exit(fallos ? 1 : 0)
})()
