// ABM de alias_productos (alias -> producto). Listado server-side con contrato
// TableEditor, alta/edicion/borrado y busqueda de productos para el selector.
// La tabla no tiene id: unicidad por el par (alias, product_id); un mismo
// alias puede apuntar a varios productos. El identificador de fila es el id
// compuesto "alias||product_id". Tras cada mutacion se regeneran los
// diccionarios en memoria.
const express = require('express')
var router = express.Router()
module.exports = router

function responder_ok(res, data) {
  return res.status(200).send({ stat: true, data })
}

function responder_err(res, text) {
  return res.status(200).send({ stat: false, text })
}

const FIELDS_DEF_ALIAS_PRODUCTOS = [
  { field: 'id',           headerName: 'Alias',      sortable: true },
  { field: 'product_id',   headerName: 'ID Producto' },
  { field: 'product_name', headerName: 'Producto',   sortable: true },
]

// Sanitizacion liviana: sin saltos de linea, sin espacios dobles, longitud maxima
function limpiar_alias(texto) {
  return String(texto ?? '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1024)
}

const SEPARADOR_ID = '||'

function armar_id_compuesto(alias, product_id) {
  return `${alias}${SEPARADOR_ID}${product_id}`
}

function separar_id_compuesto(id_compuesto) {
  const partes = String(id_compuesto ?? '').split(SEPARADOR_ID)
  if (partes.length < 2) return null
  const product_id = partes.pop()
  const alias = partes.join(SEPARADOR_ID)
  if (!alias || !product_id) return null
  return { alias, product_id }
}

function armar_query() {
  return global.knex('alias_productos')
    .select(
      'alias_productos.alias as alias',
      'alias_productos.product_id as product_id',
      'products.name as product_name'
    )
    .leftJoin('products', 'products.id', 'alias_productos.product_id')
}

// GET /get_all - listado paginado (contrato TableEditor)
router.get('/get_all', async function (req, res) {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 25
  const search = req.query.search || ''
  const sortField = req.query.sortField || 'id'
  const sortOrder = req.query.sortOrder || 'asc'

  // Filtros por columna: { campo: "valor" } (JSON string desde la libreria)
  let filters = {}
  try { filters = req.query.filters ? JSON.parse(req.query.filters) : {} } catch (e) { filters = {} }

  // Whitelist campo -> [columna real, modo]
  const FILTER_COLUMNS = {
    id: ['alias_productos.alias', 'like'],
    alias: ['alias_productos.alias', 'like'],
    product_id: ['alias_productos.product_id', 'eq'],
    product_name: ['products.name', 'like'],
  }

  function aplicar_filtros(q) {
    for (const [field, value] of Object.entries(filters)) {
      const def = FILTER_COLUMNS[field]
      if (!def || value === undefined || value === null || value === '') continue
      q.where(def[0], def[1] === 'eq' ? '=' : 'like', def[1] === 'eq' ? value : `%${value}%`)
    }
    if (search) {
      const like = `%${search}%`
      q.where(function () {
        this.where('alias_productos.alias', 'like', like)
          .orWhere('products.name', 'like', like)
      })
    }
    return q
  }

  const query = aplicar_filtros(armar_query())
  const countQuery = aplicar_filtros(armar_query()).clearSelect().clearOrder()

  const SORT_COLUMNS = {
    id: 'alias_productos.alias',
    alias: 'alias_productos.alias',
    product_name: 'products.name',
  }
  const orderColumn = SORT_COLUMNS[sortField] || SORT_COLUMNS.id

  try {
    const total = parseInt((await countQuery.count('* as c'))[0].c)
    const offset = (page - 1) * pageSize
    const rows = (await query
      .orderBy(orderColumn, sortOrder === 'desc' ? 'desc' : 'asc')
      .offset(offset)
      .limit(pageSize))
      .map(r => ({ ...r, id: armar_id_compuesto(r.alias, r.product_id) }))

    responder_ok(res, { rows, fields_def: FIELDS_DEF_ALIAS_PRODUCTOS, total, page, pageSize })
  } catch (error) {
    console.log('[alias_productos] Error en get_all:', error)
    responder_err(res, 'Error al listar alias de productos')
  }
})

// GET /productos - productos (id + name) para el selector del formulario
router.get('/productos', async function (req, res) {
  const search = String(req.query.search || '').trim()
  const limit = Math.min(parseInt(req.query.limit) || 1000, 5000)

  try {
    let query = global.knex('products').select('id', 'name')
    if (search) query = query.where('name', 'like', `%${search}%`)
    const rows = await query.orderBy('name', 'asc').limit(limit)
    responder_ok(res, { rows })
  } catch (error) {
    console.log('[alias_productos] Error en productos:', error)
    responder_err(res, 'Error al buscar productos')
  }
})

// Valida alias + product_id comunes a alta y edicion (par_actual en edicion):
// el duplicado es el par (alias case-insensitive, product_id), el alias en si
// puede repetirse apuntando a otros productos.
async function validar_payload(body, par_actual) {
  const alias = limpiar_alias(body?.alias)
  const product_id = String(body?.product_id ?? '').trim()

  if (!alias) return { error: 'El alias es obligatorio' }
  if (!product_id) return { error: 'Debe seleccionar un producto' }

  const producto = await global.knex('products').where({ id: product_id }).first()
  if (!producto) return { error: 'El producto indicado no existe' }

  let q = global.knex('alias_productos')
    .whereRaw('LOWER(alias) = ?', [alias.toLowerCase()])
    .andWhere({ product_id })
  if (par_actual)
    q = q.whereNot(function () {
      this.whereRaw('LOWER(alias) = ?', [par_actual.alias.toLowerCase()])
        .andWhere({ product_id: par_actual.product_id })
    })
  const duplicado = await q.first()
  if (duplicado) return { error: 'Ya existe ese alias para ese producto (los alias no distinguen mayúsculas)' }

  return { alias, product_id }
}

// POST /add_one - crea un alias { alias, product_id }
router.post('/add_one', async function (req, res) {
  try {
    const validacion = await validar_payload(req.body, null)
    if (validacion.error) return responder_err(res, validacion.error)

    await global.knex('alias_productos').insert({
      alias: validacion.alias,
      product_id: validacion.product_id,
    })

    const { regenerar_diccionarios } = require('../server')
    await regenerar_diccionarios()

    responder_ok(res, { message: 'Alias creado correctamente' })
  } catch (error) {
    console.log('[alias_productos] Error en add_one:', error)
    responder_err(res, 'Error al crear el alias')
  }
})

// PUT /put_one - edita un alias { id: "alias||product_id", alias, product_id }
router.put('/put_one', async function (req, res) {
  const par_actual = separar_id_compuesto(req.body?.id)
  if (!par_actual) return responder_err(res, 'Identificador de fila requerido')

  try {
    const existente = await global.knex('alias_productos')
      .whereRaw('LOWER(alias) = ?', [par_actual.alias.toLowerCase()])
      .andWhere({ product_id: par_actual.product_id })
      .first()
    if (!existente) return responder_err(res, 'Alias no encontrado')

    const validacion = await validar_payload(req.body, par_actual)
    if (validacion.error) return responder_err(res, validacion.error)

    await global.knex('alias_productos')
      .whereRaw('LOWER(alias) = ?', [par_actual.alias.toLowerCase()])
      .andWhere({ product_id: par_actual.product_id })
      .update({
        alias: validacion.alias,
        product_id: validacion.product_id,
      })

    const { regenerar_diccionarios } = require('../server')
    await regenerar_diccionarios()

    responder_ok(res, { message: 'Alias actualizado correctamente' })
  } catch (error) {
    console.log('[alias_productos] Error en put_one:', error)
    responder_err(res, 'Error al actualizar el alias')
  }
})

// DELETE /delete_one - elimina un alias { id: "alias||product_id" }
router.delete('/delete_one', async function (req, res) {
  const par = separar_id_compuesto(req.body?.id)
  if (!par) return responder_err(res, 'Identificador de fila requerido')

  try {
    const cant = await global.knex('alias_productos')
      .whereRaw('LOWER(alias) = ?', [par.alias.toLowerCase()])
      .andWhere({ product_id: par.product_id })
      .del()
    if (cant === 0) return responder_err(res, 'Alias no encontrado')

    const { regenerar_diccionarios } = require('../server')
    await regenerar_diccionarios()

    responder_ok(res, { message: 'Alias eliminado correctamente' })
  } catch (error) {
    console.log('[alias_productos] Error en delete_one:', error)
    responder_err(res, 'Error al eliminar el alias')
  }
})
