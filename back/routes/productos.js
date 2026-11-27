const express = require('express')
require("dotenv").config({ path: '../.env' })
var router = express.Router()
module.exports = router
const axios = require('axios')
const { spawn } = require('child_process')
const uuid = require('uuid')
const busqueda_productos = require("../controllers/busqueda_productos")
const sync_cache = require("../controllers/sync_cache")
const { obtener_o_crear_local_sin_local } = require("../helpers/locales_branch")
const { sincronizar_comercio } = require("../controllers/comercios_cache")
const { validar_precio } = require("../helpers/precio")
const { validar_fecha_precio, MENSAJES_FECHA } = require('../helpers/fecha_precio')
const { es_sucursal_negocio, motivo_sucursal_negocio, registrar_descartes_csv } = require('../helpers/importacion')
const precios_negocio = require("../controllers/precios_negocio")
const { sincronizar_precio_negocio } = require("../controllers/sincronizacion_precios")
const { clave_valida } = require("../helpers/clave")
const { precios_publicos } = require("../helpers/precio_publico")

// Configuración del servicio de colas
const QUEUE_SERVICE_URL = process.env.QUEUE_SERVICE_URL || 'http://localhost:3501'

// Log de configuración al cargar el módulo
console.log('='.repeat(70))
console.log('[routes/productos] Configuración del servicio de colas:')
console.log(`  URL: ${QUEUE_SERVICE_URL}`)
console.log('  Cola principal: precios (los items deben incluir propiedad `tipo`)')
console.log(`  Variable de entorno QUEUE_SERVICE_URL: ${process.env.QUEUE_SERVICE_URL ? 'DEFINIDA' : 'NO DEFINIDA (usando default)'}`)
console.log('='.repeat(70))

// Función helper para enviar datos al servicio de colas externo
async function agregarACola(clave, data) {
    try {
        console.log(`[agregarACola] Enviando a ${QUEUE_SERVICE_URL}/add_data, clave: ${clave}`)
        const response = await axios.post(`${QUEUE_SERVICE_URL}/add_data`, { clave, data }, {
            timeout: 5000, // 5 segundos de timeout
            headers: {
                'Content-Type': 'application/json'
            }
        })
        
        if (response.data?.success) {
            console.log(`[Cola ${clave}] ✓ Item agregado exitosamente`)
            return true
        } else {
            console.error(`[Cola ${clave}] ✗ Respuesta inesperada:`, response.data)
            return false
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error(`[Cola ${clave}] ✗ ERROR: No se puede conectar al servicio en ${QUEUE_SERVICE_URL}`)
            console.error(`[Cola ${clave}] ✗ Verificar que el servicio esté corriendo en puerto 3501`)
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            console.error(`[Cola ${clave}] ✗ ERROR: Timeout al conectar con el servicio`)
        } else if (error.response) {
            console.error(`[Cola ${clave}] ✗ ERROR: Servicio respondió con status ${error.response.status}`)
            console.error(`[Cola ${clave}] ✗ Respuesta:`, error.response.data)
        } else {
            console.error(`[Cola ${clave}] ✗ ERROR al agregar item:`, error.message)
        }
        return false
    }
}

router.get('/all', async function (req, res) {
    console.log("query ", req.query)
    
    try {
        let salida = global.products_category_diccio.by_category_id[req?.query?.category_id]
        res.status(200).send({ stat: true, items: precios_publicos(salida), error: true })
    } catch (error) {
        console.log("error", error)
        res.status(200).send({ stat: false, items: [], error: true })
    }    
})

// Endpoint para regenerar la tabla price_today y los diccionarios
router.post('/regenerar_price_today', async function (req, res) {
    const KEY = req.body?.key
    try {
        
        console.log('[regenerar_price_today] Recibida petición de regeneración')
        
        if (!clave_valida(KEY)) {
            console.log('[regenerar_price_today] ✗ KEY inválida')
            res.status(200).send({ stat: false, error: "Error de autenticación" })
            return
        }
        
        // Responder inmediatamente al cliente y encolar la tarea
        res.status(200).send({ 
            stat: true, 
            message: "Elemento agregado a la cola para regenerar precios"
        })
        
        console.log('[regenerar_price_today] ✓ Respuesta enviada al cliente')
        console.log('[regenerar_price_today] Agregando tarea de tipo "regenerar_precios" a la cola...')
        try {
            const agregado = await agregarACola(idColaPrecios, { tipo: 'regenerar_precios' })
            if (agregado) {
                console.log('[regenerar_price_today] ✓ Tarea encolada correctamente')
            } else {
                console.error('[regenerar_price_today] ✗ Falló encolar la tarea')
            }
        } catch (err) {
            console.error('[regenerar_price_today] ✗ Error al llamar a agregarACola:', err)
        }
        return;
        
        
    } catch (error) {
        console.error('[regenerar_price_today] ✗ Error en endpoint:', error)
        // Si aún no se envió la respuesta
        if (!res.headersSent) {
            res.status(200).send({ stat: false, error: "Error interno, reintente luego" })
        }
    }
})


let diccio_limit = {}

