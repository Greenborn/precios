// ABM de categorias de productos (tabla `category`) con gestion de la relacion
// N-N product_category. Listado server-side con contrato TableEditor, alta/
// edicion/borrado (bloqueado si tiene productos asociados) y endpoints para
// listar/agregar/quitar productos de una categoria.
//
// Lecturas y validaciones salen de la cache en memoria (controllers/categorias_cache.js).
// Las mutaciones escriben en DB y luego actualizan esa cache de forma incremental,
// sin regenerar todos los diccionarios.
const express = require('express')
const uuid = require('uuid')
const categorias_cache = require('../controllers/categorias_cache')
var router = express.Router()
module.exports = router

function responder_ok(res, data) {
  return res.status(200).send({ stat: true, data })
}

function responder_err(res, text) {
  return res.status(200).send({ stat: false, text })
}

const FIELDS_DEF_CATEGORIAS = [
  { field: 'id',            headerName: 'ID',           sortable: true },
  { field: 'name',          headerName: 'Categoría',    sortable: true },
  { field: 'root_category_id', headerName: 'ID Categoría padre', hide: true },
  { field: 'root_category_name', headerName: 'Categoría padre', sortable: true },
  { field: 'cant_productos', headerName: 'Productos',   sortable: true },
]

const FIELDS_DEF_PRODUCTOS_CATEGORIA = [
  { field: 'id',   headerName: 'ID',        sortable: true },
  { field: 'name', headerName: 'Producto',  sortable: true },
]

