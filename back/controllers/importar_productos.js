require("dotenv").config({ path: '../.env' })
const uuid = require("uuid")
const utils = require("../helpers/utils")
const busqueda_productos = require("./busqueda_productos")
const sync_cache = require("./sync_cache")

let precios_actualizados = []
let nuevos_precios_creados = []

async function nuevo_reg_precio( trx, articulo, producto_db, fecha_registro ){
    try {
        // Si el precio es menor o igual a cero, no hacer nada
        if (!articulo.price || articulo.price <= 0) {
            return false;
        }

        // El campo fecha_registro es obligatorio
        let fecha = articulo.fecha_registro || fecha_registro;
        if (!fecha) {
            console.error('Error: fecha_registro es obligatorio');
            return false;
        }

        // Limpiar price_today: conservar solo hoy y ayer
        // (borrar todo registro con date_time anterior al inicio del día de ayer)
        let AYER = new Date(fecha);
        AYER.setHours(0,0,0,0);
        AYER.setDate(AYER.getDate() - 1);
        await trx('price_today').where('date_time', '<', AYER).del();

        const insert = {
            "id": uuid.v7(),
            "product_id": producto_db.id,
            "price": articulo.price,
            "date_time": fecha,
            "branch_id": articulo.branch_id,
            "es_oferta": 0,
            "confiabilidad": 100,
            "notas": (articulo?.nota) ? articulo.nota : null,
            "url": ( articulo.url ) ? articulo.url : null,
            "time": fecha, // Guardar el timestamp de registro
        }
        let insert_1 = await trx('price').insert( insert );

        // Preparar registro para price_today
        let precio_hoy = { ...insert };
        precio_hoy['id'] = uuid.v7();
        precio_hoy['product_name'] = articulo.name;
        precio_hoy['price_id'] = insert.id;

        // Buscar si ya existe registro para product_id y branch_id
        let existe = await trx('price_today')
            .where({ product_id: producto_db.id, branch_id: articulo.branch_id })
            .first();

        let result;
        if (!existe) {
            // Si no existe, insertar
            result = await trx('price_today').insert(precio_hoy);
        } else {
            // Si existe, actualizar
            result = await trx('price_today')
                .where({ product_id: producto_db.id, branch_id: articulo.branch_id })
                .update({
                    price: articulo.price,
                    date_time: fecha,
                    es_oferta: 0,
                    confiabilidad: 100,
                    notas: (articulo?.nota) ? articulo.nota : null,
                    url: (articulo.url) ? articulo.url : null,
                    time: fecha,
                    product_name: articulo.name,
                    price_id: insert.id
                });
        }

        if (insert_1 && result) {
            nuevos_precios_creados.push(insert);
            // Actualizar estructura de búsqueda en tiempo real
            busqueda_productos.agregar_a_buscador({
                product_name: articulo.name,
                product_id: producto_db.id,
                price: articulo.price,
                branch_id: articulo.branch_id,
                date_time: insert.date_time,
                time: insert.time,
                url: insert.url
            });
            // Actualizar caches de precios y productos por categoría
            await sync_cache.actualizar_precio(precio_hoy);
            return insert;
        } else {
            return false;
        }
    } catch (error) {
        console.log(error, 'error al registrar producto');
        return null;
    }
}


exports.procesar_articulo = procesar_articulo

async function get_categoria( trx, articulo ){
    return new Promise( async (resolve, reject) => {
        const NOMBRE_CAT = articulo.category_name
        let categoria = (global.diccio_name_category[NOMBRE_CAT])  
                            ? global.diccio_name_category[NOMBRE_CAT]
                            : await global.knex('category').select().where('name', NOMBRE_CAT).first()
        if (categoria){
            resolve(categoria)
            return
        } else {
            const ID_NUEVA_CAT = uuid.v7()
            const insert = { 'id': ID_NUEVA_CAT, 'name': NOMBRE_CAT }
            categoria = await trx('category').insert( insert )
            resolve(insert)
            return
        }
    })
}