router.put('/cargar_nuevo_precio', async function (req, res) {
    //console.log("data ", req.body)
    
    try {
        const AHORA = new Date()
        const PROD_ID = req.body?.product_id
        const BRANCH_ID = req.body?.branch_id
        const PRICE = req.body?.price
        if (!PROD_ID || !BRANCH_ID){
            res.status(200).send({ stat: false, error: "Error interno, reintente luego" })
            return
        }
        // Antes del límite por IP: un precio mal cargado no consume la cuota
        const validacion = validar_precio(PRICE)
        if (!validacion.ok){
            res.status(200).send({ stat: false, error: validacion.mensaje, errores: [{ campo: 'precio', mensaje: validacion.mensaje }] })
            return
        }

        let IP = req.header('x-forwarded-for')
        if (IP == undefined)
            IP = 'NO_IP'
        const PB = PROD_ID+'_'+BRANCH_ID
        if (diccio_limit[IP] === undefined){
            diccio_limit[IP] = { cantidad: 1 }
        } else {
            if (Number(AHORA.getTime()) - diccio_limit[IP]['ultimo_intento'] < 3000){
                res.status(200).send({ stat: false,  error: "Pasó muy poco tiempo del último ingreso!" })
                return
            }
        }
        diccio_limit[IP]['ultimo_intento'] = Number(new Date().getTime())
        diccio_limit[IP]['cantidad'] += 1
        if (diccio_limit[IP]['cantidad'] > 100){
            res.status(200).send({ stat: false,  error: "Superó la cantidad máxima de ingresos, reintente mañana" })
            return
        }

        if (diccio_limit[IP][PB] === undefined){
            diccio_limit[IP][PB] = 1
        } else {
            console.log("cuota excedida")
            res.status(200).send({ stat: false,  error: "Solo se permite el ingreso de un precio corregido por cada Producto y Negocio" })
            return
        }
        console.log(diccio_limit)

        const registro = await registrar_precio_usuario(
            req.session?.u_data, PROD_ID, BRANCH_ID, validacion.precio, new Date(),
            "Precios de la Gente - ingresado por formulario de corrección de precio"
        )

        if (registro)
            res.status(200).send({ stat: true })
        else
            res.status(200).send({ stat: false, error: "Error interno, reintente luego" })
    } catch (error) {
        console.log("error", error)
        res.status(200).send({ stat: false,  error: "Error interno, reintente luego" })
    }    
})

// Registra un precio cargado por un usuario: inserta en price (histórico) con los
// datos del autor, actualiza price_today y sincroniza buscador y caches en memoria.
// Solo entra a price_today si la fecha cae dentro de la ventana hoy+ayer; lo mismo para el
// buscador, salvo en locales de negocio, que se resincronizan siempre desde `price`.
// Devuelve el registro insertado o null si falla.
async function registrar_precio_usuario(usuario, product_id, branch_id, price, fecha, notas) {
    const AHORA = (fecha instanceof Date && !isNaN(fecha.getTime())) ? fecha : new Date()

    const HOY = new Date()
    let AYER = new Date(HOY)
    AYER.setHours(0,0,0,0)
    AYER.setDate(AYER.getDate() - 1)

    const insert = {
        "id": uuid.v7(),
        "product_id": product_id,
        "price": price,
        "date_time": AHORA,
        "branch_id": branch_id,
        "es_oferta": 0,
        "confiabilidad": 50,
        "url": null,
        "notas": notas,
        "user_id": usuario?.id || null,
        "user_nombre": usuario?.name || null,
        "user_apellido": usuario?.apellido || null
    }

    try {
        const trx = await global.knex.transaction()
        const nuevo_id = insert.id
        await trx('price').insert( insert )

        // Usuarios con perfil de negocio: copia duplicada en precios_negocio (misma transacción)
        if (usuario?.es_negocio) {
            await trx('precios_negocio').insert({
                "id": nuevo_id,
                "usuario_id": usuario.id,
                "product_id": product_id,
                "branch_id": branch_id,
                "price": price,
                "date_time": AHORA,
                "notas": notas,
                "creado_el": new Date(),
                "actualizado_el": new Date()
            })
        }

        // Vincular las categorías del producto con el local (branch_category).
        // Si la relación ya existe se refresca actualizado_el; si no, se crea.
        const categorias_producto = await trx('product_category')
            .where('product_id', product_id).select('category_id')
        if (categorias_producto.length) {
            const ahora = new Date()
            const categorias = [...new Set(categorias_producto.map(r => String(r.category_id)))]
            const existentes = new Set(
                (await trx('branch_category').where('branch_id', branch_id).whereIn('category_id', categorias).select('category_id'))
                    .map(r => String(r.category_id))
            )
            const nuevas = categorias.filter(c => !existentes.has(c))
                .map(c => ({ branch_id: branch_id, category_id: c, creado_el: ahora, actualizado_el: ahora }))
            if (nuevas.length) await trx('branch_category').insert(nuevas)
            if (existentes.size)
                await trx('branch_category').where('branch_id', branch_id)
                    .whereIn('category_id', [...existentes]).update({ actualizado_el: ahora })
        }

        // Limpiar price_today (misma ventana hoy+ayer)
        await trx('price_today').where('date_time', '<', AYER).del()

        // Obtener el nombre del producto para price_today
        const producto_db = await trx('products').where('id', product_id).first()
        const product_name = producto_db?.name || null

        if (AHORA >= AYER) {
            // Buscar si ya existe registro para product_id y branch_id
            let existe = await trx('price_today')
                .where({ product_id: product_id, branch_id: branch_id })
                .first()

            if (!existe) {
                await trx('price_today').insert({
                    "id": uuid.v7(),
                    "product_id": product_id,
                    "price": price,
                    "date_time": insert.date_time,
                    "branch_id": branch_id,
                    "es_oferta": 0,
                    "confiabilidad": 50,
                    "url": null,
                    "notas": notas,
                    "time": insert.date_time,
                    "product_name": product_name,
                    "price_id": nuevo_id,
                    "user_id": insert.user_id,
                    "user_nombre": insert.user_nombre,
                    "user_apellido": insert.user_apellido
                });
            } else {
                await trx('price_today')
                    .where({ product_id: product_id, branch_id: branch_id })
                    .update({
                        price: price,
                        date_time: insert.date_time,
                        es_oferta: 0,
                        confiabilidad: 50,
                        url: null,
                        notas: notas,
                        time: insert.date_time,
                        product_name: product_name,
                        price_id: nuevo_id,
                        user_id: insert.user_id,
                        user_nombre: insert.user_nombre,
                        user_apellido: insert.user_apellido
                    });
            }
        }

        await trx.commit()

        // Sincronizar estructura de búsqueda en tiempo real
        if (precios_negocio.es_negocio(branch_id)) {
            // Sin condición de ventana: vale el último de `price`, aunque la carga sea antigua
            try {
                await sincronizar_precio_negocio(product_id, branch_id)
            } catch (error) {
                // El precio ya está guardado: no se informa como fallido
                console.log("error al sincronizar precio de negocio", error)
            }
        } else if (product_name && AHORA >= AYER) {
            busqueda_productos.agregar_a_buscador({
                product_name: product_name,
                product_id: product_id,
                price: price,
                branch_id: branch_id,
                date_time: insert.date_time,
                time: insert.date_time,
                url: null,
                user_id: insert.user_id,
                user_nombre: insert.user_nombre,
                user_apellido: insert.user_apellido
            });

            // Actualizar caches de precios y productos por categoría
            await sync_cache.actualizar_precio({
                id: uuid.v7(),
                product_id: product_id,
                branch_id: branch_id,
                price: price,
                product_name: product_name,
                date_time: insert.date_time,
                time: insert.date_time,
                es_oferta: 0,
                confiabilidad: 50,
                notas: notas,
                url: null,
                price_id: nuevo_id
            });
        }

        return insert
    } catch (error) {
        console.log("error al registrar precio de usuario", error)
        return null
    }
}

