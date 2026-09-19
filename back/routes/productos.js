const express = require('express')
require("dotenv").config({ path: '../.env' })
var router = express.Router()
module.exports = router
const axios = require('axios')
const { spawn } = require('child_process')
const path = require('path')
const uuid = require('uuid')
const busqueda_productos = require("../controllers/busqueda_productos")
const sync_cache = require("../controllers/sync_cache")

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
        res.status(200).send({ stat: true, items: salida, error: true })
    } catch (error) {
        console.log("error", error)
        res.status(200).send({ stat: false, items: [], error: true })
    }    
})

// Endpoint para regenerar la tabla price_today y los diccionarios
router.post('/regenerar_price_today', async function (req, res) {
    const KEY = req.body?.key
    try {
        const KEY_VALID = process.env.KEY_INT
        
        console.log('[regenerar_price_today] Recibida petición de regeneración')
        
        if (KEY != KEY_VALID) {
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
        if (!PROD_ID || !BRANCH_ID || !PRICE){
            res.status(200).send({ stat: false, error: "Error interno, reintente luego" })
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
            req.session?.u_data, PROD_ID, BRANCH_ID, PRICE, new Date(),
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
// Solo entra a price_today/buscador si la fecha cae dentro de la ventana hoy+ayer.
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
        if (product_name && AHORA >= AYER) {
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

// Busca el producto por diccionario en memoria / alias / nombre exacto;
// si no existe lo crea junto a su alias (patrón de importar_productos.get_producto)
async function resolver_producto_form(nombre_canonico, marca) {
    try {
        const clave = normalizar_nombre_busqueda(nombre_canonico)
        if (global.products_diccio[clave])
            return global.products_diccio[clave]

        let producto = await global.knex('alias_productos')
            .join('products', 'products.id', 'alias_productos.product_id')
            .whereRaw('LOWER(alias_productos.alias) = ?', [nombre_canonico.toLowerCase()])
            .first()
        if (producto) return producto

        producto = await global.knex('products')
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
            let sucursal = await global.knex('branch')
                .where({ enterprise_id: empresa.id })
                .orderBy('id', 'asc')
                .first()
            if (!sucursal) {
                const [bid] = await global.knex('branch').insert({
                    branch_name: empresa.name, enterprise_id: empresa.id
                })
                sucursal = { id: Number(bid) }
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
        for (let i = 0; i < PRODUCTOS.length && i < 100; i++){
            const item = PRODUCTOS[i]
            const nombre_canonico = [item?.nombre, item?.marca, item?.presentacion]
                .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
            const precio = Number(item?.precio)

            if (!nombre_canonico || !precio || precio <= 0){
                con_error++
                continue
            }

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

// Identificador único de cola (productos + ofertas)
// cada item llevará un campo `tipo` para distinguir su procesamiento
const idColaPrecios = "precios"  // valores posibles: 'producto','oferta','accion', etc.

const TABLAS = {
    "ml": {
        "articulos": "articulos_mercado_libre",
        "precios": "precios_articulos_mercado_libre"
    },
    "region20": {
        "articulos": "articulos_region_20",
        "precios": "precios_articulos_region_20"
    }
}

async function procesa_art_plataforma(DATA){
    let HOY = new Date()
    HOY.setHours(0,0,0,1)
    // HOY aquí es UTC, para inserts y updates usar new Date() directamente
    
    let existe = await global.knex(TABLAS[DATA.plataforma].articulos).select()
                    .where('url', DATA.url).first()

    if (existe){
        await global.knex(TABLAS[DATA.plataforma].articulos).update({
            nombre: DATA.name,
            precio: DATA?.currency === 'pesos' ? DATA.price : null,
            precio_dolares: DATA?.currency === 'dolares' ? DATA.price : null,
            categoria: DATA.category_name,
            fecha_actualizacion: new Date()
        }).where('url', DATA.url)

        let ultimo_precio = await global.knex(TABLAS[DATA.plataforma].precios).select()
                                .where('id_articulo', existe.id)
                                .orderBy('id', 'desc').first()
        if (!ultimo_precio){
            await global.knex(TABLAS[DATA.plataforma].precios).insert({
                id_articulo: existe.id,
                precio: DATA?.currency === 'pesos' ? DATA.price : null,
                precio_dolares: DATA?.currency === 'dolares' ? DATA.price : null,
                fecha: new Date()
            })
            console.log("precio registrado")
        } else {
            if ((ultimo_precio.precio != DATA.price && ultimo_precio.precio !== null )
                || (ultimo_precio.precio_dolares != DATA.price && ultimo_precio.precio_dolares !== null)){
                await global.knex(TABLAS[DATA.plataforma].precios).insert({
                    id_articulo: existe.id,
                    precio: DATA?.currency === 'pesos' ? DATA.price : null,
                    precio_dolares: DATA?.currency === 'dolares' ? DATA.price : null,
                    fecha: new Date()
                })
                console.log("precio actualizado")
            }
        }
    } else {
        await global.knex(TABLAS[DATA.plataforma].articulos).insert({
            nombre: DATA.name,
            precio: DATA?.currency === 'pesos' ? DATA.price : null,
            precio_dolares: DATA?.currency === 'dolares' ? DATA.price : null,
            categoria: DATA.category_name,
            fecha_actualizacion: new Date(),
            fecha_creacion: new Date(),
            url: DATA.url
        }).where('url', DATA.url)
        .then(async function (id_nuevo) {
            console.log('id_nuevo',id_nuevo)
            await global.knex(TABLAS[DATA.plataforma].precios).insert({
                id_articulo: id_nuevo,
                precio: DATA?.currency === 'pesos' ? DATA.price : null,
                precio_dolares: DATA?.currency === 'dolares' ? DATA.price : null,
                fecha: new Date()
            })
        })
        
    }
    return
}

router.post('/importar_articulo_plataforma', async function (req, res) {
    //console.log("data ", req.body)
    const KEY = req.body?.key
    const DATA = req.body
    try {
        /*const KEY_VALID = process.env.KEY_INT
        if (KEY != KEY_VALID){
            res.status(200).send({ stat: false,  error: "Error interno, reintente luego_" })
            return
        }*/
        
        let proms_arr = []
        for (let i=0; i < DATA.length; i++)
            proms_arr.push(procesa_art_plataforma(DATA[i]))
        
        let res_procesa = await Promise.all(proms_arr)
        if (res_procesa)
            console.log("res_procesa", res_procesa)
        
        res.status(200).send({ stat: true })
        return
        
    } catch (error) {
        console.log("error", error)
        res.status(200).send({ stat: false,  error: "Error interno, reintente luego" })
    }    
})

const MD5 = function(d){var r = M(V(Y(X(d),8*d.length)));return r.toLowerCase()};function M(d){for(var _,m="0123456789ABCDEF",f="",r=0;r<d.length;r++)_=d.charCodeAt(r),f+=m.charAt(_>>>4&15)+m.charAt(15&_);return f}function X(d){for(var _=Array(d.length>>2),m=0;m<_.length;m++)_[m]=0;for(m=0;m<8*d.length;m+=8)_[m>>5]|=(255&d.charCodeAt(m/8))<<m%32;return _}function V(d){for(var _="",m=0;m<32*d.length;m+=8)_+=String.fromCharCode(d[m>>5]>>>m%32&255);return _}function Y(d,_){d[_>>5]|=128<<_%32,d[14+(_+64>>>9<<4)]=_;for(var m=1732584193,f=-271733879,r=-1732584194,i=271733878,n=0;n<d.length;n+=16){var h=m,t=f,g=r,e=i;f=md5_ii(f=md5_ii(f=md5_ii(f=md5_ii(f=md5_hh(f=md5_hh(f=md5_hh(f=md5_hh(f=md5_gg(f=md5_gg(f=md5_gg(f=md5_gg(f=md5_ff(f=md5_ff(f=md5_ff(f=md5_ff(f,r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+0],7,-680876936),f,r,d[n+1],12,-389564586),m,f,d[n+2],17,606105819),i,m,d[n+3],22,-1044525330),r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+4],7,-176418897),f,r,d[n+5],12,1200080426),m,f,d[n+6],17,-1473231341),i,m,d[n+7],22,-45705983),r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+8],7,1770035416),f,r,d[n+9],12,-1958414417),m,f,d[n+10],17,-42063),i,m,d[n+11],22,-1990404162),r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+12],7,1804603682),f,r,d[n+13],12,-40341101),m,f,d[n+14],17,-1502002290),i,m,d[n+15],22,1236535329),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+1],5,-165796510),f,r,d[n+6],9,-1069501632),m,f,d[n+11],14,643717713),i,m,d[n+0],20,-373897302),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+5],5,-701558691),f,r,d[n+10],9,38016083),m,f,d[n+15],14,-660478335),i,m,d[n+4],20,-405537848),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+9],5,568446438),f,r,d[n+14],9,-1019803690),m,f,d[n+3],14,-187363961),i,m,d[n+8],20,1163531501),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+13],5,-1444681467),f,r,d[n+2],9,-51403784),m,f,d[n+7],14,1735328473),i,m,d[n+12],20,-1926607734),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+5],4,-378558),f,r,d[n+8],11,-2022574463),m,f,d[n+11],16,1839030562),i,m,d[n+14],23,-35309556),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+1],4,-1530992060),f,r,d[n+4],11,1272893353),m,f,d[n+7],16,-155497632),i,m,d[n+10],23,-1094730640),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+13],4,681279174),f,r,d[n+0],11,-358537222),m,f,d[n+3],16,-722521979),i,m,d[n+6],23,76029189),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+9],4,-640364487),f,r,d[n+12],11,-421815835),m,f,d[n+15],16,530742520),i,m,d[n+2],23,-995338651),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+0],6,-198630844),f,r,d[n+7],10,1126891415),m,f,d[n+14],15,-1416354905),i,m,d[n+5],21,-57434055),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+12],6,1700485571),f,r,d[n+3],10,-1894986606),m,f,d[n+10],15,-1051523),i,m,d[n+1],21,-2054922799),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+8],6,1873313359),f,r,d[n+15],10,-30611744),m,f,d[n+6],15,-1560198380),i,m,d[n+13],21,1309151649),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+4],6,-145523070),f,r,d[n+11],10,-1120210379),m,f,d[n+2],15,718787259),i,m,d[n+9],21,-343485551),m=safe_add(m,h),f=safe_add(f,t),r=safe_add(r,g),i=safe_add(i,e)}return Array(m,f,r,i)}function md5_cmn(d,_,m,f,r,i){return safe_add(bit_rol(safe_add(safe_add(_,d),safe_add(f,i)),r),m)}function md5_ff(d,_,m,f,r,i,n){return md5_cmn(_&m|~_&f,d,_,r,i,n)}function md5_gg(d,_,m,f,r,i,n){return md5_cmn(_&f|m&~f,d,_,r,i,n)}function md5_hh(d,_,m,f,r,i,n){return md5_cmn(_^m^f,d,_,r,i,n)}function md5_ii(d,_,m,f,r,i,n){return md5_cmn(m^(_|~f),d,_,r,i,n)}function safe_add(d,_){var m=(65535&d)+(65535&_);return(d>>16)+(_>>16)+(m>>16)<<16|65535&m}function bit_rol(d,_){return d<<_|d>>>32-_}