// Registra el nombre original (termino inicial) como alias del producto canonico.
// Solo aplica cuando el nombre fue resuelto mediante alias_busqueda y la variante
// aun no existe en alias_productos (unicidad por termino inicial)
async function registrar_alias_variante( trx, articulo, producto ){
    const ALIAS_ORIGINAL = articulo.alias_original
    if (!ALIAS_ORIGINAL || !producto?.id)
        return
    try {
        const hay_alias = await trx('alias_productos').where('alias', ALIAS_ORIGINAL).first()
        if (!hay_alias)
            await trx('alias_productos').insert( { "alias": ALIAS_ORIGINAL, "product_id": producto.id } )
    } catch (error) {
        console.log(error, 'no se pudo registrar el alias variante')
    }
}


async function get_producto( trx, articulo ){
    return new Promise( async (resolve, reject) => {
        try {
        const NAME = articulo.name
        //console.log('products_diccio', global.products_diccio[name] )
        let producto  = (global.products_diccio[NAME]) 
                        ? global.products_diccio[NAME]
                        : await global.knex('alias_productos').select()
                            .join('products', 'products.id', 'alias_productos.product_id')
                            .where('alias_productos.alias', NAME).first()
            if (producto){
                let upd = {}
                let ac = false
                if (articulo?.barcode){
                    upd['barcode'] =  articulo.barcode 
                    ac = true
                }
                if (articulo?.description){
                    upd['description'] =  articulo.description
                    ac = true
                }
                if (ac)
                    await trx('products').update( upd ).where('id','=',producto.id)

                await registrar_alias_variante( trx, articulo, producto )
                resolve(producto)
                return
            } else {
                
                const ID_NUEVO_PROD = uuid.v7()
                let insert = {
                    "id": ID_NUEVO_PROD,
                    "name": NAME,
                    "vendor_id": articulo.vendor_id,
                }
                await trx('alias_productos').insert( { "alias": NAME, "product_id": ID_NUEVO_PROD } ) 
                if (articulo?.barcode) insert['barcode'] = articulo.barcode
                await trx('products').insert( insert ) 
                
                await registrar_alias_variante( trx, articulo, insert )
                resolve(insert)
                return
            }
        } catch (error) {
            console.log(error, 'no se pudo obtener / crear el producto')
            resolve(null)
            return
        }
        
    })
}

async function procesa_precio( trx, producto_db, articulo, fecha_registro ){
    return new Promise( async (resolve, reject) => {
        
        let HOY = new Date()
        HOY.setHours(0,0,0,1)

        // IMPORTANTE: Buscar último precio del MISMO producto Y MISMA sucursal
        let ultimo_precio = await global.knex('price').select()
            .where('product_id', producto_db.id)
            .where('branch_id', articulo.branch_id)
            .orderBy('time', 'desc')
            .first()
        
        if (ultimo_precio){
            if (Math.abs(ultimo_precio.price - articulo?.price) > 1){
                let nuevo_precio = await nuevo_reg_precio( trx, articulo, producto_db, fecha_registro )
                if (nuevo_precio){
                    await procesar_variacion(trx, [ ultimo_precio, articulo ], fecha_registro)
                    precios_actualizados.push( [ ultimo_precio, articulo ] )
                    return resolve(true)
                } else 
                    return resolve(false)
            } else if (ultimo_precio && Math.abs(ultimo_precio.price - articulo?.price) <= 1){
                await trx('price').update( {
                    "date_time": new Date(), "time": new Date(), "url": ( articulo.url ) ? articulo.url : null
                } ).where("id", ultimo_precio.id)
                
                let precio_hoy = {
                    ...ultimo_precio,
                    "date_time": new Date(), "time": new Date(), "url": ( articulo.url ) ? articulo.url : null
                }
                precio_hoy['id']           = uuid.v7()
                precio_hoy['product_name'] = articulo.name
                precio_hoy['price_id']     = ultimo_precio.id
                let repetido = await global.knex('price_today').where({
                    'price_id': ultimo_precio.id,
                }).first()
                if (!repetido) {
                    await trx('price_today').insert( precio_hoy )
                    
                    // Actualizar estructura de búsqueda (mismo precio, solo actualiza timestamp)
                    busqueda_productos.agregar_a_buscador({
                        product_name: articulo.name,
                        product_id: producto_db.id,
                        price: ultimo_precio.price,
                        branch_id: articulo.branch_id,
                        date_time: new Date(),
                        time: new Date(),
                        url: articulo.url
                    });
                    // Actualizar caches de precios y productos por categoría
                    await sync_cache.actualizar_precio(precio_hoy);
                }
                return resolve(true)
            } else  if (!ultimo_precio) {
                let nuevo_precio = await nuevo_reg_precio( trx, articulo, producto_db, fecha_registro )
                if (nuevo_precio){
                    return resolve(true)
                } else 
                    return resolve(false)
            } else 
                return resolve(false)
        } else {
            let nuevo_precio = await nuevo_reg_precio( trx, articulo, producto_db, fecha_registro )
            if (nuevo_precio){
                return resolve(true)
            } else 
                return resolve(false)
        }

    })
}