// Normaliza texto igual que regenerar_diccionarios (sin diacríticos salvo ñ, minúsculas)
function normalizar_nombre_busqueda(texto) {
    return String(texto).normalize('NFD')
        .replace(/([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,"$1")
        .normalize().toLowerCase()
}

// Busca el vendor (marca) por nombre; si no existe lo crea.
// products.vendor_id es NOT NULL, por lo que sin marca se usa "Sin Marca".
async function resolver_vendor_form(marca) {
    const nombre = (String(marca || '').trim()) || 'Sin Marca'
    const existente = await global.knex('vendor')
        .whereRaw('LOWER(name) = ?', [nombre.toLowerCase()])
        .first()
    if (existente) return existente.id

    const [id] = await global.knex('vendor').insert({ name: nombre })
    return Number(id)
}

// Busca el producto por nombre exacto (diccionario en memoria / BD); la
// resolución es siempre por nombre: el alias es registro de relación y no
// redirige. Si no existe lo crea junto a su alias (unicidad por par).
async function resolver_producto_form(nombre_canonico, marca) {
    try {
        const clave = normalizar_nombre_busqueda(nombre_canonico)
        if (global.products_diccio[clave])
            return global.products_diccio[clave]

        let producto = await global.knex('products')
            .whereRaw('LOWER(name) = ?', [nombre_canonico.toLowerCase()])
            .first()
        if (producto) return producto

        const ID_NUEVO_PROD = uuid.v7()
        const nuevo = { id: ID_NUEVO_PROD, name: nombre_canonico, vendor_id: await resolver_vendor_form(marca) }
        await global.knex('products').insert( nuevo )
        await global.knex('alias_productos').insert({ alias: nombre_canonico, product_id: ID_NUEVO_PROD })

        // Actualizar diccionarios en memoria (best-effort)
        global.products_diccio[clave] = nuevo
        global.products_diccio_id[ID_NUEVO_PROD] = nuevo

        return nuevo
    } catch (error) {
        console.log('[cargar_precios_formulario] no se pudo obtener/crear el producto', error)
        return null
    }
}

// Busca la empresa por nombre (case-insensitive) y su primera sucursal;
// si no existe crea empresa+sucursal (patrón de routes/comercios.js) y
// regenera diccionarios para que el comercio quede disponible en búsquedas.
async function resolver_comercio_form(nombre_comercio) {
    try {
        const empresa = await global.knex('enterprice')
            .whereRaw('LOWER(name) = ?', [nombre_comercio.toLowerCase()])
            .first()

        if (empresa) {
            // Nunca el local "sin local" de un usuario: si el comercio no tiene otro, se crea uno
            let sucursal = await global.knex('branch')
                .where({ enterprise_id: empresa.id })
                .whereNull('sin_local')
                .orderBy('id', 'asc')
                .first()
            if (!sucursal) {
                const [bid] = await global.knex('branch').insert({
                    branch_name: empresa.name, enterprise_id: empresa.id
                })
                sucursal = { id: Number(bid) }
                await sincronizar_comercio(global.knex, { branch_id: sucursal.id })
            }
            return { enterprise_id: empresa.id, branch_id: sucursal.id }
        }

        const trx = await global.knex.transaction()
        try {
            const [eid] = await trx('enterprice').insert({ name: nombre_comercio, active: true })
            const [bid] = await trx('branch').insert({
                branch_name: nombre_comercio, enterprise_id: Number(eid)
            })
            await trx.commit()

            try {
                const { regenerar_diccionarios } = require('../server')
                await regenerar_diccionarios()
            } catch (err) {
                console.log('[cargar_precios_formulario] no se pudieron regenerar diccionarios', err)
            }

            return { enterprise_id: Number(eid), branch_id: Number(bid) }
        } catch (err) {
            await trx.rollback()
            throw err
        }
    } catch (error) {
        console.log('[cargar_precios_formulario] no se pudo obtener/crear el comercio', error)
        return null
    }
}

// Valida todas las filas del formulario comunitario antes de tocar la base.
// Devuelve [{ fila, campo, mensaje }] (vacía si todo está bien); las filas vacías se ignoran.
function validar_carga_precios_formulario(productos, fecha) {
    const errores = []
    if (fecha != null && String(fecha) !== '') {
        const r = validar_fecha_precio(fecha)
        if (!r.ok) errores.push({ campo: 'fecha', mensaje: r.mensaje })
    }
    if (productos.length > CARGA_FORMULARIO_MAX_FILAS)
        errores.push({ campo: 'productos', mensaje: `Se pueden cargar hasta ${CARGA_FORMULARIO_MAX_FILAS} artículos por envío` })
    productos.forEach((item, i) => {
        if (fila_formulario_vacia(item)) return
        if (!String(item?.nombre ?? '').trim())
            errores.push({ fila: i + 1, campo: 'nombre', mensaje: 'El nombre del artículo es obligatorio' })
        const precio = validar_precio(item?.precio)
        if (!precio.ok) errores.push({ fila: i + 1, campo: 'precio', mensaje: precio.mensaje })
    })
    if (!errores.length && productos.every(fila_formulario_vacia))
        errores.push({ campo: 'productos', mensaje: 'Debe cargar al menos un artículo con nombre y precio' })
    return errores
}

const CARGA_FORMULARIO_MAX_FILAS = 100
function fila_formulario_vacia(item) {
    return ['nombre', 'marca', 'presentacion', 'precio'].every((c) => !String(item?.[c] ?? '').trim())
}

// Carga masiva de precios desde el formulario comunitario (/carga_precio).
// Requiere sesión activa (no está declarado como público en middleware/Publico.js):
// tanto rol administrador como usuario pueden publicar. Cada precio queda registrado
// en la base de datos (price/price_today) con el nombre y apellido del autor.
router.put('/cargar_precios_formulario', async function (req, res) {
    try {
        const usuario = req.session?.u_data
        if (!usuario){
            res.status(200).send({ stat: false, code: "DO_LOGIN", text: "No hay sesion activa" })
            return
        }

        const COMERCIO = String(req.body?.comercio || '').trim()
        const PRODUCTOS = Array.isArray(req.body?.productos) ? req.body.productos : []

        // Fechas "YYYY-MM-DD" se interpretan al mediodía local para evitar el
        // corrimiento de día que produce new Date() con UTC en zona Argentina
        let FECHA = new Date()
        if (req.body?.fecha){
            const solo_fecha = String(req.body.fecha).match(/^(\d{4})-(\d{2})-(\d{2})$/)
            FECHA = solo_fecha
                ? new Date(Number(solo_fecha[1]), Number(solo_fecha[2]) - 1, Number(solo_fecha[3]), 12, 0, 0)
                : new Date(req.body.fecha)
        }
        if (isNaN(FECHA.getTime()))
            FECHA = new Date()

        if (!COMERCIO || PRODUCTOS.length == 0){
            res.status(200).send({ stat: false, error: "Faltan datos: comercio y al menos un producto son requeridos" })
            return
        }

        // Si alguna fila es inválida no se carga ninguna (y no consume la cuota por IP)
        const errores = validar_carga_precios_formulario(PRODUCTOS, req.body?.fecha)
        if (errores.length){
            const { fila, mensaje } = errores[0]
            res.status(200).send({ stat: false, error: fila ? `Fila ${fila}: ${mensaje}` : mensaje, errores })
            return
        }

        // Rate limit por IP (mismo diccionario que la corrección de precios)
        let IP = req.header('x-forwarded-for')
        if (IP == undefined)
            IP = 'NO_IP'
        if (diccio_limit[IP] === undefined){
            diccio_limit[IP] = { cantidad: 1 }
        } else {
            if (Number(new Date().getTime()) - diccio_limit[IP]['ultimo_intento'] < 3000){
                res.status(200).send({ stat: false,  error: "Pasó muy poco tiempo del último ingreso!" })
                return
            }
        }
        diccio_limit[IP]['ultimo_intento'] = Number(new Date().getTime())
        diccio_limit[IP]['cantidad'] += 1
        if (diccio_limit[IP]['cantidad'] > 100){
            res.status(200).send({ stat: false,  error: "Superó la cantidad máxima de ingresos, reintente mañana" })
            return
        }

        const datos_comercio = await resolver_comercio_form(COMERCIO)
        if (!datos_comercio){
            res.status(200).send({ stat: false, error: "No se pudo registrar el comercio, reintente luego" })
            return
        }

        let cargados = 0
        let con_error = 0
        for (let i = 0; i < PRODUCTOS.length; i++){
            const item = PRODUCTOS[i]
            if (fila_formulario_vacia(item)) continue
            const nombre_canonico = [item?.nombre, item?.marca, item?.presentacion]
                .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
            const precio = validar_precio(item.precio).precio

            const producto = await resolver_producto_form(nombre_canonico, item?.marca)
            if (!producto){
                con_error++
                continue
            }

            const registro = await registrar_precio_usuario(
                usuario, producto.id, datos_comercio.branch_id, precio, FECHA,
                "Precios de la Gente - cargado por formulario comunitario"
            )
            if (registro) cargados++
            else con_error++
        }

        if (cargados == 0)
            res.status(200).send({ stat: false, error: "No se pudo cargar ningún precio, verifique los datos e reintente" })
        else
            res.status(200).send({ stat: true, items: { cargados: cargados, con_error: con_error } })
    } catch (error) {
        console.log("error al cargar precios por formulario", error)
        res.status(200).send({ stat: false, error: "Error interno, reintente luego" })
    }
})

// Límites y validación de la carga de precios del propio negocio. El front usa las mismas reglas
// para marcar cada campo; acá se valida de nuevo antes de tocar la base.
const CARGA_NEGOCIO_MAX_FILAS = 100
const CARGA_NEGOCIO_LIMITES = { nombre: 200, marca: 100, presentacion: 100 }
const CARGA_NEGOCIO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/

// "YYYY-MM-DD" que existe en el calendario (rechaza p. ej. 2026-02-31)
function fecha_valida(texto) {
    const m = CARGA_NEGOCIO_FECHA.exec(texto)
    if (!m) return false
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])
}

