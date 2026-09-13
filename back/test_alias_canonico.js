/**
 * Test: Resolucion de nombre canonico via alias_busqueda (termino inicial -> termino final)
 *
 * Valida que:
 * 1. Un nombre definido como termino inicial se resuelve al termino final (canonico)
 * 2. Dos nombres distintos con el mismo termino final caen en el MISMO producto
 * 3. Los nombres originales quedan registrados como variantes en alias_productos
 * 4. price_today.product_name guarda el nombre canonico
 * 5. Un nombre sin definicion de alias crea su propio producto (comportamiento actual)
 * 6. El alias tiene prioridad aunque el nombre coincida con un producto existente
 *
 * Uso: node test_alias_canonico.js
 */

require("dotenv").config({ path: '.env' })
const importar_productos = require("./controllers/importar_productos")

let conn_obj = {
    host: process.env.mysql_host,
    user: process.env.mysql_user,
    password: process.env.mysql_password,
    database: process.env.mysql_database,
    supportBigNumbers: true,
    bigNumberStrings: true,
    typeCast: function (field, next) {
        if (field.type == "NEWDECIMAL") {
            var value = field.string();
            return (value === null) ? null : Number(value);
        }
        return next();
    }
}

global.knex = require('knex')({
    client: 'mysql2',
    connection: conn_obj,
    pool: { min: 0, max: 10, "propagateCreateError": false }
});

global.precios_diccio = {}
global.products_category_diccio = { by_product_id: {}, by_category_id: {} }
global.products_diccio = {}
global.products_diccio_id = {}
global.diccio_name_category = {}
global.branchs_diccio = {}
global.enterprice_diccio = {}

// Nombres de prueba con sufijo para no colisionar con datos reales
const MARCA = 'testaliascanonico'
const CANONICO = `azucar ${MARCA} - 1kg`
const VARIANTE_A = `azucar ${MARCA} 1kg`        // termino inicial A -> canonico
const VARIANTE_B = `ledesma ${MARCA} el azucar del poder 1kg` // termino inicial B -> canonico
const SIN_ALIAS = `producto ${MARCA} sin definicion`
const CATEGORIA = `categoria ${MARCA}`

let resultados = []
function check(nombre, condicion, detalle = '') {
    resultados.push({ nombre, ok: !!condicion })
    console.log(`   ${condicion ? '✓' : '✗'} ${nombre}${detalle ? ' → ' + detalle : ''}`)
}

async function limpiar_datos() {
    // Elimina restos de corridas anteriores (por nombre o alias)
    const prods = await global.knex('products').select('id').where('name', 'like', `%${MARCA}%`)
    for (const p of prods) {
        await global.knex('price_today').where('product_id', p.id).del()
        await global.knex('price').where('product_id', p.id).del()
        await global.knex('estadistica_aumento_diario').where('id_producto', p.id).del()
        await global.knex('product_category').where('product_id', p.id).del()
        await global.knex('alias_productos').where('product_id', p.id).del()
        await global.knex('products').where('id', p.id).del()
    }
    await global.knex('category').where('name', CATEGORIA).del()
    await global.knex('alias_busqueda').where('alias', 'like', `%${MARCA}%`).del()
    await global.knex('alias_productos').where('alias', 'like', `%${MARCA}%`).del()
}

