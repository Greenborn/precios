/**
 * Tests de la búsqueda por palabras (AND primero, luego OR) y paginación estable.
 * No requieren base de datos: usan el índice en memoria.
 *
 * Uso: node --test test_busqueda_ranking.js
 */
const { test, describe, before } = require('node:test')
const assert = require('node:assert/strict')
const bp = require('./controllers/busqueda_productos')

let id = 0
function add(nombre, price, branch_id = 1) {
    id++
    bp.agregar_a_buscador({
        product_name: nombre,
        product_id: 'p' + id,
        price,
        branch_id,
        date_time: new Date('2026-11-24T10:00:00Z'),
        time: new Date('2026-11-24T10:00:00Z'),
    })
}

before(() => {
    add('Leche Entera Serenísima 1L', 900)
    add('Leche Descremada La Serenísima 1L', 1000)
    add('Queso Cremoso Sancor 500g', 2000)
    add('Leche de Almendras 1L', 1500)
    add('Azúcar Ledesma 1kg', 1200)
    add('Yerba Mate Playadito 1kg', 3000)
    add('Galletitas de Agua Terrabusi', 800)
    add('Agua Mineral Villavicencio 2L', 700)
    add('Aceite de Girasol Cocinero 1.5L', 1800)
    add('Aceite de Oliva Cocinero 500ml', 2500)
})

describe('tokenizar', () => {
    test('normaliza minúsculas, tildes, espacios y guiones', () => {
        assert.deepEqual(bp.tokenizar('  AZÚCAR   Ledesma-1kg '), ['azucar', 'ledesma', '1kg'])
    })
    test('descarta palabras vacías del español', () => {
        assert.deepEqual(bp.tokenizar('leche de almendras con vainilla'), ['leche', 'almendras', 'vainilla'])
    })
    test('si todas son vacías usa el término completo', () => {
        assert.deepEqual(bp.tokenizar('de la y'), ['de', 'la', 'y'])
    })
    test('quita repetidas y limita a 5 palabras', () => {
        assert.deepEqual(bp.tokenizar('uno dos uno tres cuatro cinco seis siete'),
            ['uno', 'dos', 'tres', 'cuatro', 'cinco'])
    })
    test('término vacío devuelve lista vacía', () => {
        assert.deepEqual(bp.tokenizar('   '), [])
    })
})

describe('busqueda_ranking', () => {
    test('grupo 1 (todas las palabras) antes que grupo 2 (alguna), sin repetir', () => {
        const r = bp.busqueda_ranking('leche almendras', 'precio_asc')
        const g1 = r.filter(x => x.grupo === 1).map(x => x.name)
        const g2 = r.filter(x => x.grupo === 2).map(x => x.name)
        assert.deepEqual(g1, ['Leche de Almendras 1L'])
        assert.ok(g2.includes('Leche Entera Serenísima 1L'))
        assert.ok(!g2.includes('Leche de Almendras 1L'))
        assert.equal(r.findIndex(x => x.grupo === 2), 1)
        const nombres = r.map(x => x.name)
        assert.equal(new Set(nombres).size, nombres.length)
    })

    test('dentro del grupo OR, más coincidencias primero aunque sea más caro', () => {
        const r = bp.busqueda_ranking('aceite girasol oliva', 'precio_asc')
        // Girasol y Oliva tienen 2 coincidencias cada uno (aceite + una), Oliva/girasol no tienen las 3
        const g2 = r.filter(x => x.grupo === 2)
        for (let i = 1; i < g2.length; i++)
            assert.ok(g2[i - 1].coincidencias >= g2[i].coincidencias)
    })

    test('AND exige todas las palabras en cualquier orden', () => {
        const r = bp.busqueda_ranking('1kg yerba', 'precio_asc')
        assert.equal(r[0].name, 'Yerba Mate Playadito 1kg')
        assert.equal(r[0].grupo, 1)
    })

    test('orden por precio dentro de cada grupo', () => {
        const asc = bp.busqueda_ranking('leche', 'precio_asc').map(x => x.price)
        assert.deepEqual(asc, [...asc].sort((a, b) => a - b))
        const desc = bp.busqueda_ranking('leche', 'precio_desc').map(x => x.price)
        assert.deepEqual(desc, [...desc].sort((a, b) => b - a))
    })

    test('resultado idéntico en llamadas repetidas (orden estable)', () => {
        const a = bp.busqueda_ranking('aceite de', 'relevancia').map(x => x.product_id)
        const b = bp.busqueda_ranking('aceite de', 'relevancia').map(x => x.product_id)
        assert.deepEqual(a, b)
    })

    test('sin coincidencias devuelve vacío', () => {
        assert.deepEqual(bp.busqueda_ranking('zzzinexistente', 'precio_asc'), [])
    })
})

describe('paginación sobre el ranking', () => {
    test('recorrer todas las páginas no repite ni salta registros', () => {
        const todo = bp.busqueda_ranking('leche agua aceite', 'precio_asc')
        for (const cantidad of [1, 2, 3, 4]) {
            const visto = []
            for (let pagina = 1; (pagina - 1) * cantidad < todo.length; pagina++) {
                const desde = (pagina - 1) * cantidad
                visto.push(...todo.slice(desde, desde + cantidad).map(x => x.product_id))
            }
            assert.deepEqual(visto, todo.map(x => x.product_id), `cantidad=${cantidad}`)
        }
    })
})