// Devuelve la lista de errores [{ fila?, campo, mensaje }] (vacía si todo está bien)
function validar_carga_precios_negocio(body) {
    const errores = []
    const sin_local = body?.sin_local === true
    if (!sin_local) {
        const id = Number(body?.branch_id)
        if (!(Number.isInteger(id) && id > 0))
            errores.push({ campo: 'local', mensaje: 'Elegí un local' })
    }

    if (body?.fecha != null && String(body.fecha) !== '') {
        const fecha = String(body.fecha)
        const r = fecha_valida(fecha) ? validar_fecha_precio(fecha) : { ok: false, mensaje: MENSAJES_FECHA.no_valida }
        if (!r.ok) errores.push({ campo: 'fecha', mensaje: r.mensaje })
    }

    const productos = Array.isArray(body?.productos) ? body.productos : []
    if (productos.length > CARGA_NEGOCIO_MAX_FILAS)
        errores.push({ campo: 'productos', mensaje: `Se pueden cargar hasta ${CARGA_NEGOCIO_MAX_FILAS} artículos por envío` })

    productos.forEach((item, i) => {
        const fila = i + 1
        const nombre = String(item?.nombre ?? '').trim()
        const marca = String(item?.marca ?? '').trim()
        const presentacion = String(item?.presentacion ?? '').trim()
        const precio_crudo = item?.precio == null ? '' : String(item.precio).trim()
        // Fila totalmente vacía: se ignora (igual que en el front)
        if (!nombre && !marca && !presentacion && precio_crudo === '') return

        if (!nombre) errores.push({ fila, campo: 'nombre', mensaje: 'El nombre del artículo es obligatorio' })
        else if (nombre.length > CARGA_NEGOCIO_LIMITES.nombre) errores.push({ fila, campo: 'nombre', mensaje: `El nombre no puede superar los ${CARGA_NEGOCIO_LIMITES.nombre} caracteres` })
        if (marca.length > CARGA_NEGOCIO_LIMITES.marca) errores.push({ fila, campo: 'marca', mensaje: `La marca no puede superar los ${CARGA_NEGOCIO_LIMITES.marca} caracteres` })
        if (presentacion.length > CARGA_NEGOCIO_LIMITES.presentacion) errores.push({ fila, campo: 'presentacion', mensaje: `La presentación no puede superar los ${CARGA_NEGOCIO_LIMITES.presentacion} caracteres` })

        const precio = validar_precio(item?.precio)
        if (!precio.ok) errores.push({ fila, campo: 'precio', mensaje: precio.mensaje })
    })

    // Sin filas con datos no hay nada que cargar
    const hay_filas = productos.some((item) => String(item?.nombre ?? '').trim() || String(item?.precio ?? '').trim())
    if (!hay_filas && !errores.length) errores.push({ campo: 'productos', mensaje: 'Debe cargar al menos un artículo con nombre y precio' })
    return errores
}