async function main() {
    console.log('='.repeat(70))
    console.log('TEST: Resolucion de nombre canonico via alias_busqueda')
    console.log('='.repeat(70))

    let branch = await global.knex('branch').select('id', 'enterprise_id').first()
    if (!branch) {
        console.error('✗ No hay sucursales en la base de datos, no se puede ejecutar el test')
        process.exit(1)
    }
    // Diccionarios minimos para procesar_variacion (requeridos al cambiar precio)
    global.branchs_diccio[String(branch.id)] = { id: branch.id, enterprise_id: branch.enterprise_id }
    global.enterprice_diccio[branch.enterprise_id] = { id: branch.enterprise_id, name: 'Comercio Test' }
    // vendor_id es NOT NULL en products: usar el enterprise de la sucursal
    const VENDOR_ID = branch.enterprise_id

    console.log('\n1. Preparando datos de prueba...')
    await limpiar_datos()

    // Definiciones de alias: termino inicial -> termino final (canonico)
    await global.knex('alias_busqueda').insert([
        { alias: VARIANTE_A, termino: CANONICO },
        { alias: VARIANTE_B, termino: CANONICO },
    ])

    // Cargar diccionario global (simula recargar_alias_busqueda de server.js)
    const alias_rows = await global.knex('alias_busqueda').select()
    global.alias_busqueda = {}
    for (const r of alias_rows)
        global.alias_busqueda[r.alias.toLowerCase()] = r.termino
    console.log(`   Diccionario cargado con ${Object.keys(global.alias_busqueda).length} alias`)

    const FECHA = new Date()

    console.log('\n2. Llega la variante A (con acentos y mayusculas):')
    console.log(`   "Azúcar ${MARCA} 1Kg" → debe resolverse a "${CANONICO}"`)
    const res_a = await importar_productos.procesar_articulo({
        name: `Azúcar ${MARCA} 1Kg`,
        category_name: CATEGORIA,
        price: 1000,
        branch_id: branch.id,
        vendor_id: VENDOR_ID,
        fecha_registro: FECHA
    }, FECHA)
    check('Variante A procesada', res_a?.stat === true, JSON.stringify(res_a))

    console.log('\n3. Llega la variante B (otro nombre, mismo canonico):')
    console.log(`   "Ledesma ${MARCA} El Azúcar del Poder 1Kg" → debe resolverse a "${CANONICO}"`)
    const res_b = await importar_productos.procesar_articulo({
        name: `Ledesma ${MARCA} El Azúcar del Poder 1Kg`,
        category_name: CATEGORIA,
        price: 1050,
        branch_id: branch.id,
        vendor_id: VENDOR_ID,
        fecha_registro: FECHA
    }, FECHA)
    check('Variante B procesada', res_b?.stat === true, JSON.stringify(res_b))

    console.log('\n4. Verificaciones de unificacion...')

    const producto_canonico = await global.knex('products').where('name', CANONICO).first()
    check('Existe un producto con el nombre canonico', !!producto_canonico, CANONICO)

    const productos_creados = await global.knex('products').where('name', 'like', `%${MARCA}%`)
    check('Se creo UN solo producto para ambas variantes', productos_creados.length === 1,
        `${productos_creados.length} productos`)

    if (producto_canonico) {
        const PID = producto_canonico.id
        const alias_a = await global.knex('alias_productos').where({ alias: VARIANTE_A, product_id: PID }).first()
        const alias_b = await global.knex('alias_productos').where({ alias: VARIANTE_B, product_id: PID }).first()
        check('Variante A registrada como alias del canonico', !!alias_a)
        check('Variante B registrada como alias del canonico', !!alias_b)

        const precios = await global.knex('price').where('product_id', PID)
        check('Ambos precios guardados contra el producto canonico', precios.length === 2,
            `${precios.length} precios`)

        const precio_hoy = await global.knex('price_today').where('product_id', PID).first()
        check('price_today.product_name es el nombre canonico',
            precio_hoy?.product_name === CANONICO, precio_hoy?.product_name)
    }

    console.log('\n5. Nombre sin definicion de alias (comportamiento actual):')
    const res_c = await importar_productos.procesar_articulo({
        name: SIN_ALIAS,
        category_name: CATEGORIA,
        price: 500,
        branch_id: branch.id,
        vendor_id: VENDOR_ID,
        fecha_registro: FECHA
    }, FECHA)
    check('Articulo sin alias procesado', res_c?.stat === true)
    const producto_sin_alias = await global.knex('products').where('name', SIN_ALIAS).first()
    check('Sin alias se crea producto con el nombre que llega', !!producto_sin_alias)

    console.log('\n6. El alias tiene prioridad sobre el nombre del producto:')
    // VARIANTE_A ya existe como producto? No: existe como alias. Pero CANONICO existe como producto.
    // Si llega el nombre canonico definido a su vez como termino inicial apuntando a otro termino,
    // debe respetarse la definicion. Creamos canonico -> otro nombre:
    const OTRO = `azucar ${MARCA} renombrado`
    await global.knex('alias_busqueda').insert({ alias: CANONICO, termino: OTRO })
    global.alias_busqueda[CANONICO] = OTRO
    const res_d = await importar_productos.procesar_articulo({
        name: CANONICO,
        category_name: CATEGORIA,
        price: 1100,
        branch_id: branch.id,
        vendor_id: VENDOR_ID,
        fecha_registro: FECHA
    }, FECHA)
    check('Articulo con nombre canonico redirigido procesado', res_d?.stat === true)
    const producto_renombrado = await global.knex('products').where('name', OTRO).first()
    check('La definicion de alias manda: se uso el termino final', !!producto_renombrado, OTRO)

    console.log('\n7. Idempotencia del registro de variantes (reingreso de variante A):')
    const cant_antes = (await global.knex('alias_productos').where('alias', VARIANTE_A)).length
    await importar_productos.procesar_articulo({
        name: `Azúcar ${MARCA} 1Kg`,
        category_name: CATEGORIA,
        price: 1000,
        branch_id: branch.id,
        vendor_id: VENDOR_ID,
        fecha_registro: FECHA
    }, FECHA)
    const cant_despues = (await global.knex('alias_productos').where('alias', VARIANTE_A)).length
    check('No se duplican filas de alias (unicidad por termino inicial)',
        cant_antes === cant_despues, `${cant_antes} → ${cant_despues}`)

    console.log('\n8. Limpieza...')
    await limpiar_datos()
    console.log('   ✓ Datos de prueba eliminados')

    const fallidos = resultados.filter(r => !r.ok)
    console.log('='.repeat(70))
    console.log(`RESULTADO: ${resultados.length - fallidos.length}/${resultados.length} checks OK`)
    if (fallidos.length > 0) {
        fallidos.forEach(f => console.log(`  ✗ ${f.nombre}`))
        process.exit(1)
    }
    console.log('✓ Todos los checks pasaron')
    process.exit(0)
}

main().catch(async (error) => {
    console.error('✗ Error inesperado:', error)
    await limpiar_datos().catch(() => {})
    process.exit(1)
})
