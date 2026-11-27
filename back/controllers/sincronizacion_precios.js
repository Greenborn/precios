// Buscador y caches en memoria tras escribir precios. En locales de negocio `price` es la
// unica fuente: tras cada escritura se relee su ultimo registro y se ignora lo recibido
// (price_today solo cubre hoy y ayer, igual que para el resto de los locales).
const busqueda_productos = require('./busqueda_productos')
const sync_cache = require('./sync_cache')
const precios_negocio = require('./precios_negocio')

// Elimina el precio (product_id, branch_id) de precios_diccio y products_category_diccio
function quitar_de_caches(product_id, branch_id) {
  const pid = String(product_id)
  const bid = String(branch_id)

  if (global.precios_diccio[pid]) {
    global.precios_diccio[pid] = global.precios_diccio[pid].filter(r => String(r.branch_id) !== bid)
    if (global.precios_diccio[pid].length === 0) delete global.precios_diccio[pid]
  }

  const cat_ids = global.products_category_diccio.by_product_id[pid] || []
  for (const cat_id of cat_ids) {
    const arr = global.products_category_diccio.by_category_id[cat_id]
    if (arr) {
      global.products_category_diccio.by_category_id[cat_id] =
        arr.filter(e => !(String(e.product_id) === pid && String(e.branch_id) === bid))
    }
  }
}

// Deja buscador y caches con el ultimo registro de `price`, o sin el par si no queda ninguno.
// Llamar DESPUES de confirmar la transaccion.
async function sincronizar_precio_negocio(product_id, branch_id) {
  const vigente = await precios_negocio.ultimo_precio(global.knex, product_id, branch_id)
  if (!vigente) {
    busqueda_productos.eliminar_de_buscador(product_id, branch_id)
    quitar_de_caches(product_id, branch_id)
    return
  }
  const datos = { ...vigente, negocio: true }
  // El buscador no lista precios en 0 (igual que inicializa_buscador)
  if (Number(datos.price) === 0) busqueda_productos.eliminar_de_buscador(product_id, branch_id)
  else busqueda_productos.agregar_a_buscador(datos)
  await sync_cache.actualizar_precio(datos)
}

// Refleja en memoria un precio recien escrito (importadores)
async function aplicar_precio(datos) {
  if (precios_negocio.es_negocio(datos.branch_id)) {
    await sincronizar_precio_negocio(datos.product_id, datos.branch_id)
    return
  }
  if (datos.product_name) busqueda_productos.agregar_a_buscador(datos)
  await sync_cache.actualizar_precio(datos)
}

module.exports = { quitar_de_caches, sincronizar_precio_negocio, aplicar_precio }