// Carga de precios del propio negocio (área privada /mi-negocio). A diferencia de
// cargar_precios_formulario, el local se toma por id y debe pertenecer al usuario
// autenticado, o bien se usa el local "sin local" del usuario (se crea la primera vez).
// Devuelve el detalle por ítem (product_id) para adjuntar fotos y el branch_id usado.
router.put('/cargar_precios_negocio', async function (req, res) {
    try {
        const usuario = req.session?.u_data
        if (!usuario){
            res.status(200).send({ stat: false, code: "DO_LOGIN", text: "No hay sesion activa" })
            return
        }
        if (!usuario.es_negocio){
            res.status(200).send({ stat: false, code: "NO_NEGOCIO", text: "Tu cuenta no está configurada como negocio" })
            return
        }

        const errores = validar_carga_precios_negocio(req.body)
        if (errores.length){
            res.status(400).send({ stat: false, error: errores[0].mensaje, errores })
            return
        }

        let branch
        if (req.body?.sin_local === true){
            branch = await obtener_o_crear_local_sin_local(global.knex, usuario)
        } else {
            const BRANCH_ID = Number(req.body.branch_id)
            const local = await global.knex('branch').where({ id: BRANCH_ID }).first()
            if (!local || String(local.propietario_id) !== String(usuario.id)){
                res.status(400).send({ stat: false, error: "El local no pertenece a tu cuenta", errores: [{ campo: 'local', mensaje: 'El local no pertenece a tu cuenta' }] })
                return
            }
            branch = local
        }
        const BRANCH_ID = Number(branch.id)

        const PRODUCTOS = req.body.productos
            .filter((item) => String(item?.nombre ?? '').trim() || String(item?.precio ?? '').trim())

        // Fecha "YYYY-MM-DD" al mediodía local (mismo criterio que cargar_precios_formulario)
        let FECHA = new Date()
        if (req.body?.fecha){
            const solo_fecha = String(req.body.fecha).match(/^(\d{4})-(\d{2})-(\d{2})$/)
            FECHA = solo_fecha
                ? new Date(Number(solo_fecha[1]), Number(solo_fecha[2]) - 1, Number(solo_fecha[3]), 12, 0, 0)
                : new Date(req.body.fecha)
        }
        if (isNaN(FECHA.getTime()))
            FECHA = new Date()

        const detalle = []
        for (let i = 0; i < PRODUCTOS.length; i++){
            const item = PRODUCTOS[i]
            const nombre_canonico = [item?.nombre, item?.marca, item?.presentacion]
                .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
            const precio = validar_precio(item?.precio).precio

            const producto = await resolver_producto_form(nombre_canonico, item?.marca)
            if (!producto){
                detalle.push({ indice: i, ok: false, error: "No se pudo registrar el producto" })
                continue
            }

            const registro = await registrar_precio_usuario(
                usuario, producto.id, BRANCH_ID, precio, FECHA,
                "Precios del negocio - cargado desde el área privada"
            )
            detalle.push({ indice: i, ok: !!registro, product_id: producto.id, error: registro ? null : "No se pudo guardar el precio" })
        }

        const cargados = detalle.filter(d => d.ok).length
        const items = { cargados, con_error: detalle.length - cargados, detalle, branch_id: BRANCH_ID }
        if (cargados == 0)
            res.status(200).send({ stat: false, error: "No se pudo cargar ningún precio, verifique los datos e reintente", items })
        else
            res.status(200).send({ stat: true, items })
    } catch (error) {
        console.error("error al cargar precios del negocio", error)
        res.status(200).send({ stat: false, error: "Error interno, reintente luego" })
    }
})

