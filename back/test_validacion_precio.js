/**
 * Test: regla única de validación de precios (price.price es decimal(10,2)).
 * Cubre back/helpers/precio.js, su réplica en el front y las validaciones por fila
 * de las cargas masivas. No usa base de datos.
 *
 * Uso: node back/test_validacion_precio.js
 * Sale con codigo distinto de cero si algun caso falla.
 */

const assert = require('assert')
const path = require('path')
const { pathToFileURL } = require('url')
const { validar_precio, MENSAJES, PRECIO_MAX } = require('./helpers/precio')
const productos = require('./routes/productos')

// [valor, precio esperado] o [valor, null, motivo]
const CASOS = [
    [1000, 1000], ['1000', 1000], [' 1000,50 ', 1000.5], ['1000.5', 1000.5], [0.01, 0.01], ['.5', 0.5],
    [PRECIO_MAX, PRECIO_MAX], ['99999999,99', PRECIO_MAX], [0.1 + 0.2, 0.3],
    [undefined, null, 'obligatorio'], [null, null, 'obligatorio'], ['  ', null, 'obligatorio'],
    ['abc', null, 'no_numerico'], ['1e3', null, 'no_numerico'], ['0x10', null, 'no_numerico'],
    ['1.234,56', null, 'no_numerico'], ['Infinity', null, 'no_numerico'], [NaN, null, 'no_numerico'],
    [Infinity, null, 'no_numerico'], [true, null, 'no_numerico'], [[5], null, 'no_numerico'], [{}, null, 'no_numerico'],
    [0, null, 'no_positivo'], [-5, null, 'no_positivo'], ['-5', null, 'no_positivo'],
    [0.001, null, 'no_positivo'], ['0,001', null, 'no_positivo'], [1e-7, null, 'no_positivo'],
    [100000000, null, 'maximo'], [99999999.991, null, 'maximo'], [999999999, null, 'maximo'],
    ['999999999.99', null, 'maximo'], [1e21, null, 'maximo'],
    [10.999, null, 'decimales'], ['10,999', null, 'decimales'], ['1.500', null, 'decimales'],
    [99999999.981, null, 'decimales'],
]

let fallos = 0
function caso(nombre, fn) {
    try { fn(); console.log(`   ✓ ${nombre}`) }
    catch (error) { fallos++; console.log(`   ✗ ${nombre}: ${error.message}`) }
}

function comprobar(validar) {
    for (const [valor, precio, motivo] of CASOS) {
        const r = validar(valor)
        const detalle = `valor ${String(valor)} -> ${JSON.stringify(r)}`
        assert.strictEqual(r.ok, precio !== null, detalle)
        assert.strictEqual(r.precio, precio, detalle)
        if (precio === null) assert.strictEqual(r.mensaje, MENSAJES[motivo], detalle)
    }
}

async function main() {
    const front = await import(pathToFileURL(path.join(__dirname, '..', 'front', 'src', 'utils', 'precio.js')))

    caso('regla del back', () => comprobar(validar_precio))
    caso('regla del front: mismos resultados', () => comprobar(front.validar_precio))

    caso('importadores: redondean, sin coma y con el mismo rango', () => {
        const v = (x) => validar_precio(x, { redondear: true })
        assert.strictEqual(v(10.999).precio, 11)
        assert.strictEqual(v('1200.504').precio, 1200.5)
        assert.strictEqual(v(99999999.994).precio, PRECIO_MAX)
        for (const x of [99999999.996, 100000000, 0.001, 0, -1, '10,5', '1e3', '0x10', null])
            assert.strictEqual(v(x).ok, false, String(x))
    })

    const fila = { nombre: 'Arroz', precio: 100 }
    for (const [nombre, validar] of [
        ['formulario comunitario', productos.validar_carga_precios_formulario],
        ['negocio', (filas) => productos.validar_carga_precios_negocio({ sin_local: true, productos: filas })],
    ]) {
        caso(`${nombre}: informa cada fila inválida`, () => {
            const e = validar([fila, { nombre: 'A', precio: 100000000 }, { nombre: '', precio: '5' }, { nombre: 'B', precio: '' }])
            assert.deepStrictEqual(e.map((x) => [x.fila, x.campo, x.mensaje]), [
                [2, 'precio', MENSAJES.maximo],
                [3, 'nombre', 'El nombre del artículo es obligatorio'],
                [4, 'precio', MENSAJES.obligatorio],
            ])
            assert.deepStrictEqual(validar([fila, { nombre: '', precio: '' }]), [])
            assert.strictEqual(validar([])[0].campo, 'productos')
            assert.strictEqual(validar(Array(101).fill(fila))[0].campo, 'productos')
        })
    }

    // Los handlers deben responder sin tocar la base: cualquier acceso a knex falla el caso
    global.knex = new Proxy(function () {}, {
        apply() { throw new Error('se tocó la base') },
        get() { throw new Error('se tocó la base') },
    })
    const pedir = async (ruta, body) => {
        const capa = productos.stack.find((c) => c.route?.path === ruta)
        let salida
        const res = { status() { return this }, send(x) { salida = x } }
        await capa.route.stack.at(-1).handle({ body, session: { u_data: { id: 1 } }, header: () => undefined }, res)
        return salida
    }
    const nuevo = await pedir('/cargar_nuevo_precio', { product_id: 'p', branch_id: 1, price: 100000000 })
    const masiva = await pedir('/cargar_precios_formulario', { comercio: 'X', productos: [fila, { nombre: 'A', precio: 0.001 }] })
    caso('cargar_nuevo_precio rechaza con mensaje', () => {
        assert.strictEqual(nuevo.stat, false)
        assert.strictEqual(nuevo.error, MENSAJES.maximo)
        assert.strictEqual(nuevo.errores[0].campo, 'precio')
    })
    caso('cargar_precios_formulario no carga ninguna fila si una es inválida', () => {
        assert.strictEqual(masiva.stat, false)
        assert.strictEqual(masiva.error, `Fila 2: ${MENSAJES.no_positivo}`)
        assert.strictEqual(masiva.errores.length, 1)
    })

    console.log(fallos ? `\n${fallos} caso(s) con error` : '\nTodos los casos OK')
    process.exit(fallos ? 1 : 0)
}

main().catch((error) => {
    console.error('Error inesperado en el test:', error)
    process.exit(1)
})
