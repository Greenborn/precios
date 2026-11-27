// Soporte de DELETE /negocio/mi-cuenta/datos y de la baja de un local: mantiene price_today,
// buscador y caches en memoria alineados con el borrado de precios y locales.
const uuid = require('uuid')
const busqueda_productos = require('./busqueda_productos')
const sync_cache = require('./sync_cache')
const precios_negocio = require('./precios_negocio')
const { quitar_de_caches, sincronizar_precio_negocio } = require('./sincronizacion_precios')

function inicio_de_ayer() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - 1)
  return d
}

function agregar_par(pares, fila) {
  if (fila.product_id == null || fila.branch_id == null) return
  pares.set(`${fila.product_id}|${fila.branch_id}`, { product_id: String(fila.product_id), branch_id: String(fila.branch_id) })
}

// Pares (producto, local) afectados por el borrado. Debe llamarse ANTES de borrar.
// `de_price_today` son los pares que van a perder una fila de price_today del usuario.
// Sin `uid` (baja de un local) solo se consideran los locales `ids`.
async function pares_afectados(trx, uid, ids) {
  const pares = new Map()
  const de_price_today = new Map()

  if (uid != null) {
    for (const f of await trx('price_today').where({ user_id: uid }).select('product_id', 'branch_id')) {
      agregar_par(de_price_today, f)
      agregar_par(pares, f)
    }
    for (const f of await trx('price').where({ user_id: uid }).select('product_id', 'branch_id')) agregar_par(pares, f)
    for (const f of await trx('precios_negocio').where({ usuario_id: uid }).select('product_id', 'branch_id')) agregar_par(pares, f)
  }
  if (ids.length) {
    for (const tabla of ['price_today', 'price', 'precios_negocio']) {
      for (const f of await trx(tabla).whereIn('branch_id', ids).select('product_id', 'branch_id')) agregar_par(pares, f)
    }
  }

  // Lo que esté en memoria del usuario o de sus locales, aunque ya no figure en la base
  const locales = new Set(ids.map(String))
  for (const pid in global.precios_diccio) {
    for (const r of global.precios_diccio[pid] || []) {
      if (locales.has(String(r.branch_id)) || (r.user_id != null && String(r.user_id) === String(uid))) agregar_par(pares, r)
    }
  }

  return { pares: [...pares.values()], de_price_today: [...de_price_today.values()] }
}

// En locales ajenos, repone en price_today el último precio de `price` dentro de la ventana
// hoy+ayer para los pares que quedaron sin fila. Debe llamarse DESPUÉS de borrar.
async function restaurar_price_today(trx, de_price_today, ids) {
  const locales = new Set(ids.map(String))
  for (const { product_id, branch_id } of de_price_today) {
    if (locales.has(branch_id)) continue
    if (await trx('price_today').where({ product_id, branch_id }).first()) continue
    const anterior = await trx('price')
      .where({ product_id, branch_id })
      .where('date_time', '>=', inicio_de_ayer())
      .orderBy('date_time', 'desc')
      .first()
    if (!anterior) continue
    const producto = await trx('products').where({ id: product_id }).first()
    await trx('price_today').insert({
      id: uuid.v7(),
      product_id: anterior.product_id,
      price: anterior.price,
      date_time: anterior.date_time,
      branch_id: anterior.branch_id,
      es_oferta: anterior.es_oferta,
      confiabilidad: anterior.confiabilidad,
      url: anterior.url,
      notas: anterior.notas,
      time: anterior.time,
      product_name: producto?.name || null,
      price_id: anterior.id,
      user_id: anterior.user_id || null,
      user_nombre: anterior.user_nombre || null,
      user_apellido: anterior.user_apellido || null,
    })
  }
}

// Precio vigente de un par en un local no negocio: price_today dentro de la ventana hoy+ayer.
async function precio_hoy_vigente(knex, product_id, branch_id) {
  const fila = await knex('price_today')
    .where({ product_id, branch_id })
    .where('date_time', '>=', inicio_de_ayer())
    .orderBy('date_time', 'desc')
    .first()
  if (!fila || fila.product_name) return fila
  const producto = await knex('products').where({ id: product_id }).first()
  return { ...fila, product_name: producto?.name || null }
}

// Tras confirmar el borrado: quita los pares afectados del buscador y las caches y vuelve a
// cargar el precio vigente de los locales que se conservan.
async function resincronizar(knex, pares, ids) {
  // Primero se quita todo, para que nada borrado quede visible aunque falle una consulta
  for (const { product_id, branch_id } of pares) {
    busqueda_productos.eliminar_de_buscador(product_id, branch_id)
    quitar_de_caches(product_id, branch_id)
  }

  const locales = new Set(ids.map(String))
  for (const { product_id, branch_id } of pares) {
    if (locales.has(branch_id)) continue
    try {
      // Negocio: vigente es el último de `price`, sin ventana
      if (precios_negocio.es_negocio(branch_id)) {
        await sincronizar_precio_negocio(product_id, branch_id)
        continue
      }
      const vigente = await precio_hoy_vigente(knex, product_id, branch_id)
      if (!vigente) continue
      if (Number(vigente.price) !== 0 && vigente.product_name) busqueda_productos.agregar_a_buscador(vigente)
      await sync_cache.actualizar_precio(vigente)
    } catch (err) {
      console.error(`[baja_datos_usuario] No se pudo resincronizar ${product_id} - ${branch_id}`, err)
    }
  }
}

// Quita un local eliminado de los diccionarios de sucursales y del conjunto de negocios
function quitar_local(branch_id) {
  const bid = String(branch_id)
  precios_negocio.marcar(branch_id, false)
  delete global.branchs_diccio[Number(branch_id)]
  for (const eid in global.branch_enterprice_diccio) {
    global.branch_enterprice_diccio[eid] = global.branch_enterprice_diccio[eid].filter((b) => String(b.id) !== bid)
  }
}

// Quita un comercio eliminado (ya sin locales)
function quitar_comercio(enterprise_id) {
  delete global.enterprice_diccio[Number(enterprise_id)]
  delete global.branch_enterprice_diccio[Number(enterprise_id)]
}

module.exports = { pares_afectados, restaurar_price_today, resincronizar, quitar_local, quitar_comercio }