// ya no se usa clave separada para ofertas
// const idColaOfertas = "ofertas"

router.post('/importar_oferta', async function (req, res) {
    const KEY = req.body?.key
    try {
        const KEY_VALID = process.env.KEY_INT
        const ARR_IMPORTA = req.body?.lst_importa

        console.log(`[importar_oferta] Recibida petición con ${ARR_IMPORTA?.length || 0} ofertas`)

        if (KEY != KEY_VALID){
            console.log('[importar_oferta] ✗ KEY inválida')
            res.status(200).send({ stat: false,  error: "Error interno, reintente luego_" })
            return
        }

        if (!Array.isArray(ARR_IMPORTA) || ARR_IMPORTA.length === 0) {
            console.log('[importar_oferta] ✗ No hay items para importar')
            res.status(200).send({ stat: false, error: "No hay items para importar" })
            return
        }

        console.log(`[importar_oferta] Enviando ${ARR_IMPORTA.length} ofertas al servicio de colas...`)

        // Agregar items a la cola externa (cola única)
        let agregados = 0;
        for (let index = 0; index < ARR_IMPORTA.length; index++) {
            const item = { ...ARR_IMPORTA[index], tipo: 'oferta' } // marcar tipo de elemento
            const success = await agregarACola(idColaPrecios, item)
            if (success) agregados++;
        }
        
        console.log(`[importar_oferta] ✓ Completado: ${agregados}/${ARR_IMPORTA.length} ofertas enviadas`)
        return res.status(200).send({ stat: true, count: agregados })
    } catch (error) {
        console.log("error", error)
        res.status(200).send({ stat: false,  error: "Error interno, reintente luego" })
    }
})

router.post('/importar_alquiler', async function (req, res) {
    console.log("data ", req.body)
    const KEY = req.body?.key
    try {
        const KEY_VALID = process.env.KEY_INT
        if (KEY != KEY_VALID){
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
        const KEY_VALID = process.env.KEY_INT;
        const ARR_IMPORTA = req.body?.lst_importa;

        console.log(`[importar] Recibida petición con ${ARR_IMPORTA?.length || 0} productos`)

        if (KEY != KEY_VALID) {
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

        // Agregar items a la cola externa (cola única)
        let agregados = 0;
        for (const rawItem of ARR_IMPORTA) {
            const item = { ...rawItem, tipo: 'producto' } // incluir tipo explícito
            const success = await agregarACola(idColaPrecios, item);
            if (success) agregados++;
        }
        
        console.log(`[importar] ✓ Completado: ${agregados}/${ARR_IMPORTA.length} productos enviados`);
        res.status(200).send({ stat: true, count: agregados });
        return;
    } catch (error) {
        console.log("[importar] error", error);
        res.status(200).send({ stat: false, error: "Error interno, reintente luego" });
    }
});