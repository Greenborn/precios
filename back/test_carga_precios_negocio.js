/**
 * Test: carga de precios del negocio (área privada /mi-negocio)
 *
 * Valida que:
 * 1. Las reglas de validación (sin base de datos) rechacen cada campo mal cargado con un mensaje concreto
 *    y acepten una carga válida, con o sin local elegido ("sin local": sin_local = true).
 * 2. Con base de datos: el local "sin local" se crea una sola vez por usuario y se reutiliza
 *    (requiere la migración 20261126130000_branch_sin_local aplicada).
 *
 * Uso: node test_carga_precios_negocio.js
 * La parte 2 se omite si no hay conexión a la base o falta la migración.
 */

require("dotenv").config({ path: '.env' })
const productos = require("./routes/productos")
const { obtener_o_crear_local_sin_local } = require("./helpers/locales_branch")

const validar = productos.validar_carga_precios_negocio
let fallos = 0
let pruebas = 0

function esperar(nombre, condicion, detalle = '') {
    pruebas++
    if (condicion) console.log(`   ✓ ${nombre}`)
    else {
        fallos++
        console.log(`   ✗ ${nombre} ${detalle}`)
    }
}

const fila_ok = { nombre: 'Arroz', marca: 'Marolio', presentacion: '1Kg', precio: 1000 }
const campo_de = (errores, campo) => errores.find((e) => e.campo === campo)

function parte_validacion() {
    console.log('\n1. Validación de la carga (sin base de datos)')

    let e = validar({ branch_id: 5, fecha: '2026-11-26', productos: [fila_ok] })
    esperar('carga válida con local elegido no tiene errores', e.length === 0, JSON.stringify(e))

    e = validar({ sin_local: true, fecha: '2026-11-26', productos: [fila_ok] })
    esperar('carga válida con "sin local" no tiene errores', e.length === 0, JSON.stringify(e))

    e = validar({ productos: [fila_ok] })
    esperar('sin local ni sin_local: error en el campo local', campo_de(e, 'local')?.mensaje === 'Elegí un local', JSON.stringify(e))

    e = validar({ branch_id: 0, productos: [fila_ok] })
    esperar('branch_id no válido: error en el campo local', !!campo_de(e, 'local'), JSON.stringify(e))

    e = validar({ sin_local: true, fecha: '26/11/2026', productos: [fila_ok] })
    esperar('fecha con formato incorrecto: "La fecha no es válida"', campo_de(e, 'fecha')?.mensaje === 'La fecha no es válida', JSON.stringify(e))

    e = validar({ sin_local: true, fecha: '2026-02-31', productos: [fila_ok] })
    esperar('fecha inexistente (31 de febrero) no es válida', !!campo_de(e, 'fecha'), JSON.stringify(e))

    e = validar({ sin_local: true, productos: [{ ...fila_ok, precio: 0 }] })
    esperar('precio 0: "El precio debe ser mayor a 0"', campo_de(e, 'precio')?.mensaje === 'El precio debe ser mayor a 0', JSON.stringify(e))

    e = validar({ sin_local: true, productos: [{ ...fila_ok, precio: '-5' }] })
    esperar('precio negativo: "El precio debe ser mayor a 0"', campo_de(e, 'precio')?.mensaje === 'El precio debe ser mayor a 0', JSON.stringify(e))

    e = validar({ sin_local: true, productos: [{ ...fila_ok, precio: 'abc' }] })
    esperar('precio no numérico: "El precio debe ser un número"', campo_de(e, 'precio')?.mensaje === 'El precio debe ser un número', JSON.stringify(e))

    e = validar({ sin_local: true, productos: [{ ...fila_ok, precio: '' }] })
    esperar('precio vacío: "El precio es obligatorio"', campo_de(e, 'precio')?.mensaje === 'El precio es obligatorio', JSON.stringify(e))

    e = validar({ sin_local: true, productos: [{ ...fila_ok, precio: '1000,50' }] })
    esperar('precio con coma decimal válido (1000,50)', e.length === 0, JSON.stringify(e))

    e = validar({ sin_local: true, productos: [{ ...fila_ok, nombre: '   ' }] })
    esperar('nombre vacío (con precio): "El nombre del artículo es obligatorio"', campo_de(e, 'nombre')?.mensaje === 'El nombre del artículo es obligatorio', JSON.stringify(e))

    e = validar({ sin_local: true, productos: [{ ...fila_ok, nombre: 'x'.repeat(201) }] })
    esperar('nombre de más de 200 caracteres rechazado', !!campo_de(e, 'nombre'), JSON.stringify(e))

    e = validar({ sin_local: true, productos: [{ ...fila_ok, marca: 'x'.repeat(101) }] })
    esperar('marca de más de 100 caracteres rechazada', !!campo_de(e, 'marca'), JSON.stringify(e))

    e = validar({ sin_local: true, productos: [{ nombre: '', marca: '', presentacion: '', precio: '' }, fila_ok] })
    esperar('fila totalmente vacía se ignora', e.length === 0, JSON.stringify(e))

    e = validar({ sin_local: true, productos: [{ nombre: '', marca: '', presentacion: '', precio: '' }] })
    esperar('sin filas con datos: error en productos', !!campo_de(e, 'productos'), JSON.stringify(e))

    e = validar({ sin_local: true, productos: [] })
    esperar('lista de productos vacía: error en productos', !!campo_de(e, 'productos'), JSON.stringify(e))

    const muchas = Array.from({ length: 101 }, () => fila_ok)
    e = validar({ sin_local: true, productos: muchas })
    esperar('más de 100 artículos rechazados', !!campo_de(e, 'productos'), JSON.stringify(e))

    e = validar({ sin_local: true, productos: [{ ...fila_ok, nombre: 'A' }, { ...fila_ok, nombre: '', precio: 0 }] })
    esperar('errores indican la fila (fila 2)', e.length === 2 && e.every((x) => x.fila === 2), JSON.stringify(e))
}

