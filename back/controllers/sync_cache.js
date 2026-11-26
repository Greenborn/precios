const precios_negocio = require('./precios_negocio')

// Sincroniza las caches en memoria (precios_diccio y products_category_diccio)
// cada vez que se actualiza un precio, sin esperar a regenerar_diccionarios.

function normalizar_item(ph) {
    return {
        id: ph.id,
        product_id: ph.product_id,
        branch_id: ph.branch_id,
        price: ph.price,
        product_name: ph.product_name,
        name: ph.product_name,
        date_time: ph.date_time,
        time: ph.time,
        es_oferta: ph.es_oferta,
        confiabilidad: ph.confiabilidad,
        notas: ph.notas,
        url: ph.url,
        price_id: ph.price_id,
        user_id: ph.user_id || null,
        user_nombre: ph.user_nombre || null,
        user_apellido: ph.user_apellido || null,
        negocio: !!(ph.negocio || precios_negocio.es_negocio(ph.branch_id))
    }
}

function mismo_producto_sucursal(a, b) {
    return String(a.product_id) === String(b.product_id)
        && String(a.branch_id) === String(b.branch_id)
}

// Actualiza incrementalmente precios_diccio y products_category_diccio a partir
// de un registro de price_today recién insertado/actualizado.
exports.actualizar_precio = async function (precio_hoy) {
    if (!precio_hoy || !precio_hoy.product_id || !precio_hoy.branch_id)
        return false

    const item = normalizar_item(precio_hoy)

    // 1) precios_diccio: un solo precio vigente por (product_id, branch_id)
    if (!global.precios_diccio[precio_hoy.product_id])
        global.precios_diccio[precio_hoy.product_id] = []
    global.precios_diccio[precio_hoy.product_id] =
        global.precios_diccio[precio_hoy.product_id]
            .filter(r => String(r.branch_id) !== String(precio_hoy.branch_id))
    global.precios_diccio[precio_hoy.product_id].push(item)

    // 2) products_category_diccio
    let cat_ids = global.products_category_diccio.by_product_id[precio_hoy.product_id]
    if (!cat_ids || cat_ids.length === 0) {
        const rows = await global.knex('product_category')
            .select('category_id')
            .where('product_id', precio_hoy.product_id)
        cat_ids = rows.map(r => r.category_id)
        global.products_category_diccio.by_product_id[precio_hoy.product_id] = cat_ids
    }

    for (const cat_id of cat_ids) {
        if (!global.products_category_diccio.by_category_id[cat_id])
            global.products_category_diccio.by_category_id[cat_id] = []
        const arr = global.products_category_diccio.by_category_id[cat_id]
        const idx = arr.findIndex(e => mismo_producto_sucursal(e, item))
        if (idx !== -1) arr.splice(idx, 1)
        arr.push(item)
    }

    return true
}

// Reconstruye products_category_diccio por completo.
// Debe llamarse después de regenerar global.precios_diccio (ver server.js).
exports.construir_categorias = async function () {
    global.products_category_diccio = { by_product_id: {}, by_category_id: {} }

    const product_category = await global.knex('product_category').select()
    for (const pc of product_category) {
        if (!global.products_category_diccio.by_product_id[pc.product_id])
            global.products_category_diccio.by_product_id[pc.product_id] = []
        global.products_category_diccio.by_product_id[pc.product_id].push(pc.category_id)
    }

    for (const product_id in global.precios_diccio) {
        const cat_ids = global.products_category_diccio.by_product_id[product_id]
        if (!cat_ids) continue
        for (const row of global.precios_diccio[product_id]) {
            const item = normalizar_item(row)
            for (const cat_id of cat_ids) {
                if (!global.products_category_diccio.by_category_id[cat_id])
                    global.products_category_diccio.by_category_id[cat_id] = []
                global.products_category_diccio.by_category_id[cat_id].push(item)
            }
        }
    }

    return true
}

// Agrega la relacion producto-categoria a products_category_diccio, usando los
// precios ya cargados en precios_diccio (sin consultar la DB).
exports.vincular_producto_categoria = function (product_id, category_id) {
    const pid = String(product_id)
    const cid = String(category_id)
    const pc = global.products_category_diccio

    if (!pc.by_product_id[pid]) pc.by_product_id[pid] = []
    if (!pc.by_product_id[pid].some(c => String(c) === cid)) pc.by_product_id[pid].push(category_id)

    if (!pc.by_category_id[cid]) pc.by_category_id[cid] = []
    const arr = pc.by_category_id[cid]
    for (const row of global.precios_diccio[pid] || []) {
        const item = normalizar_item(row)
        const idx = arr.findIndex(e => mismo_producto_sucursal(e, item))
        if (idx !== -1) arr.splice(idx, 1)
        arr.push(item)
    }
}

// Quita la relacion producto-categoria de products_category_diccio.
exports.desvincular_producto_categoria = function (product_id, category_id) {
    const pid = String(product_id)
    const cid = String(category_id)
    const pc = global.products_category_diccio

    if (pc.by_product_id[pid])
        pc.by_product_id[pid] = pc.by_product_id[pid].filter(c => String(c) !== cid)
    if (pc.by_category_id[cid])
        pc.by_category_id[cid] = pc.by_category_id[cid].filter(e => String(e.product_id) !== pid)
}
