// ABM de precios cargados por usuarios (solo rol administrador).
// Listado server-side (contrato TableEditor) y eliminación con restauración
// del precio anterior vigente en price_today / buscador / caches.
const express = require('express')
var router = express.Router()
module.exports = router
const busqueda_productos = require('../controllers/busqueda_productos')
const sync_cache = require('../controllers/sync_cache')

const FIELDS_DEF_PRECIOS = [
  { field: 'id',           headerName: 'ID',          sortable: true },
  { field: 'date_time',    headerName: 'Fecha',       sortable: true },
  { field: 'product_name', headerName: 'Producto',    sortable: true },
  { field: 'empresa_name', headerName: 'Comercio' },
  { field: 'price',        headerName: 'Precio',      sortable: true },
  { field: 'cargado_por',  headerName: 'Cargado por' },
  { field: 'user_email',   headerName: 'Email usuario' },
]

const COLUMNAS_FILTRABLES = {
  product_name: 'products.name',
  empresa_name: 'enterprice.name',
  user_email: 'usuarios.email',
}

function responder_ok(res, data) {
  return res.status(200).send({ stat: true, data })
}

function responder_err(res, text) {
  return res.status(200).send({ stat: false, text })
}

function armar_query() {
  return global.knex('price')
    .select(
      'price.id as id',
      'price.date_time as date_time',
      'price.price as price',
      'price.notas as notas',
      'price.product_id as product_id',
      'price.branch_id as branch_id',
      'products.name as product_name',
      'enterprice.name as empresa_name',
      'branch.branch_name as branch_name',
      'price.user_id as user_id',
      'price.user_nombre as user_nombre',
      'price.user_apellido as user_apellido',
      'usuarios.name as u_nombre',
      'usuarios.apellido as u_apellido',
      'usuarios.email as user_email'
    )
    .leftJoin('products', 'products.id', 'price.product_id')
    .leftJoin('branch', 'branch.id', 'price.branch_id')
    .leftJoin('enterprice', 'enterprice.id', 'branch.enterprise_id')
    .leftJoin('usuarios', 'usuarios.id', 'price.user_id')
    .whereNotNull('price.user_id')
}

function armar_count() {
  return global.knex('price')
    .leftJoin('products', 'products.id', 'price.product_id')
    .leftJoin('branch', 'branch.id', 'price.branch_id')
    .leftJoin('enterprice', 'enterprice.id', 'branch.enterprise_id')
    .leftJoin('usuarios', 'usuarios.id', 'price.user_id')
    .whereNotNull('price.user_id')
}

// Elimina el precio (product_id, branch_id) de las caches en memoria
// (precios_diccio y products_category_diccio)
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

// GET /get_all - listado paginado de precios cargados por usuarios (contrato TableEditor)
router.get('/get_all', async function (req, res) {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 25
  const search = req.query.search || ''
  const sortField = req.query.sortField || 'date_time'
  const sortOrder = req.query.sortOrder || 'desc'

  const query = armar_query()
  const countQuery = armar_count()

  if (search) {
    const like = `%${search}%`
    query.where(function () {
      this.where('products.name', 'like', like)
        .orWhere('enterprice.name', 'like', like)
        .orWhere('price.user_nombre', 'like', like)
        .orWhere('price.user_apellido', 'like', like)
        .orWhere('usuarios.email', 'like', like)
    })
    countQuery.where(function () {
      this.where('products.name', 'like', like)
        .orWhere('enterprice.name', 'like', like)
        .orWhere('price.user_nombre', 'like', like)
        .orWhere('price.user_apellido', 'like', like)
        .orWhere('usuarios.email', 'like', like)
    })
  }

  // Filtros por columna: { campo: "valor" } (JSON string desde la libreria)
  let filters = {}
  try { filters = req.query.filters ? JSON.parse(req.query.filters) : {} } catch (e) { filters = {} }
  for (const [field, value] of Object.entries(filters)) {
    const columna = COLUMNAS_FILTRABLES[field]
    if (value && columna) {
      query.where(columna, 'like', `%${value}%`)
      countQuery.where(columna, 'like', `%${value}%`)
    }
  }

  const SORT_COLUMNS = {
    id: 'price.id',
    date_time: 'price.date_time',
    product_name: 'products.name',
    price: 'price.price',
  }
  const orderColumn = SORT_COLUMNS[sortField] || SORT_COLUMNS.date_time

  const total = parseInt((await countQuery.count('* as c'))[0].c)
  const offset = (page - 1) * pageSize
  const rows = await query
    .orderBy(orderColumn, sortOrder === 'asc' ? 'asc' : 'desc')
    .offset(offset)
    .limit(pageSize)

  for (const r of rows) {
    const nombre = r.user_nombre || r.u_nombre || ''
    const apellido = r.user_apellido || r.u_apellido || ''
    r.cargado_por = `${nombre} ${apellido}`.trim()
  }

  responder_ok(res, { rows, fields_def: FIELDS_DEF_PRECIOS, total, page, pageSize })
})

