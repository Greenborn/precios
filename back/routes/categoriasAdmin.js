// ABM de categorias de productos (tabla `category`) con gestion de la relacion
// N-N product_category. Listado server-side con contrato TableEditor, alta/
// edicion/borrado (bloqueado si tiene productos asociados) y endpoints para
// listar/agregar/quitar productos de una categoria. Tras cada mutacion se
// regeneran los diccionarios en memoria.
const express = require('express')
const uuid = require('uuid')
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

async function regenerar_caches() {
  const { regenerar_diccionarios } = require('../server')
  await regenerar_diccionarios()
}

function armar_query() {
  return global.knex('category')
    .select(
      'category.id as id',
      'category.name as name',
      global.knex.raw('COUNT(product_category.product_id) as cant_productos')
    )
    .leftJoin('product_category', 'product_category.category_id', 'category.id')
    .groupBy('category.id', 'category.name')
}

// GET /get_all - listado paginado (contrato TableEditor)
router.get('/get_all', async function (req, res) {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 25
  const search = req.query.search || ''
  const sortField = req.query.sortField || 'name'
  const sortOrder = req.query.sortOrder || 'asc'

  // Filtros por columna: { campo: "valor" } (JSON string desde la libreria)
  let filters = {}
  try { filters = req.query.filters ? JSON.parse(req.query.filters) : {} } catch (e) { filters = {} }

  const FILTER_COLUMNS = {
    id: ['category.id', 'eq'],
    name: ['category.name', 'like'],
  }

  function aplicar_filtros(q) {
    for (const [field, value] of Object.entries(filters)) {
      const def = FILTER_COLUMNS[field]
      if (!def || value === undefined || value === null || value === '') continue
      q.where(def[0], def[1] === 'eq' ? '=' : 'like', def[1] === 'eq' ? value : `%${value}%`)
    }
    if (search) {
      q.where('category.name', 'like', `%${search}%`)
    }
    return q
  }

  const query = aplicar_filtros(armar_query())
  const countQuery = aplicar_filtros(
    global.knex('category').select('category.id')
  ).clearSelect().count('category.id as c')

  const SORT_COLUMNS = {
    id: 'category.id',
    name: 'category.name',
    cant_productos: 'cant_productos',
  }
  const orderColumn = SORT_COLUMNS[sortField] || SORT_COLUMNS.name

  try {
    const total = parseInt((await countQuery)[0].c)
    const offset = (page - 1) * pageSize
    const rows = await query
      .orderBy(orderColumn, sortOrder === 'desc' ? 'desc' : 'asc')
      .offset(offset)
      .limit(pageSize)

    for (const r of rows) r.cant_productos = parseInt(r.cant_productos) || 0

    responder_ok(res, { rows, fields_def: FIELDS_DEF_CATEGORIAS, total, page, pageSize })
  } catch (error) {
    console.log('[categorias] Error en get_all:', error)
    responder_err(res, 'Error al listar categorías')
  }
})

// GET /productos_categoria - productos asociados a una categoria (paginado)
router.get('/productos_categoria', async function (req, res) {
  const category_id = String(req.query.category_id ?? '').trim()
  if (!category_id) return responder_err(res, 'Categoría requerida')

  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 25
  const search = req.query.search || ''

  try {
    const categoria = await global.knex('category').where({ id: category_id }).first()
    if (!categoria) return responder_err(res, 'La categoría indicada no existe')

    function armar_q() {
      let q = global.knex('products')
        .select('products.id as id', 'products.name as name')
        .join('product_category', 'product_category.product_id', 'products.id')
        .where('product_category.category_id', category_id)
      if (search) q = q.where('products.name', 'like', `%${search}%`)
      return q
    }

    const countQuery = global.knex('products')
      .join('product_category', 'product_category.product_id', 'products.id')
      .where('product_category.category_id', category_id)
    if (search) countQuery.where('products.name', 'like', `%${search}%`)
    const total = parseInt((await countQuery.count('products.id as c'))[0].c)

    const rows = await armar_q()
      .orderBy('products.name', 'asc')
      .offset((page - 1) * pageSize)
      .limit(pageSize)

    responder_ok(res, { rows, fields_def: FIELDS_DEF_PRODUCTOS_CATEGORIA, total, page, pageSize })
  } catch (error) {
    console.log('[categorias] Error en productos_categoria:', error)
    responder_err(res, 'Error al listar productos de la categoría')
  }
})

