// Precios de sucursales de negocios (branch.propietario_id no nulo).
// Estos precios SIEMPRE están vigentes en caches y buscador: no los descarta la
// ventana hoy+ayer ni la purga, y no dependen de que sean el último precio cargado
// en price_today. Para cada (product_id, branch_id) de un negocio vale el último
// registro de `price`; al cargar uno nuevo, el anterior queda invalidado (se
// reemplaza en caches y buscador).
// `price` es la unica fuente para negocios: price_today solo conserva hoy y ayer para
// todos los locales (puede tener filas de negocio, pero nada depende de ellas).

// Conjunto de sucursales de negocios, para consultas síncronas (buscador, caches)
const ids_negocio = new Set()

function clave(product_id, branch_id) {
  return `${String(product_id)}|${String(branch_id)}`
}

// Carga/recarga el conjunto desde la base. Se invoca en regenerar_diccionarios.
async function cargar_ids(knex) {
  const filas = await knex('branch').select('id').whereNotNull('propietario_id')
  ids_negocio.clear()
  for (const f of filas) ids_negocio.add(String(f.id))
  return ids_negocio.size
}

function es_negocio(branch_id) {
  return ids_negocio.has(String(branch_id))
}

// Alta/baja de un local de negocio sin regenerar todo el diccionario
function marcar(branch_id, esNegocio) {
  if (esNegocio) ids_negocio.add(String(branch_id))
  else ids_negocio.delete(String(branch_id))
}

function columnas_precio() {
  return [
    'price.id as id',
    'price.id as price_id',
    'price.product_id',
    'price.price',
    'price.date_time',
    'price.time',
    'price.branch_id',
    'price.es_oferta',
    'price.confiabilidad',
    'price.notas',
    'price.url',
    'price.user_id',
    'price.user_nombre',
    'price.user_apellido',
    'products.name as product_name',
  ]
}

// Consulta (builder, sin ejecutar) del último precio de cada (product_id, branch_id)
// para el conjunto de sucursales `ids`. Permite paginar/contar desde el llamador.
function consulta_ultimos_precios(knex, ids) {
  const sub = knex('price')
    .whereIn('branch_id', ids)
    .select('product_id', 'branch_id')
    .max('date_time as max_dt')
    .groupBy('product_id', 'branch_id')

  return knex('price')
    .join(sub.as('latest'), function () {
      this.on('price.product_id', '=', 'latest.product_id')
          .on('price.branch_id', '=', 'latest.branch_id')
          .on('price.date_time', '=', 'latest.max_dt')
    })
    .join('products', 'products.id', 'price.product_id')
    .whereIn('price.branch_id', ids)
    // Desempate: si hay dos precios con la misma date_time, se queda solo el de mayor id
    .whereNotExists(function () {
      this.select(knex.raw('1')).from('price as p2')
        .whereRaw('p2.product_id = price.product_id')
        .whereRaw('p2.branch_id = price.branch_id')
        .whereRaw('p2.date_time = price.date_time')
        .whereRaw('p2.id > price.id')
    })
    .select(columnas_precio())
}

// Precio vigente de un producto en un local de negocio (undefined si no le queda ninguno)
async function ultimo_precio(knex, product_id, branch_id) {
  // Consulta directa por producto: se ejecuta en cada escritura y price no tiene indice por branch_id
  return knex('price')
    .join('products', 'products.id', 'price.product_id')
    .where('price.product_id', product_id)
    .where('price.branch_id', branch_id)
    .orderBy('price.date_time', 'desc')
    .orderBy('price.id', 'desc')
    .select(columnas_precio())
    .first()
}

// Último precio de cada (product_id, branch_id) de sucursales de negocios, sin ventana
async function ultimos_precios(knex) {
  const ids = [...ids_negocio]
  if (!ids.length) return []
  return consulta_ultimos_precios(knex, ids)
}

// Combina filas de price_today con los precios de negocios: para una clave que es
// de un negocio gana siempre el último precio del negocio (reemplaza a price_today).
// Marca cada fila con `negocio` para que la purga y el buscador la conserven.
async function combinar(knex, filas) {
  const negocio = await ultimos_precios(knex)
  const claves = new Set(negocio.map(r => clave(r.product_id, r.branch_id)))
  const resto = filas
    .filter(f => !claves.has(clave(f.product_id, f.branch_id)))
    .map(f => ({ ...f, negocio: es_negocio(f.branch_id) }))
  return [...resto, ...negocio.map(r => ({ ...r, negocio: true }))]
}

module.exports = { cargar_ids, es_negocio, marcar, ultimo_precio, ultimos_precios, consulta_ultimos_precios, combinar }