// Sanitizacion liviana: sin saltos de linea, sin espacios dobles, longitud maxima
function limpiar_nombre(texto) {
  return String(texto ?? '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255)
}

// GET /get_all - listado paginado (contrato TableEditor), desde cache
router.get('/get_all', function (req, res) {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 25
  const search = req.query.search || ''
  const sortField = req.query.sortField || 'name'
  const sortOrder = req.query.sortOrder || 'asc'

  // Filtros por columna: { campo: "valor" } (JSON string desde la libreria)
  let filters = {}
  try { filters = req.query.filters ? JSON.parse(req.query.filters) : {} } catch (e) { filters = {} }

  try {
    const { rows, total } = categorias_cache.listar({ search, filters, page, pageSize, sortField, sortOrder })
    responder_ok(res, { rows, fields_def: FIELDS_DEF_CATEGORIAS, total, page, pageSize })
  } catch (error) {
    console.log('[categorias] Error en get_all:', error)
    responder_err(res, 'Error al listar categorías')
  }
})

// GET /productos_categoria - productos asociados a una categoria (paginado).
// La pertenencia sale de cache; nombres y paginado se resuelven en DB solo para
// los ids de la categoria.
router.get('/productos_categoria', async function (req, res) {
  const category_id = String(req.query.category_id ?? '').trim()
  if (!category_id) return responder_err(res, 'Categoría requerida')

  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 25
  const search = req.query.search || ''

  try {
    if (!categorias_cache.obtener(category_id)) return responder_err(res, 'La categoría indicada no existe')

    const ids = categorias_cache.ids_productos(category_id)

    function armar_q() {
      let q = global.knex('products')
        .select('products.id as id', 'products.name as name')
        .whereIn('products.id', ids)
      if (search) q = q.where('products.name', 'like', `%${search}%`)
      return q
    }

    let total = ids.length
    if (search) {
      const c = await global.knex('products').whereIn('products.id', ids)
        .where('products.name', 'like', `%${search}%`).count('products.id as c')
      total = parseInt(c[0].c)
    }

    const rows = ids.length === 0 ? [] : await armar_q()
      .orderBy('products.name', 'asc')
      .offset((page - 1) * pageSize)
      .limit(pageSize)

    responder_ok(res, { rows, fields_def: FIELDS_DEF_PRODUCTOS_CATEGORIA, total, page, pageSize })
  } catch (error) {
    console.log('[categorias] Error en productos_categoria:', error)
    responder_err(res, 'Error al listar productos de la categoría')
  }
})

// GET /productos_disponibles - productos (id + name) para el selector (catalogo, en DB)
router.get('/productos_disponibles', async function (req, res) {
  const search = String(req.query.search || '').trim()
  const limit = Math.min(parseInt(req.query.limit) || 20, 100)

  try {
    let query = global.knex('products').select('id', 'name')
    if (search) query = query.where('name', 'like', `%${search}%`)
    const rows = await query.orderBy('name', 'asc').limit(limit)
    responder_ok(res, { rows })
  } catch (error) {
    console.log('[categorias] Error en productos_disponibles:', error)
    responder_err(res, 'Error al buscar productos')
  }
})

// GET /categorias_disponibles - categorias (id + name) para el selector de
// categoria padre, desde cache. exclude_id evita seleccionar la misma como padre.
router.get('/categorias_disponibles', function (req, res) {
  const search = String(req.query.search || '').trim()
  const exclude_id = String(req.query.exclude_id || '').trim()
  const limit = Math.min(parseInt(req.query.limit) || 20, 100)

  try {
    const rows = categorias_cache.categorias_disponibles({ search, exclude_id, limit })
    responder_ok(res, { rows })
  } catch (error) {
    console.log('[categorias] Error en categorias_disponibles:', error)
    responder_err(res, 'Error al buscar categorías')
  }
})

// GET /arbol - hijos directos de una categoria (lazy-load), desde cache.
// Sin parent_id devuelve las raices. Con search busca en todos los niveles.
router.get('/arbol', function (req, res) {
  const parent_id = String(req.query.parent_id || '').trim()
  const search = String(req.query.search || '').trim()

  try {
    const rows = categorias_cache.arbol({ parent_id, search })
    responder_ok(res, { rows })
  } catch (error) {
    console.log('[categorias] Error en arbol:', error)
    responder_err(res, 'Error al obtener el árbol de categorías')
  }
})

// Valida nombre y categoria padre contra cache, comun a alta y edicion
function validar_payload(body, id_actual) {
  const name = limpiar_nombre(body?.name)
  const root_category_id = String(body?.root_category_id ?? '').trim() || null
  return categorias_cache.validar(name, root_category_id, id_actual)
}

// POST /add_one - crea una categoria { name, root_category_id? }
router.post('/add_one', async function (req, res) {
  try {
    const validacion = validar_payload(req.body, null)
    if (validacion.error) return responder_err(res, validacion.error)

    const categoria = { id: uuid.v7(), name: validacion.name, root_category_id: validacion.root_category_id }
    await global.knex('category').insert(categoria)

    categorias_cache.alta(categoria)
    responder_ok(res, { message: 'Categoría creada correctamente' })
  } catch (error) {
    console.log('[categorias] Error en add_one:', error)
    responder_err(res, 'Error al crear la categoría')
  }
})

// PUT /put_one - edita una categoria { id, name, root_category_id? }
router.put('/put_one', async function (req, res) {
  const id_actual = String(req.body?.id ?? '').trim()
  if (!id_actual) return responder_err(res, 'Categoría requerida')

  try {
    if (!categorias_cache.obtener(id_actual)) return responder_err(res, 'Categoría no encontrada')

    const validacion = validar_payload(req.body, id_actual)
    if (validacion.error) return responder_err(res, validacion.error)

    await global.knex('category').where({ id: id_actual })
      .update({ name: validacion.name, root_category_id: validacion.root_category_id })

    categorias_cache.modificar(id_actual, { name: validacion.name, root_category_id: validacion.root_category_id })
    responder_ok(res, { message: 'Categoría actualizada correctamente' })
  } catch (error) {
    console.log('[categorias] Error en put_one:', error)
    responder_err(res, 'Error al actualizar la categoría')
  }
})

// DELETE /delete_one - elimina una categoria { id }. Bloqueado si tiene
// productos, subcategorias, alias, o si esta en menus / empresas.
router.delete('/delete_one', async function (req, res) {
  const id = String(req.body?.id ?? '').trim()
  if (!id) return responder_err(res, 'Categoría requerida')

  try {
    if (!categorias_cache.obtener(id)) return responder_err(res, 'Categoría no encontrada')

    if (categorias_cache.tiene_productos(id))
      return responder_err(res, 'No se puede eliminar: la categoría tiene productos asociados')

    // Relaciones fuera de la cache: se validan en DB
    const en_menu = await global.knex('category_obtaineds_category_menu').where({ category_id: id }).first()
    if (en_menu)
      return responder_err(res, 'No se puede eliminar: la categoría está asociada a categorías de menú')

    const en_empresa = await global.knex('enterprise_category').where({ category_id: id }).first()
    if (en_empresa)
      return responder_err(res, 'No se puede eliminar: la categoría está asociada a empresas')

    if (categorias_cache.tiene_hijos(id))
      return responder_err(res, 'No se puede eliminar: la categoría tiene subcategorías')

    const con_alias = await global.knex('category_alias').where({ category_id: id }).first()
    if (con_alias)
      return responder_err(res, 'No se puede eliminar: la categoría tiene alias asociados')

    await global.knex('category').where({ id }).del()

    categorias_cache.baja(id)
    responder_ok(res, { message: 'Categoría eliminada correctamente' })
  } catch (error) {
    console.log('[categorias] Error en delete_one:', error)
    responder_err(res, 'Error al eliminar la categoría')
  }
})

// POST /add_producto - asocia un producto a una categoria { category_id, product_id }
router.post('/add_producto', async function (req, res) {
  const category_id = String(req.body?.category_id ?? '').trim()
  const product_id = String(req.body?.product_id ?? '').trim()

  if (!category_id) return responder_err(res, 'Categoría requerida')
  if (!product_id) return responder_err(res, 'Debe seleccionar un producto')

  try {
    if (!categorias_cache.obtener(category_id)) return responder_err(res, 'La categoría indicada no existe')
    if (categorias_cache.tiene_producto(category_id, product_id))
      return responder_err(res, 'El producto ya está asociado a esta categoría')

    // El catalogo de productos no vive en esta cache: se valida en DB
    const producto = await global.knex('products').where({ id: product_id }).first()
    if (!producto) return responder_err(res, 'El producto indicado no existe')

    await global.knex('product_category').insert({
      id: uuid.v7(),
      product_id,
      category_id,
    })

    categorias_cache.asociar_producto(category_id, product_id)
    responder_ok(res, { message: 'Producto agregado a la categoría correctamente' })
  } catch (error) {
    console.log('[categorias] Error en add_producto:', error)
    responder_err(res, 'Error al agregar el producto a la categoría')
  }
})

// DELETE /remove_producto - desasocia un producto de una categoria { category_id, product_id }
router.delete('/remove_producto', async function (req, res) {
  const category_id = String(req.body?.category_id ?? req.query?.category_id ?? '').trim()
  const product_id = String(req.body?.product_id ?? req.query?.product_id ?? '').trim()

  if (!category_id) return responder_err(res, 'Categoría requerida')
  if (!product_id) return responder_err(res, 'Producto requerido')

  try {
    const cant = await global.knex('product_category')
      .where({ product_id, category_id }).del()
    if (cant === 0) return responder_err(res, 'El producto no está asociado a esta categoría')

    categorias_cache.desasociar_producto(category_id, product_id)
    responder_ok(res, { message: 'Producto quitado de la categoría correctamente' })
  } catch (error) {
    console.log('[categorias] Error en remove_producto:', error)
    responder_err(res, 'Error al quitar el producto de la categoría')
  }
})