// GET /productos_disponibles - productos (id + name) para el selector
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

// Valida nombre de categoria comun a alta y edicion (id_actual en edicion)
async function validar_payload(body, id_actual) {
  const name = limpiar_nombre(body?.name)

  if (!name) return { error: 'El nombre de la categoría es obligatorio' }

  let q = global.knex('category')
    .whereRaw('LOWER(name) = ?', [name.toLowerCase()])
  if (id_actual) q = q.whereNot({ id: id_actual })
  const duplicado = await q.first()
  if (duplicado) return { error: 'Ya existe una categoría con ese nombre' }

  return { name }
}

// POST /add_one - crea una categoria { name }
router.post('/add_one', async function (req, res) {
  try {
    const validacion = await validar_payload(req.body, null)
    if (validacion.error) return responder_err(res, validacion.error)

    const id = uuid.v7()
    await global.knex('category').insert({ id, name: validacion.name })

    await regenerar_caches()
    responder_ok(res, { message: 'Categoría creada correctamente' })
  } catch (error) {
    console.log('[categorias] Error en add_one:', error)
    responder_err(res, 'Error al crear la categoría')
  }
})

// PUT /put_one - edita una categoria { id, name }
router.put('/put_one', async function (req, res) {
  const id_actual = String(req.body?.id ?? '').trim()
  if (!id_actual) return responder_err(res, 'Categoría requerida')

  try {
    const existente = await global.knex('category').where({ id: id_actual }).first()
    if (!existente) return responder_err(res, 'Categoría no encontrada')

    const validacion = await validar_payload(req.body, id_actual)
    if (validacion.error) return responder_err(res, validacion.error)

    await global.knex('category').where({ id: id_actual }).update({ name: validacion.name })

    await regenerar_caches()
    responder_ok(res, { message: 'Categoría actualizada correctamente' })
  } catch (error) {
    console.log('[categorias] Error en put_one:', error)
    responder_err(res, 'Error al actualizar la categoría')
  }
})

// DELETE /delete_one - elimina una categoria { id }. Bloqueado si tiene
// productos asociados via product_category.
router.delete('/delete_one', async function (req, res) {
  const id = String(req.body?.id ?? '').trim()
  if (!id) return responder_err(res, 'Categoría requerida')

  try {
    const existente = await global.knex('category').where({ id }).first()
    if (!existente) return responder_err(res, 'Categoría no encontrada')

    const asociados = await global.knex('product_category').where({ category_id: id }).first()
    if (asociados)
      return responder_err(res, 'No se puede eliminar: la categoría tiene productos asociados')

    // Validar que no este referenciada por otras relaciones de categorias
    const en_menu = await global.knex('category_obtaineds_category_menu').where({ category_id: id }).first()
    if (en_menu)
      return responder_err(res, 'No se puede eliminar: la categoría está asociada a categorías de menú')

    const en_empresa = await global.knex('enterprise_category').where({ category_id: id }).first()
    if (en_empresa)
      return responder_err(res, 'No se puede eliminar: la categoría está asociada a empresas')

    await global.knex('category').where({ id }).del()

    await regenerar_caches()
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
    const categoria = await global.knex('category').where({ id: category_id }).first()
    if (!categoria) return responder_err(res, 'La categoría indicada no existe')

    const producto = await global.knex('products').where({ id: product_id }).first()
    if (!producto) return responder_err(res, 'El producto indicado no existe')

    const existe = await global.knex('product_category')
      .where({ product_id, category_id }).first()
    if (existe) return responder_err(res, 'El producto ya está asociado a esta categoría')

    await global.knex('product_category').insert({
      id: uuid.v7(),
      product_id,
      category_id,
    })

    await regenerar_caches()
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

    await regenerar_caches()
    responder_ok(res, { message: 'Producto quitado de la categoría correctamente' })
  } catch (error) {
    console.log('[categorias] Error en remove_producto:', error)
    responder_err(res, 'Error al quitar el producto de la categoría')
  }
})
