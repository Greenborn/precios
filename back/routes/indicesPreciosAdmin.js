// ABM de Indices de Precios (tabla `indices_precios`). Por el momento el
// indice solo se identifica por su nombre (cod_indice, PK) y referencia un
// alias de categoria (category_alias). La asociacion con productos puntuales
// (productos_indice/registro_indice) se definira en una etapa posterior.
const express = require('express')
var router = express.Router()
module.exports = router

function responder_ok(res, data) {
  return res.status(200).send({ stat: true, data })
}

function responder_err(res, text) {
  return res.status(200).send({ stat: false, text })
}

const FIELDS_DEF_INDICES_PRECIOS = [
  { field: 'id',                     headerName: 'ID',                hide: true },
  { field: 'cod_indice',             headerName: 'Nombre del índice', sortable: true },
  { field: 'category_alias_id',      headerName: 'ID Alias',          hide: true },
  { field: 'alias_categoria_display', headerName: 'Alias de categoría', sortable: true },
]

// Sanitizacion liviana: sin saltos de linea, sin espacios dobles, longitud maxima
function limpiar_nombre(texto) {
  return String(texto ?? '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255)
}

function armar_query() {
  return global.knex('indices_precios')
    .select(
      'indices_precios.cod_indice as id',
      'indices_precios.cod_indice as cod_indice',
      'indices_precios.category_alias_id as category_alias_id',
      global.knex.raw("CONCAT(category.name, ' - ', category_alias.alias) as alias_categoria_display")
    )
    .join('category_alias', 'category_alias.id', 'indices_precios.category_alias_id')
    .join('category', 'category.id', 'category_alias.category_id')
}

// GET /get_all - listado paginado (contrato TableEditor)
router.get('/get_all', async function (req, res) {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 25
  const search = req.query.search || ''
  const sortField = req.query.sortField || 'cod_indice'
  const sortOrder = req.query.sortOrder || 'asc'

  let filters = {}
  try { filters = req.query.filters ? JSON.parse(req.query.filters) : {} } catch (e) { filters = {} }

  const FILTER_COLUMNS = {
    cod_indice: ['indices_precios.cod_indice', 'like'],
    alias_categoria_display: null, // calculado; se filtra via search general
  }

  function aplicar_filtros(q) {
    for (const [field, value] of Object.entries(filters)) {
      const def = FILTER_COLUMNS[field]
      if (!def || value === undefined || value === null || value === '') continue
      q.where(def[0], 'like', `%${value}%`)
    }
    if (search) {
      const like = `%${search}%`
      q.where(function () {
        this.where('indices_precios.cod_indice', 'like', like)
          .orWhere('category.name', 'like', like)
          .orWhere('category_alias.alias', 'like', like)
      })
    }
    return q
  }

  const query = aplicar_filtros(armar_query())
  const countQuery = aplicar_filtros(armar_query()).clearSelect().clearOrder()

  const SORT_COLUMNS = {
    cod_indice: 'indices_precios.cod_indice',
    alias_categoria_display: 'category_alias.alias',
  }
  const orderColumn = SORT_COLUMNS[sortField] || SORT_COLUMNS.cod_indice

  try {
    const total = parseInt((await countQuery.count('indices_precios.cod_indice as c'))[0].c)
    const offset = (page - 1) * pageSize
    const rows = await query
      .orderBy(orderColumn, sortOrder === 'desc' ? 'desc' : 'asc')
      .offset(offset)
      .limit(pageSize)

    responder_ok(res, { rows, fields_def: FIELDS_DEF_INDICES_PRECIOS, total, page, pageSize })
  } catch (error) {
    console.log('[indices_precios] Error en get_all:', error)
    responder_err(res, 'Error al listar índices de precios')
  }
})

// GET /alias_categoria_disponibles - alias de categoria para el selector del formulario
router.get('/alias_categoria_disponibles', async function (req, res) {
  const search = String(req.query.search || '').trim()
  const limit = Math.min(parseInt(req.query.limit) || 20, 100)

  try {
    let query = global.knex('category_alias')
      .select(
        'category_alias.id as id',
        global.knex.raw("CONCAT(category.name, ' - ', category_alias.alias) as display")
      )
      .join('category', 'category.id', 'category_alias.category_id')
    if (search) {
      const like = `%${search}%`
      query = query.where(function () {
        this.where('category_alias.alias', 'like', like).orWhere('category.name', 'like', like)
      })
    }
    const rows = await query.orderBy('category.name', 'asc').limit(limit)
    responder_ok(res, { rows })
  } catch (error) {
    console.log('[indices_precios] Error en alias_categoria_disponibles:', error)
    responder_err(res, 'Error al buscar alias de categoría')
  }
})

// Valida cod_indice + category_alias_id comunes a alta y edicion
// (cod_indice_actual en edicion, para permitir renombrar el indice)
async function validar_payload(body, cod_indice_actual) {
  const cod_indice = limpiar_nombre(body?.cod_indice)
  const category_alias_id = parseInt(body?.category_alias_id)

  if (!cod_indice) return { error: 'El nombre del índice es obligatorio' }
  if (!category_alias_id) return { error: 'Debe seleccionar un alias de categoría' }

  const alias_categoria = await global.knex('category_alias').where({ id: category_alias_id }).first()
  if (!alias_categoria) return { error: 'El alias de categoría indicado no existe' }

  let q = global.knex('indices_precios').whereRaw('LOWER(cod_indice) = ?', [cod_indice.toLowerCase()])
  if (cod_indice_actual) q = q.whereNot({ cod_indice: cod_indice_actual })
  const duplicado = await q.first()
  if (duplicado) return { error: 'Ya existe un índice con ese nombre' }

  return { cod_indice, category_alias_id }
}

// POST /add_one - crea un indice { cod_indice, category_alias_id }
router.post('/add_one', async function (req, res) {
  try {
    const validacion = await validar_payload(req.body, null)
    if (validacion.error) return responder_err(res, validacion.error)

    await global.knex('indices_precios').insert({
      cod_indice: validacion.cod_indice,
      category_alias_id: validacion.category_alias_id,
    })

    responder_ok(res, { message: 'Índice de precios creado correctamente' })
  } catch (error) {
    console.log('[indices_precios] Error en add_one:', error)
    responder_err(res, 'Error al crear el índice de precios')
  }
})

// PUT /put_one - edita un indice { id: cod_indice actual, cod_indice, category_alias_id }
router.put('/put_one', async function (req, res) {
  const cod_indice_actual = String(req.body?.id ?? '').trim()
  if (!cod_indice_actual) return responder_err(res, 'Índice requerido')

  try {
    const existente = await global.knex('indices_precios').where({ cod_indice: cod_indice_actual }).first()
    if (!existente) return responder_err(res, 'Índice no encontrado')

    const validacion = await validar_payload(req.body, cod_indice_actual)
    if (validacion.error) return responder_err(res, validacion.error)

    await global.knex('indices_precios').where({ cod_indice: cod_indice_actual }).update({
      cod_indice: validacion.cod_indice,
      category_alias_id: validacion.category_alias_id,
    })

    responder_ok(res, { message: 'Índice de precios actualizado correctamente' })
  } catch (error) {
    console.log('[indices_precios] Error en put_one:', error)
    responder_err(res, 'Error al actualizar el índice de precios')
  }
})

// DELETE /delete_one - elimina un indice { id: cod_indice }
router.delete('/delete_one', async function (req, res) {
  const cod_indice = String(req.body?.id ?? '').trim()
  if (!cod_indice) return responder_err(res, 'Índice requerido')

  try {
    const cant = await global.knex('indices_precios').where({ cod_indice }).del()
    if (cant === 0) return responder_err(res, 'Índice no encontrado')

    responder_ok(res, { message: 'Índice de precios eliminado correctamente' })
  } catch (error) {
    console.log('[indices_precios] Error en delete_one:', error)
    responder_err(res, 'Error al eliminar el índice de precios')
  }
})
