// ABM de alias_productos (alias -> producto). Listado server-side con contrato
// TableEditor, alta/edicion/borrado y busqueda de productos para el selector.
// La tabla no tiene id: PK compuesta (alias, product_id); se usa `alias` como
// identificador de fila (un alias apunta a un unico producto). Tras cada
// mutacion se regeneran los diccionarios en memoria.
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

function armar_query() {
  return global.knex('alias_productos')
    .select(
      'alias_productos.alias as id',
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

  const query = armar_query()
  const countQuery = global.knex('alias_productos')

  if (search) {
    const like = `%${search}%`
    query.where(function () {
      this.where('alias_productos.alias', 'like', like)
        .orWhere('products.name', 'like', like)
    })
    countQuery.where('alias_productos.alias', 'like', like)
  }

  const SORT_COLUMNS = {
    id: 'alias_productos.alias',
    alias: 'alias_productos.alias',
    product_name: 'products.name',
  }
  const orderColumn = SORT_COLUMNS[sortField] || SORT_COLUMNS.id

  try {
    const total = parseInt((await countQuery.count('* as c'))[0].c)
    const offset = (page - 1) * pageSize
    const rows = await query
      .orderBy(orderColumn, sortOrder === 'desc' ? 'desc' : 'asc')
      .offset(offset)
      .limit(pageSize)

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

// Valida alias + product_id comunes a alta y edicion (alias_actual en edicion)
async function validar_payload(body, alias_actual) {
  const alias = limpiar_alias(body?.alias)
  const product_id = String(body?.product_id ?? '').trim()

  if (!alias) return { error: 'El alias es obligatorio' }
  if (!product_id) return { error: 'Debe seleccionar un producto' }

  const producto = await global.knex('products').where({ id: product_id }).first()
  if (!producto) return { error: 'El producto indicado no existe' }

  let q = global.knex('alias_productos')
    .whereRaw('LOWER(alias) = ?', [alias.toLowerCase()])
  if (alias_actual) q = q.whereNot({ alias: alias_actual })
  const duplicado = await q.first()
  if (duplicado) return { error: 'Ya existe un alias igual (los alias no distinguen mayúsculas)' }

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

// PUT /put_one - edita un alias { id: alias actual, alias, product_id }
router.put('/put_one', async function (req, res) {
  const alias_actual = String(req.body?.id ?? req.body?.alias ?? '').trim()
  if (!alias_actual) return responder_err(res, 'Alias actual requerido')

  try {
    const existente = await global.knex('alias_productos').where({ alias: alias_actual }).first()
    if (!existente) return responder_err(res, 'Alias no encontrado')

    const validacion = await validar_payload(req.body, alias_actual)
    if (validacion.error) return responder_err(res, validacion.error)

    await global.knex('alias_productos').where({ alias: alias_actual }).update({
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

// DELETE /delete_one - elimina un alias { id: alias }
router.delete('/delete_one', async function (req, res) {
  const alias = String(req.body?.id ?? '').trim()
  if (!alias) return responder_err(res, 'Alias requerido')

  try {
    const cant = await global.knex('alias_productos').where({ alias }).del()
    if (cant === 0) return responder_err(res, 'Alias no encontrado')

    const { regenerar_diccionarios } = require('../server')
    await regenerar_diccionarios()

    responder_ok(res, { message: 'Alias eliminado correctamente' })
  } catch (error) {
    console.log('[alias_productos] Error en delete_one:', error)
    responder_err(res, 'Error al eliminar el alias')
  }
})