// Expuesto para test_carga_precios_negocio.js (validación sin base de datos)
router.validar_carga_precios_negocio = validar_carga_precios_negocio
// Expuesto para test_carga_comunitaria.js
router.resolver_comercio_form = resolver_comercio_form
router.registrar_precio_usuario = registrar_precio_usuario
// Expuesto para test_validacion_precio.js
router.validar_carga_precios_formulario = validar_carga_precios_formulario

// Identificador único de cola (productos + ofertas)
// cada item llevará un campo `tipo` para distinguir su procesamiento
const idColaPrecios = "precios"  // cola unica; el tipo va en el item: 'producto', 'oferta', 'regenerar_precios'

const MD5 = function(d){var r = M(V(Y(X(d),8*d.length)));return r.toLowerCase()};function M(d){for(var _,m="0123456789ABCDEF",f="",r=0;r<d.length;r++)_=d.charCodeAt(r),f+=m.charAt(_>>>4&15)+m.charAt(15&_);return f}function X(d){for(var _=Array(d.length>>2),m=0;m<_.length;m++)_[m]=0;for(m=0;m<8*d.length;m+=8)_[m>>5]|=(255&d.charCodeAt(m/8))<<m%32;return _}function V(d){for(var _="",m=0;m<32*d.length;m+=8)_+=String.fromCharCode(d[m>>5]>>>m%32&255);return _}function Y(d,_){d[_>>5]|=128<<_%32,d[14+(_+64>>>9<<4)]=_;for(var m=1732584193,f=-271733879,r=-1732584194,i=271733878,n=0;n<d.length;n+=16){var h=m,t=f,g=r,e=i;f=md5_ii(f=md5_ii(f=md5_ii(f=md5_ii(f=md5_hh(f=md5_hh(f=md5_hh(f=md5_hh(f=md5_gg(f=md5_gg(f=md5_gg(f=md5_gg(f=md5_ff(f=md5_ff(f=md5_ff(f=md5_ff(f,r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+0],7,-680876936),f,r,d[n+1],12,-389564586),m,f,d[n+2],17,606105819),i,m,d[n+3],22,-1044525330),r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+4],7,-176418897),f,r,d[n+5],12,1200080426),m,f,d[n+6],17,-1473231341),i,m,d[n+7],22,-45705983),r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+8],7,1770035416),f,r,d[n+9],12,-1958414417),m,f,d[n+10],17,-42063),i,m,d[n+11],22,-1990404162),r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+12],7,1804603682),f,r,d[n+13],12,-40341101),m,f,d[n+14],17,-1502002290),i,m,d[n+15],22,1236535329),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+1],5,-165796510),f,r,d[n+6],9,-1069501632),m,f,d[n+11],14,643717713),i,m,d[n+0],20,-373897302),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+5],5,-701558691),f,r,d[n+10],9,38016083),m,f,d[n+15],14,-660478335),i,m,d[n+4],20,-405537848),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+9],5,568446438),f,r,d[n+14],9,-1019803690),m,f,d[n+3],14,-187363961),i,m,d[n+8],20,1163531501),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+13],5,-1444681467),f,r,d[n+2],9,-51403784),m,f,d[n+7],14,1735328473),i,m,d[n+12],20,-1926607734),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+5],4,-378558),f,r,d[n+8],11,-2022574463),m,f,d[n+11],16,1839030562),i,m,d[n+14],23,-35309556),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+1],4,-1530992060),f,r,d[n+4],11,1272893353),m,f,d[n+7],16,-155497632),i,m,d[n+10],23,-1094730640),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+13],4,681279174),f,r,d[n+0],11,-358537222),m,f,d[n+3],16,-722521979),i,m,d[n+6],23,76029189),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+9],4,-640364487),f,r,d[n+12],11,-421815835),m,f,d[n+15],16,530742520),i,m,d[n+2],23,-995338651),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+0],6,-198630844),f,r,d[n+7],10,1126891415),m,f,d[n+14],15,-1416354905),i,m,d[n+5],21,-57434055),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+12],6,1700485571),f,r,d[n+3],10,-1894986606),m,f,d[n+10],15,-1051523),i,m,d[n+1],21,-2054922799),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+8],6,1873313359),f,r,d[n+15],10,-30611744),m,f,d[n+6],15,-1560198380),i,m,d[n+13],21,1309151649),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+4],6,-145523070),f,r,d[n+11],10,-1120210379),m,f,d[n+2],15,718787259),i,m,d[n+9],21,-343485551),m=safe_add(m,h),f=safe_add(f,t),r=safe_add(r,g),i=safe_add(i,e)}return Array(m,f,r,i)}function md5_cmn(d,_,m,f,r,i){return safe_add(bit_rol(safe_add(safe_add(_,d),safe_add(f,i)),r),m)}function md5_ff(d,_,m,f,r,i,n){return md5_cmn(_&m|~_&f,d,_,r,i,n)}function md5_gg(d,_,m,f,r,i,n){return md5_cmn(_&f|m&~f,d,_,r,i,n)}function md5_hh(d,_,m,f,r,i,n){return md5_cmn(_^m^f,d,_,r,i,n)}function md5_ii(d,_,m,f,r,i,n){return md5_cmn(m^(_|~f),d,_,r,i,n)}function safe_add(d,_){var m=(65535&d)+(65535&_);return(d>>16)+(_>>16)+(m>>16)<<16|65535&m}function bit_rol(d,_){return d<<_|d>>>32-_}