async function procesar_articulo(articulo, fecha_registro ){
    return new Promise( async (resolve, reject) => {
        if (!articulo?.category_name){
            return resolve({stat:false, text: 'No se especifica categoria!'})
        }

        // Validar que fecha_registro sea obligatorio
        const fecha_final = articulo.fecha_registro || fecha_registro;
        if (!fecha_final) {
            return resolve({stat:false, text: 'El campo fecha_registro es obligatorio'})
        }

        let trx = await global.knex.transaction()

        try {
            let res = { stat: true, text: '' }

            articulo.name          = utils.limpiarTexto(articulo.name)
            articulo.category_name = utils.limpiarTexto(articulo.category_name)

            if (articulo.name.length > 500)
                articulo.name = articulo.name.substring(0, 500)

            // Resolucion de nombre canonico segun alias_busqueda (termino inicial -> termino final).
            // El alias tiene prioridad: si el nombre llega definido como termino inicial, el precio
            // se guarda contra el producto del termino final y el nombre original queda como variante
            const TERMINO_FINAL = global.alias_busqueda[articulo.name.toLowerCase()]
            if (TERMINO_FINAL){
                const CANONICO = utils.limpiarTexto(TERMINO_FINAL)
                if (CANONICO && CANONICO !== articulo.name){
                    articulo.alias_original = articulo.name
                    articulo.name = CANONICO
                }
            }

            let producto  = await get_producto( trx, articulo )
            let categoria = await get_categoria( trx, articulo )

            if (producto === null){
                trx.rollback()
                res.stat = false
                resolve(res)
                return
            }
            
            //Si no hay relacion entre producto y categoria se la crea
            if (producto && categoria){
                let hay_cat = await global.knex('product_category').select()
                    .where({ "product_id": producto.id, "category_id": categoria.id }).first()
                if (!hay_cat)
                    await
                        trx('product_category').insert( {
                            "id": uuid.v7(),
                            "product_id":  producto.id,
                            "category_id": categoria.id
                        } )

                let proc_precio_ = await procesa_precio( trx, producto, articulo, fecha_registro )

                if (proc_precio_){
                    await trx.commit()
                    resolve(res)
                    return
                } else {
                    trx.rollback()
                    res.stat = false
                    resolve(res)
                    return
                }
            } else {
                trx.rollback()
                return resolve({ stat: false, text: "no hay producto y/o categoria"})
            }
        } catch (error) {
            trx.rollback()
            console.log(error)
            return resolve({ stat: false, text: ''})
        }
             
    })
}

async function procesar_variacion( trx, variacion, fecha_registro){
    
    const reg_anterior = variacion[0]
    const reg_nuevo    = variacion[1] 
    console.log(157, variacion)
    const porcentage = (reg_nuevo.price - reg_anterior.price) / ( reg_anterior.price / 100 )
    if (porcentage > 50 || porcentage < -50){
        console.log(variacion)
        return
    }
    if (reg_anterior.price != reg_nuevo.price && reg_nuevo.branch_id == reg_anterior.branch_id 
        && reg_anterior.price != 0 && reg_nuevo.price != 0){
        await trx("estadistica_aumento_diario").insert(
            {
                "id_producto":        reg_anterior.product_id,
                "branch_id":          reg_anterior.branch_id,
                "porcentaje_aumento": porcentage,
                "precio_ayer":        reg_anterior.price,
                "precio_hoy":         reg_nuevo.price,
                "nombre_producto":    reg_nuevo.name,
                "nombre_comercio":     global.enterprice_diccio[ global.branchs_diccio[reg_nuevo.branch_id].enterprise_id ].name,
                "fecha_utlimo_precio": new Date()
            })
    }
    return
}
exports.procesar_variacion = procesar_variacion
