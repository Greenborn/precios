/**
 * Test: validación de datos de contacto del perfil de negocio
 *
 * Cubre validarContactos() de helpers/contactos.js, usada por
 * PUT /api/negocio/mi-perfil/contactos. Es un test de funciones puras: el helper
 * sólo accede a global.knex dentro de las funciones de base de datos, así que
 * requerirlo no abre conexión y no hace falta stubbear nada.
 *
 * Uso: node back/test_contactos_negocio.js
 * Sale con código distinto de cero si algún caso falla.
 */

const assert = require('assert')
const { validarContactos, construirUrl, MAX_POR_TIPO } = require('./helpers/contactos')

let fallos = 0

function caso(nombre, fn) {
    try {
        fn()
        console.log(`OK    ${nombre}`)
    } catch (e) {
        fallos++
        console.log(`FAIL  ${nombre}`)
        console.log(`      ${e.message.split('\n').join('\n      ')}`)
    }
}

caso('tipo no permitido devuelve error', () => {
    const r = validarContactos([{ tipo: 'fax', valor: '12345678' }])
    assert.ok(r.error, 'debería devolver error')
    assert.match(r.error, /Tipo de contacto no permitido: fax/)
})

caso('tipo vacío devuelve error de tipo no permitido', () => {
    const r = validarContactos([{ tipo: '', valor: 'algo@ejemplo.com' }])
    assert.match(r.error || '', /no permitido/)
})

caso('valor vacío se omite y el tipo queda en borrar', () => {
    const r = validarContactos([{ tipo: 'email', valor: '   ' }])
    assert.ifError(r.error)
    assert.deepStrictEqual(r.guardar, [])
    assert.deepStrictEqual(r.borrar, ['email'])
})

caso('valor vacío no afecta a otros tipos válidos', () => {
    const r = validarContactos([
        { tipo: 'email', valor: '' },
        { tipo: 'instagram', valor: 'mi.negocio', visible: true },
    ])
    assert.ifError(r.error)
    assert.deepStrictEqual(r.guardar, [{ tipo: 'instagram', valor: 'mi.negocio', visible: true }])
    assert.deepStrictEqual(r.borrar, ['email'])
})

caso('valor de 256 caracteres devuelve error', () => {
    const sufijo = '@ejemplo.com'
    const valor = 'a'.repeat(256 - sufijo.length) + sufijo
    assert.strictEqual(valor.length, 256)
    const r = validarContactos([{ tipo: 'email', valor }])
    assert.ok(r.error, 'debería devolver error')
    assert.match(r.error, /demasiado largo/)
})

caso('valor de 255 caracteres no supera el tope de longitud', () => {
    // El tope es > 255, así que 255 pasa el chequeo de largo (puede fallar después por formato)
    const sufijo = '@ejemplo.com'
    const valor = 'a'.repeat(255 - sufijo.length) + sufijo
    assert.strictEqual(valor.length, 255)
    const r = validarContactos([{ tipo: 'email', valor }])
    assert.doesNotMatch(r.error || '', /demasiado largo/)
})

caso(`más de ${MAX_POR_TIPO} datos de un mismo tipo devuelve error`, () => {
    const items = Array.from({ length: MAX_POR_TIPO + 1 }, (_, i) => ({ tipo: 'email', valor: `contacto${i}@ejemplo.com` }))
    const r = validarContactos(items)
    assert.ok(r.error, 'debería devolver error')
    assert.match(r.error, /hasta 10 datos/)
})

caso(`exactamente ${MAX_POR_TIPO} datos de un mismo tipo es válido`, () => {
    const items = Array.from({ length: MAX_POR_TIPO }, (_, i) => ({ tipo: 'email', valor: `contacto${i}@ejemplo.com` }))
    const r = validarContactos(items)
    assert.ifError(r.error)
    assert.strictEqual(r.guardar.length, MAX_POR_TIPO)
})

caso('duplicado por tipo+valor devuelve error', () => {
    const r = validarContactos([
        { tipo: 'email', valor: 'hola@ejemplo.com' },
        { tipo: 'email', valor: 'HOLA@ejemplo.com' },
    ])
    assert.ok(r.error, 'debería devolver error')
    assert.match(r.error, /repetido/)
})

caso('mismo valor en tipos distintos no es duplicado', () => {
    const r = validarContactos([
        { tipo: 'email', valor: 'hola@ejemplo.com' },
        { tipo: 'google', valor: 'hola@ejemplo.com' },
    ])
    assert.ifError(r.error)
    assert.strictEqual(r.guardar.length, 2)
})

caso('payload no-array devuelve error de formato', () => {
    for (const payload of [undefined, null, {}, 'email', 42]) {
        const r = validarContactos(payload)
        assert.deepStrictEqual(r, { error: 'Formato de contactos inválido' }, `payload ${JSON.stringify(payload)}`)
    }
})

caso('caso válido devuelve guardar con visible booleano', () => {
    const r = validarContactos([
        { tipo: 'telefono', valor: '+54 9 2494 123456', visible: true },
        { tipo: 'email', valor: 'Ventas@Ejemplo.com', visible: false },
        { tipo: 'instagram', valor: '@mi.negocio' },
        { tipo: 'whatsapp', valor: '+54 9 2494 123456', visible: 'true' },
    ])
    assert.ifError(r.error)
    assert.deepStrictEqual(r.guardar, [
        { tipo: 'telefono', valor: '+5492494123456', visible: true },
        { tipo: 'email', valor: 'ventas@ejemplo.com', visible: false },
        { tipo: 'instagram', valor: 'mi.negocio', visible: false },
        { tipo: 'whatsapp', valor: '+5492494123456', visible: false },
    ])
    assert.deepStrictEqual(r.borrar, [])
})

caso('construirUrl arma el enlace del tipo', () => {
    assert.strictEqual(construirUrl('telefono', '+5492494123456'), 'tel:+5492494123456')
    assert.strictEqual(construirUrl('whatsapp', '+5492494123456'), 'https://wa.me/5492494123456')
    assert.strictEqual(construirUrl('email', 'a@b.com'), 'mailto:a@b.com')
    assert.strictEqual(construirUrl('instagram', 'mi.negocio'), 'https://www.instagram.com/mi.negocio')
    assert.strictEqual(construirUrl('tipo_inexistente', 'x'), null)
})

if (fallos > 0) {
    console.log(`\n${fallos} caso(s) fallaron`)
    process.exit(1)
}
console.log('\nTodos los casos pasaron')