// ya no se usa clave separada para ofertas
// const idColaOfertas = "ofertas"

router.post('/importar_oferta', async function (req, res) {
    const KEY = req.body?.key
    try {
        const ARR_IMPORTA = req.body?.lst_importa

        console.log(`[importar_oferta] Recibida petición con ${ARR_IMPORTA?.length || 0} ofertas`)

        if (!clave_valida(KEY)){
            console.log('[importar_oferta] ✗ KEY inválida')
            res.status(200).send({ stat: false,  error: "Error interno, reintente luego_" })
            return
        }

        if (!Array.isArray(ARR_IMPORTA) || ARR_IMPORTA.length === 0) {
            console.log('[importar_oferta] ✗ No hay items para importar')
            res.status(200).send({ stat: false, error: "No hay items para importar" })
            return
        }

        // Fechas posteriores a mañana: se descartan antes de encolar
        const rechazados = []
        const validas = ARR_IMPORTA.filter(i => {
            const fecha = i?.fecha_registro ? validar_fecha_precio(i.fecha_registro) : { ok: true }
            if (!fecha.ok) rechazados.push({ item: i, motivo: `${fecha.mensaje} (${String(i.fecha_registro)})` })
            return fecha.ok
        })
        if (rechazados.length) registrar_descartes_csv(rechazados, 'oferta')

        console.log(`[importar_oferta] Enviando ${validas.length} ofertas al servicio de colas...`)

        // Agregar items a la cola externa (cola única)
        let agregados = 0;
        for (let index = 0; index < validas.length; index++) {
            const item = { ...validas[index], tipo: 'oferta' } // marcar tipo de elemento
            const success = await agregarACola(idColaPrecios, item)
            if (success) agregados++;
        }
        
        console.log(`[importar_oferta] ✓ Completado: ${agregados}/${ARR_IMPORTA.length} ofertas enviadas`)
        return res.status(200).send({ stat: true, count: agregados, rechazados: rechazados.length })
    } catch (error) {
        console.log("error", error)
        res.status(200).send({ stat: false,  error: "Error interno, reintente luego" })
    }
})

