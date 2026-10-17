// ABM de alias de categoria (tabla `category_alias`): un alias (texto libre)
// asociado a una categoria. La pareja (category_id, alias) es unica (DB +
// validacion case-insensitive en app). Se usa luego como selector en el ABM
// de Indices de Precios.
const express = require('express')
var router = express.Router()
module.exports = router

function responder_ok(res, data) {
  return res.status(200).send({ stat: true, data })
}

function responder_err(res, text) {
  return res.status(200).send({ stat: false, text })
}

const FIELDS_DEF_ALIAS_CATEGORIAS = [
  { field: 'id',            headerName: 'ID',         hide: true },
  { field: 'category_id',   headerName: 'ID Categoría', hide: true },
  { field: 'category_name', headerName: 'Categoría',  sortable: true },
  { field: 'alias',         headerName: 'Alias',      sortable: true },
]

// Sanitizacion liviana: sin saltos de linea, sin espacios dobles, longitud maxima
function limpiar_alias(texto) {
  return String(texto ?? '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255)
}

function armar_query() {
  return global.knex('category_alias')
    .select(
      'category_alias.id as id',
      'category_alias.category_id as category_id',
      'category_alias.alias as alias',
      'category.name as category_name'
    )
    .join('category', 'category.id', 'category_alias.category_id')
}

// GET /get_all - listado paginado (contrato TableEditor)
router.get('/get_all', async function (req, res) {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 25
  const search = req.query.search || ''
  const sortField = req.query.sortField || 'category_name'
  const sortOrder = req.query.sortOrder || 'asc'

  let filters = {}
  try { filters = req.query.filters ? JSON.parse(req.query.filters) : {} } catch (e) { filters = {} }

  const FILTER_COLUMNS = {
    category_name: ['category.name', 'like'],
    alias: ['category_alias.alias', 'like'],
  }

  function aplicar_filtros(q) {
    for (const [field, value] of Object.entries(filters)) {
      const def = FILTER_COLUMNS[field]
      if (!def || value === undefined || value === null || value === '') continue
      q.where(def[0], 'like', `%${value}%`)
    }
    if (search) {
      q.where(function () {
        this.where('category.name', 'like', `%${search}%`)
          .orWhere('category_alias.alias', 'like', `%${search}%`)
      })
    }
    return q
  }

  const query = aplicar_filtros(armar_query())
  const countQuery = aplicar_filtros(armar_query()).clearSelect().clearOrder()

  const SORT_COLUMNS = {
    category_name: 'category.name',
    alias: 'category_alias.alias',
  }
  const orderColumn = SORT_COLUMNS[sortField] || SORT_COLUMNS.category_name

  try {
    const total = parseInt((await countQuery.count('category_alias.id as c'))[0].c)
    const offset = (page - 1) * pageSize
    const rows = await query
      .orderBy(orderColumn, sortOrder === 'desc' ? 'desc' : 'asc')
      .offset(offset)
      .limit(pageSize)

    responder_ok(res, { rows, fields_def: FIELDS_DEF_ALIAS_CATEGORIAS, total, page, pageSize })
  } catch (error) {
    console.log('[alias_categorias] Error en get_all:', error)
    responder_err(res, 'Error al listar alias de categorías')
  }
})

// GET /categorias_disponibles - categorias (id + name) para el selector del formulario
router.get('/categorias_disponibles', async function (req, res) {
  const search = String(req.query.search || '').trim()
  const limit = Math.min(parseInt(req.query.limit) || 20, 100)

  try {
    let query = global.knex('category').select('id', 'name')
    if (search) query = query.where('name', 'like', `%${search}%`)
    const rows = await query.orderBy('name', 'asc').limit(limit)
    responder_ok(res, { rows })
  } catch (error) {
    console.log('[alias_categorias] Error en categorias_disponibles:', error)
    responder_err(res, 'Error al buscar categorías')
  }
})

// Valida alias + category_id comunes a alta y edicion (id_actual en edicion)
async function validar_payload(body, id_actual) {
  const alias = limpiar_alias(body?.alias)
  const category_id = String(body?.category_id ?? '').trim()

  if (!alias) return { error: 'El alias es obligatorio' }
  if (!category_id) return { error: 'Debe seleccionar una categoría' }

  const categoria = await global.knex('category').where({ id: category_id }).first()
  if (!categoria) return { error: 'La categoría indicada no existe' }

  let q = global.knex('category_alias')
    .where({ category_id })
    .whereRaw('LOWER(alias) = ?', [alias.toLowerCase()])
  if (id_actual) q = q.whereNot({ id: id_actual })
  const duplicado = await q.first()
  if (duplicado) return { error: 'Ya existe ese alias para esa categoría' }

  return { alias, category_id }
}

// POST /add_one - crea un alias de categoria { category_id, alias }
router.post('/add_one', async function (req, res) {
  try {
    const validacion = await validar_payload(req.body, null)
    if (validacion.error) return responder_err(res, validacion.error)

    await global.knex('category_alias').insert({
      category_id: validacion.category_id,
      alias: validacion.alias,
    })

    responder_ok(res, { message: 'Alias de categoría creado correctamente' })
  } catch (error) {
    console.log('[alias_categorias] Error en add_one:', error)
    responder_err(res, 'Error al crear el alias de categoría')
  }
})

// PUT /put_one - edita un alias de categoria { id, category_id, alias }
router.put('/put_one', async function (req, res) {
  const id_actual = parseInt(req.body?.id)
  if (!id_actual) return responder_err(res, 'Alias de categoría requerido')

  try {
    const existente = await global.knex('category_alias').where({ id: id_actual }).first()
    if (!existente) return responder_err(res, 'Alias de categoría no encontrado')

    const validacion = await validar_payload(req.body, id_actual)
    if (validacion.error) return responder_err(res, validacion.error)

    await global.knex('category_alias').where({ id: id_actual }).update({
      category_id: validacion.category_id,
      alias: validacion.alias,
    })

    responder_ok(res, { message: 'Alias de categoría actualizado correctamente' })
  } catch (error) {
    console.log('[alias_categorias] Error en put_one:', error)
    responder_err(res, 'Error al actualizar el alias de categoría')
  }
})

// DELETE /delete_one - elimina un alias de categoria { id }. Bloqueado si
// esta referenciado por un indice de precios.
router.delete('/delete_one', async function (req, res) {
  const id = parseInt(req.body?.id)
  if (!id) return responder_err(res, 'Alias de categoría requerido')

  try {
    const existente = await global.knex('category_alias').where({ id }).first()
    if (!existente) return responder_err(res, 'Alias de categoría no encontrado')

    const en_indice = await global.knex('indices_precios').where({ category_alias_id: id }).first()
    if (en_indice)
      return responder_err(res, 'No se puede eliminar: el alias está siendo usado por un índice de precios')

    await global.knex('category_alias').where({ id }).del()

    responder_ok(res, { message: 'Alias de categoría eliminado correctamente' })
  } catch (error) {
    console.log('[alias_categorias] Error en delete_one:', error)
    responder_err(res, 'Error al eliminar el alias de categoría')
  }
})