// DELETE /delete_one - elimina un precio cargado por un usuario.
// Si era el precio vigente en price_today, se restaura el precio anterior más
// reciente del mismo producto+sucursal (o se elimina si no existe otro).
router.delete('/delete_one', async function (req, res) {
  const { id } = req.body || {}
  if (!id) return responder_err(res, 'ID requerido')

  try {
    const precio = await global.knex('price').where({ id }).first()
    if (!precio) return responder_err(res, 'Precio no encontrado')
    if (!precio.user_id) return responder_err(res, 'Solo se pueden eliminar precios cargados por usuarios')

    let actualizar_buscador = null   // datos para agregar_a_buscador tras commit
    let eliminar_buscador = false

    const trx = await global.knex.transaction()
    try {
      const price_today_vigente = await trx('price_today').where({ price_id: id }).first()

      await trx('price').where({ id }).del()

      if (price_today_vigente) {
        const anterior = await trx('price')
          .where({ product_id: precio.product_id, branch_id: precio.branch_id })
          .orderBy('date_time', 'desc')
          .first()

        if (anterior) {
          const producto_db = await trx('products').where('id', anterior.product_id).first()
          const product_name = producto_db?.name || null

          await trx('price_today').where({ id: price_today_vigente.id }).update({
            price: anterior.price,
            date_time: anterior.date_time,
            es_oferta: anterior.es_oferta,
            confiabilidad: anterior.confiabilidad,
            url: anterior.url,
            notas: anterior.notas,
            time: anterior.time,
            product_name: product_name,
            price_id: anterior.id,
            user_id: anterior.user_id || null,
            user_nombre: anterior.user_nombre || null,
            user_apellido: anterior.user_apellido || null
          })

          actualizar_buscador = {
            product_name,
            product_id: anterior.product_id,
            price: anterior.price,
            branch_id: anterior.branch_id,
            date_time: anterior.date_time,
            time: anterior.time,
            url: anterior.url || null,
            user_id: anterior.user_id || null,
            user_nombre: anterior.user_nombre || null,
            user_apellido: anterior.user_apellido || null,
            price_id: anterior.id,
            id: price_today_vigente.id,
            es_oferta: anterior.es_oferta,
            confiabilidad: anterior.confiabilidad,
            notas: anterior.notas
          }
        } else {
          await trx('price_today').where({ id: price_today_vigente.id }).del()
          eliminar_buscador = true
        }
      }

      await trx.commit()
    } catch (err) {
      await trx.rollback()
      throw err
    }

    // Sincronizar buscador y caches en memoria
    if (actualizar_buscador && actualizar_buscador.product_name) {
      busqueda_productos.agregar_a_buscador(actualizar_buscador)
      await sync_cache.actualizar_precio(actualizar_buscador)
    } else if (eliminar_buscador) {
      busqueda_productos.eliminar_de_buscador(precio.product_id, precio.branch_id)
      quitar_de_caches(precio.product_id, precio.branch_id)
    }

    responder_ok(res, { message: 'Precio eliminado correctamente' })
  } catch (error) {
    console.log('[preciosComunitarios] Error en delete_one:', error)
    responder_err(res, 'Error al eliminar el precio')
  }
})