router.post('/importar_alquiler', async function (req, res) {
    console.log("data ", req.body)
    const KEY = req.body?.key
    try {
        if (!clave_valida(KEY)){
            res.status(200).send({ stat: false,  error: "Error interno, reintente luego" })
            return
        }
        let es_nuevo = 0
        let suma_valores_props = ""
        let keys_ = Object.keys(req.body?.especificaciones)
        for (let i=0; i < keys_.length; i++)
            suma_valores_props += String(req.body?.especificaciones[keys_[i]]) + "|"
        
        //El hash se usa para diferenciar las propiedades unas de otras
        let suma_campos = (req.body?.titulo + req.body?.locador + suma_valores_props).replace(/\W/g, '')
        let hash = MD5( suma_campos )

        if (hash !== req.body?.hash){
            console.log("No coinciden los hash!")
            res.status(200).send({ stat: false,  error: "Error interno, reintente luego" })
            return
        }
        let HOY = new Date()
        //HOY.setHours(0,0,0,1)

        let trx = await global.knex.transaction()
        let existe_ = await global.knex('propiedades_alquiler').select().where('hash', hash).first()
        if (!existe_){
            es_nuevo = 1
            const insert = {
                "titulo": req.body.titulo,
                "locador": req.body.locador,
                "url": req.body.url,
                "precio": req.body.precio,
                "moneda": req.body.moneda,
                "especificaciones": req.body.especificaciones,
                "hash": hash,
                "ultima_fecha": HOY
            }
            
            let res_nueva = await trx('propiedades_alquiler').insert( insert )
            if (res_nueva){
                console.log(res_nueva)
                await trx('historico_precios_alquiler').insert( {
                    'id_propiedad': res_nueva[0],
                    'precio': req.body.precio,
                    'fecha': HOY
                } )
            }
        } else {
            console.log("existe")

            let reg_historico_precio = await global.knex('historico_precios_alquiler').select()
                .where({'id_propiedad': existe_.id, 'precio': req.body.precio }).first()
            if (!reg_historico_precio){
                es_nuevo = 2
                await trx('historico_precios_alquiler').insert( {
                    'id_propiedad': existe_.id,
                    'precio': req.body.precio,
                    'fecha': HOY
                } )
            }

            await trx('propiedades_alquiler').update( {
                "precio": req.body.precio,
                "moneda": req.body.moneda,
                "ultima_fecha": HOY
            }).where('id', existe_.id)
        }

        await trx.commit()
        res.status(200).send({ stat: true, nuevo: es_nuevo })
        
    } catch (error) {
        console.log("error", error)
        res.status(200).send({ stat: false,  error: "Error interno, reintente luego" })
    }
})

// Endpoint para importar productos y llenar la cola de procesamiento
// El endpoint /importar utiliza el servicio externo de colas
router.post('/importar', async function (req, res) {
    const KEY = req.body?.key;
    try {
        const ARR_IMPORTA = req.body?.lst_importa;

        console.log(`[importar] Recibida petición con ${ARR_IMPORTA?.length || 0} productos`)

        if (!clave_valida(KEY)) {
            console.log('[importar] ✗ KEY inválida')
            res.status(200).send({ stat: false, error: "Error interno, reintente luego_" });
            return;
        }
        if (!Array.isArray(ARR_IMPORTA) || ARR_IMPORTA.length === 0) {
            console.log('[importar] ✗ No hay items para importar')
            res.status(200).send({ stat: false, error: "No hay items para importar" });
            return;
        }

        console.log(`[importar] Enviando ${ARR_IMPORTA.length} productos al servicio de colas...`)
        console.log(`[importar] URL del servicio: ${QUEUE_SERVICE_URL}`)

        // Validar que las sucursales existan: un branch_id inexistente rompe la FK
        // de price_today y bloquea la cola del worker. Se rechaza y se deja en CSV.
        const ids = [...new Set(ARR_IMPORTA.map(i => i && i.branch_id).filter(Boolean))]
        const existentes = new Map(
            ids.length ? (await global.knex('branch').whereIn('id', ids).select('id', 'propietario_id')).map(r => [String(r.id), r]) : []
        )
        const rechazados = []
        const validos = ARR_IMPORTA.filter(i => {
            if (i && i.branch_id && existentes.has(String(i.branch_id))) {
                if (es_sucursal_negocio(existentes.get(String(i.branch_id)))) {
                    rechazados.push({ item: i, motivo: motivo_sucursal_negocio(i.branch_id) })
                    return false
                }
                // Sin fecha_registro la rechaza el worker
                if (i.fecha_registro) {
                    const fecha = validar_fecha_precio(i.fecha_registro)
                    if (!fecha.ok) {
                        rechazados.push({ item: i, motivo: `${fecha.mensaje} (${String(i.fecha_registro)})` })
                        return false
                    }
                }
                // Un precio fuera de price.price (decimal(10,2)) fallaría en el worker
                const precio = validar_precio(i.price, { redondear: true })
                if (precio.ok) return true
                rechazados.push({ item: i, motivo: `precio inválido (${String(i.price)}): ${precio.mensaje}` })
                return false
            }
            rechazados.push({
                item: i,
                motivo: i && i.branch_id ? `branch_id ${i.branch_id} no existe en branch` : 'branch_id es obligatorio'
            })
            return false
        })
        if (rechazados.length) {
            registrar_descartes_csv(rechazados)
            console.log(`[importar] ✗ ${rechazados.length} items rechazados (branch_id, sucursal de negocio, fecha o precio)`)
        }

        // Agregar items a la cola externa (cola única)
        let agregados = 0;
        for (const rawItem of validos) {
            const item = { ...rawItem, tipo: 'producto' } // incluir tipo explícito
            const success = await agregarACola(idColaPrecios, item);
            if (success) agregados++;
        }
        
        console.log(`[importar] ✓ Completado: ${agregados}/${ARR_IMPORTA.length} productos enviados`);
        res.status(200).send({ stat: true, count: agregados, rechazados: rechazados.length });
        return;
    } catch (error) {
        console.log("[importar] error", error);
        res.status(200).send({ stat: false, error: "Error interno, reintente luego" });
    }
});