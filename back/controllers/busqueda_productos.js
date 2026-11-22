// Índice en memoria: Map clave "product_id|branch_id" -> entradas (un precio por fecha).
// Antes había un bucket por letra con cada entrada repetida ~20 veces, lo que hacía
// carísimo agregar/eliminar (recorría todos los buckets) y la búsqueda copiaba y
// ordenaba listas enteras por cada palabra.
let indice = new Map()
let lista_cache = null   // vista plana del índice, se reconstruye solo si cambió

function clave(product_id, branch_id) {
    return String(product_id) + '|' + String(branch_id)
}

function lista() {
    if (lista_cache) return lista_cache
    const out = []
    for (const arr of indice.values())
        for (let i = 0; i < arr.length; i++) out.push(arr[i])
    lista_cache = out
    return out
}

// Normalización común para índice y término: minúsculas, sin diacríticos
// (salvo ñ) y espacios colapsados. Debe ser la misma en ambos lados para que
// "azucar" encuentre "Azúcar".
// También se quitan los caracteres que utils.limpiarTexto saca del término de
// búsqueda (; { } ( ) * / \ ` ' ") para que un nombre que los contenga ("1/2 kg",
// "(x6)") siga siendo encontrable, y '-'/'_' se tratan como separador de palabras
// ("coca-cola" <-> "coca cola").
function normalizar(texto) {
    return String(texto || '').normalize('NFD')
        .replace(/([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi, "$1")
        .normalize().toLowerCase()
        .replace(/[;{}()*\/\\`'"]/g, '')
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ').trim()
}
exports.normalizar = normalizar

function crear_entrada(p, nombre) {
    return {
        'name':       nombre,
        'nameLower':  normalizar(nombre),
        'product_id': p.product_id,
        'price':      p.price,
        'branch_id':  p.branch_id,
        'date_time':  p.date_time,
        'time':       p.time,
        'url':        p.url || null,
        'user_id':        p.user_id || null,
        'user_nombre':    p.user_nombre || null,
        'user_apellido':  p.user_apellido || null,
        'negocio':        !!p.negocio,
    }
}

const precios_negocio = require('./precios_negocio')

exports.inicializa_buscador = async function() {

    console.log('Generando estructura de busqueda')

    // Se reconstruye desde cero: regenerar_diccionarios se invoca en caliente
    // (ABM alias, categorías, comercios) y sin reset se duplicaban entradas.
    const nuevo_indice = new Map()

    // Usar price_today para inicializar el buscador
    const filasHoy = await global.knex('price_today').select()
        .orderBy('date_time', 'desc')
        .orderBy('price', 'asc')
        .where('price', '<>', 0)
    // Precios de negocios incluidos siempre (ver controllers/precios_negocio.js)
    const productosHoy = (await precios_negocio.combinar(global.knex, filasHoy))
        .filter(r => Number(r.price) !== 0)
    for (let i = 0; i < productosHoy.length; i++) {
        const nombre = productosHoy[i].product_name
        if (!nombre) continue
        const aux = crear_entrada(productosHoy[i], nombre)
        const k = clave(aux.product_id, aux.branch_id)
        if (!nuevo_indice.has(k)) nuevo_indice.set(k, [])
        nuevo_indice.get(k).push(aux)
    }
    indice = nuevo_indice
    lista_cache = null
    console.log('estructura de busqueda generada basada en price_today.')
}

/**
 * Elimina un producto específico de la estructura de búsqueda
 * @param {string} product_id - ID del producto
 * @param {number} branch_id - ID de la sucursal
 */
exports.eliminar_de_buscador = function(product_id, branch_id) {
    // Clave por String: los ids llegan como number o string según el origen
    if (indice.delete(clave(product_id, branch_id)))
        lista_cache = null
}

/**
 * Agrega o actualiza un producto en la estructura de búsqueda
 * Si ya existe el mismo product_id + branch_id, primero lo elimina
 * @param {object} producto - Objeto con los datos del producto
 * @param {string} producto.product_name - Nombre del producto
 * @param {string} producto.product_id - ID del producto
 * @param {number} producto.price - Precio del producto
 * @param {number} producto.branch_id - ID de la sucursal
 * @param {Date} producto.date_time - Fecha y hora del precio
 * @param {Date} producto.time - Timestamp del precio
 * @param {string} producto.url - URL del producto (opcional)
 */
exports.agregar_a_buscador = function(producto) {
    // Validar que tenga los campos requeridos
    if (!producto.product_name || !producto.product_id || !producto.branch_id) {
        console.log('[busqueda_productos] Error: faltan campos requeridos para agregar al buscador')
        return false
    }

    // Eliminar el producto existente si ya está en la estructura (mismo product_id y branch_id)
    exports.eliminar_de_buscador(producto.product_id, producto.branch_id)

    const nombre = producto.product_name
    const aux = crear_entrada({
        ...producto,
        negocio: producto.negocio || precios_negocio.es_negocio(producto.branch_id),
    }, nombre)
    indice.set(clave(aux.product_id, aux.branch_id), [aux])
    lista_cache = null

    console.log(`[busqueda_productos] Producto agregado/actualizado en buscador: ${nombre} (${producto.product_id} - ${producto.branch_id})`)
    return true
}


/**
 * Quita del índice las entradas con date_time anterior a `limite`, igual que la
 * limpieza de price_today (ventana hoy+ayer) que hacen los importadores en BD.
 */
exports.purgar_anteriores = function(limite) {
    const lim = new Date(limite).getTime()
    const quitados = []
    for (const [k, arr] of indice) {
        const quedan = arr.filter(item => {
            const t = new Date(item.date_time).getTime()
            // Los precios de negocios no se purgan por antigüedad
            if (!item.negocio && !isNaN(t) && t < lim) { quitados.push(item); return false }
            return true
        })
        if (quedan.length === 0) indice.delete(k)
        else if (quedan.length !== arr.length) indice.set(k, quedan)
    }
    if (quitados.length) lista_cache = null
    return quitados
}

// Búsqueda AND por palabras: cada palabra debe aparecer como subcadena del nombre
// normalizado (en cualquier orden). Resultado ordenado por precio ascendente.
exports.busqueda = async function( termino, limit = -1 ) {
    const palabras = [...new Set(normalizar(termino).split(' ').filter(p => p.length > 0))]
    if (palabras.length === 0) return []
    // Palabras más largas primero: descartan antes
    palabras.sort((a, b) => b.length - a.length)
    const np = palabras.length
    const encontrados = []
    const todo = lista()
    for (let i = 0; i < todo.length; i++) {
        const e = todo[i]
        const nombre = e.nameLower
        let ok = true
        for (let w = 0; w < np; w++) {
            if (!nombre.includes(palabras[w])) { ok = false; break }
        }
        if (ok) encontrados.push(e)
    }
    encontrados.sort((a, b) => a.price - b.price)
    // Sin truncar por `limit`: el router pagina y necesita el total real
    return encontrados.map(e => ({
        'id':e.id,
        'name':e.name,  // nombre original con mayúsculas/minúsculas
        'price':e.price,
        'branch_id':e.branch_id,
        'product_id':e.product_id,
        'date_time':e.date_time,
        'time':e.time,
        'url':e.url,
        'user_id':e.user_id,
        'user_nombre':e.user_nombre,
        'user_apellido':e.user_apellido
    }))
}
