// ABM admin de locales (tabla `branch`), acotado a cambiar el flag `publicado`.
// El local interno "sin local" (sin_local = 1) no se lista ni es editable.
// Los usuarios no pueden cambiar `publicado` desde sus endpoints (ver helpers/locales_branch.js).
const express = require('express')
var router = express.Router()
module.exports = router
const { sincronizar_comercio } = require('../controllers/comercios_cache')

function responder_ok(res, data) {
  return res.status(200).send({ stat: true, data })
}

function responder_err(res, text) {
  return res.status(200).send({ stat: false, text })
}

const FIELDS_DEF_LOCALES = [
  { field: 'id',        headerName: 'ID',        hide: true },
  { field: 'nombre',    headerName: 'Local',     sortable: true },
  { field: 'comercio',  headerName: 'Comercio',  sortable: true },
  { field: 'ciudad',    headerName: 'Ciudad',    sortable: true },
  { field: 'publicado', headerName: 'Publicado', sortable: true },
]

function armar_query() {
  return global.knex('branch')
    .join('enterprice', 'enterprice.id', 'branch.enterprise_id')
    .whereNull('branch.sin_local')
}

// GET /get_all - listado paginado (contrato TableEditor), excluye "sin local"
router.get('/get_all', async function (req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize) || 25, 1), 200)
  const search = String(req.query.search || '').trim()
  const sortField = req.query.sortField || 'nombre'
  const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc'

  const SORT_COLUMNS = {
    nombre: 'branch.branch_name',
    comercio: 'enterprice.name',
    ciudad: 'branch.city',
    publicado: 'branch.publicado',
  }
  const orderColumn = SORT_COLUMNS[sortField] || SORT_COLUMNS.nombre

  function aplicar_busqueda(q) {
    if (!search) return q
    const like = `%${search}%`
    return q.where(function () {
      this.where('branch.branch_name', 'like', like)
        .orWhere('enterprice.name', 'like', like)
        .orWhere('branch.city', 'like', like)
    })
  }

  try {
    const countRows = await aplicar_busqueda(armar_query()).count('branch.id as c')
    const total = parseInt(countRows[0].c)
    const filas = await aplicar_busqueda(armar_query())
      .select(
        'branch.id as id',
        'branch.branch_name as nombre',
        'enterprice.name as comercio',
        'branch.city as ciudad',
        'branch.publicado as publicado'
      )
      .orderBy(orderColumn, sortOrder)
      .offset((page - 1) * pageSize)
      .limit(pageSize)

    const rows = filas.map((f) => ({ ...f, publicado: !!f.publicado }))
    responder_ok(res, { rows, fields_def: FIELDS_DEF_LOCALES, total, page, pageSize })
  } catch (error) {
    console.log('[locales_admin] Error en get_all:', error)
    responder_err(res, 'Error al listar locales')
  }
})

// Acepta true/false o 1/0 (el formulario genérico envía checkbox como 1/0)
function normalizar_booleano(valor) {
  if (valor === true || valor === 1 || valor === '1') return true
  if (valor === false || valor === 0 || valor === '0') return false
  return null
}

// PUT /put_one - body { id, publicado }; el resto de los campos se ignora
router.put('/put_one', async function (req, res) {
  const id = parseInt(req.body?.id)
  const publicado = normalizar_booleano(req.body?.publicado)

  if (!id) return responder_err(res, 'Local inválido')
  if (publicado === null) return responder_err(res, 'El campo publicado debe ser verdadero o falso')

  try {
    const local = await global.knex('branch').where({ id }).whereNull('sin_local').first('id')
    if (!local) return responder_err(res, 'El local no existe')

    await global.knex('branch').where({ id }).update({ publicado })
    await sincronizar_comercio(global.knex, { branch_id: id })
    responder_ok(res, { id, publicado })
  } catch (error) {
    console.log('[locales_admin] Error en put_one:', error)
    responder_err(res, 'Error al actualizar el local')
  }
})