async function parte_base_de_datos() {
    console.log('\n2. Local "sin local" en base de datos')
    const usuario = { id: 987654, name: 'Test', apellido: 'Carga', es_negocio: true }
    const knex = global.knex
    try {
        await knex.raw('SELECT 1')
        const columna = await knex.schema.hasColumn('branch', 'sin_local')
        if (!columna) {
            console.log('   - Omitido: falta la migración 20261126130000_branch_sin_local')
            return
        }
    } catch (error) {
        console.log(`   - Omitido: sin conexión a la base (${error.code || error.message})`)
        return
    }

    try {
        const primero = await obtener_o_crear_local_sin_local(knex, usuario)
        const segundo = await obtener_o_crear_local_sin_local(knex, usuario)
        esperar('se crea un único local "sin local" por usuario', Number(primero.id) === Number(segundo.id))
        esperar('el local tiene sin_local = 1 y el propietario del usuario', Number(primero.sin_local) === 1 && Number(primero.propietario_id) === usuario.id)
        esperar('sin perfil: nombre genérico, sin datos del usuario', /^Comercio sin nombre [A-Z2-9]{8}$/.test(primero.branch_name), `(nombre: ${primero.branch_name})`)
        esperar('el local "sin local" no figura en la lista de locales del usuario',
            !(await knex('branch').where({ propietario_id: usuario.id }).whereNull('sin_local').first()))
    } finally {
        // Limpieza de los datos de prueba
        const filas = await knex('branch').where({ propietario_id: usuario.id, sin_local: 1 })
        for (const f of filas) {
            await knex('branch').where({ id: f.id }).del()
            if (f.enterprise_id) await knex('enterprice').where({ id: f.enterprise_id }).del()
        }
    }
}

async function main() {
    console.log('='.repeat(70))
    console.log('TEST: Carga de precios del negocio (validación y local "sin local")')
    console.log('='.repeat(70))

    parte_validacion()

    global.knex = require('knex')({
        client: 'mysql2',
        connection: {
            host: process.env.mysql_host,
            user: process.env.mysql_user,
            password: process.env.mysql_password,
            database: process.env.mysql_database,
        },
        pool: { min: 0, max: 2 },
    })
    try {
        await parte_base_de_datos()
    } finally {
        await global.knex.destroy()
    }

    console.log(`\nResultado: ${pruebas - fallos}/${pruebas} pruebas OK`)
    process.exit(fallos ? 1 : 0)
}

main().catch((error) => {
    console.error('Error inesperado en el test:', error)
    process.exit(1)
})
