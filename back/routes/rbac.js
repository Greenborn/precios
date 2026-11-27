const express = require('express')
var router = express.Router()
module.exports = router
const { es_admin } = require('../helpers/authorization')

const SOLO_ADMIN = 'Solo un administrador puede otorgar roles o permisos'

// Ademas del permiso de la ruta (middleware/Admin.js), otorgar roles o permisos exige ser administrador
function solo_admin(req, res, next) {
  if (!es_admin(req)) return err(res, SOLO_ADMIN)
  next()
}

const FIELDS_DEF_ROLES = [
  { field: 'id',          headerName: 'ID',          sortable: true },
  { field: 'nombre',      headerName: 'Nombre',      sortable: true },
  { field: 'descripcion', headerName: 'Descripción', sortable: true },
]

const FIELDS_DEF_PERMISOS = [
  { field: 'id',          headerName: 'ID',          sortable: true },
  { field: 'nombre',      headerName: 'Nombre',      sortable: true },
  { field: 'descripcion', headerName: 'Descripción', sortable: true },
]

const FIELDS_DEF_RUTAS = [
  { field: 'id',                 headerName: 'ID',        sortable: true },
  { field: 'id_ruta_root',       headerName: 'Ruta padre', sortable: true },
  { field: 'path',               headerName: 'Path',      sortable: true },
  { field: 'componente',         headerName: 'Componente', sortable: true },
  { field: 'icon',               headerName: 'Icono',     sortable: true },
  { field: 'title',              headerName: 'Título',    sortable: true },
  { field: 'orden_visualizacion', headerName: 'Orden',     sortable: true },
]

function ok(res, data) { return res.status(200).send({ stat: true, data }) }
function err(res, text) { return res.status(200).send({ stat: false, text }) }

// Construye un query paginado/filtrado/ordenado con el contrato de vue-table-editor.
// Recibe req.query: page, pageSize, search, sortField, sortOrder, filters (JSON string).
function buildListQuery(baseQuery, req, searchFields, sortWhitelist) {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 25
  const search = req.query.search || ''
  const sortField = req.query.sortField || 'id'
  const sortOrder = req.query.sortOrder || 'asc'

  let query = baseQuery
  if (search) {
    query = query.where(function () {
      for (const f of searchFields) this.orWhere(f, 'like', `%${search}%`)
    })
  }

  // Filtros por columna: { campo: "valor" } (JSON string desde la libreria)
  let filters = {}
  try { filters = req.query.filters ? JSON.parse(req.query.filters) : {} } catch (e) { filters = {} }
  for (const [field, value] of Object.entries(filters)) {
    if (value) query = query.where(field, 'like', `%${value}%`)
  }

  const orderField = sortWhitelist.includes(sortField) ? sortField : 'id'
  query = query.orderBy(orderField, sortOrder === 'desc' ? 'desc' : 'asc')

  return { page, pageSize, query }
}

// ============================ ROLES ============================
router.get('/get_roles', async function (req, res) {
  try {
    const { page, pageSize, query } = buildListQuery(
      global.knex('roles').select('*'), req,
      ['nombre', 'descripcion'], ['id', 'nombre', 'descripcion']
    )
    const total = parseInt((await query.clone().clearOrder().count('* as c'))[0].c)
    const rows = await query.offset((page - 1) * pageSize).limit(pageSize)
    ok(res, { rows, fields_def: FIELDS_DEF_ROLES, total, page, pageSize })
  } catch (e) { console.log('[rbac] get_roles:', e); err(res, 'Error al listar roles') }
})

router.post('/nuevo_rol', async function (req, res) {
  const { nombre, descripcion } = req.body || {}
  if (!nombre) return err(res, 'Nombre del rol requerido')
  try {
    const existente = await global.knex('roles').where({ nombre }).first()
    if (existente) return err(res, 'El rol ya existe')
    const [id] = await global.knex('roles').insert({ nombre, descripcion })
    ok(res, { id, nombre })
  } catch (e) { console.log('[rbac] nuevo_rol:', e); err(res, 'Error al crear rol') }
})

router.put('/editar_rol', async function (req, res) {
  const { id, nombre, descripcion } = req.body || {}
  if (!id) return err(res, 'ID requerido')
  try {
    const rol = await global.knex('roles').where({ id }).first()
    if (!rol) return err(res, 'Rol no encontrado')
    // El nombre determina quien es administrador y que rol reciben las altas por SSO
    if (nombre && nombre !== rol.nombre) {
      if (!es_admin(req)) return err(res, SOLO_ADMIN)
      if (rol.nombre === 'administrador') return err(res, 'El rol administrador no puede renombrarse')
    }
    const actualizar = {}
    if (nombre) actualizar.nombre = nombre
    if (descripcion !== undefined) actualizar.descripcion = descripcion
    if (Object.keys(actualizar).length > 0) await global.knex('roles').where({ id }).update(actualizar)
    ok(res, { message: 'Rol actualizado correctamente' })
  } catch (e) { console.log('[rbac] editar_rol:', e); err(res, 'Error al actualizar rol') }
})

router.delete('/eliminar_rol', async function (req, res) {
  const { id } = req.body || {}
  if (!id) return err(res, 'ID requerido')
  try {
    const rol = await global.knex('roles').where({ id }).first()
    if (!rol) return err(res, 'Rol no encontrado')
    if (rol.nombre === 'administrador') return err(res, 'El rol administrador no puede eliminarse')
    await global.knex('roles').where({ id }).del()
    ok(res, { message: 'Rol eliminado correctamente' })
  } catch (e) { console.log('[rbac] eliminar_rol:', e); err(res, 'Error al eliminar rol') }
})

router.post('/asignar_permiso_rol', solo_admin, async function (req, res) {
  const { id_rol, id_permiso } = req.body || {}
  if (!id_rol || !id_permiso) return err(res, 'Rol y permiso requeridos')
  try {
    const existe = await global.knex('roles_permisos').where({ rol_id: id_rol, permiso_id: id_permiso }).first()
    if (!existe) await global.knex('roles_permisos').insert({ rol_id: id_rol, permiso_id: id_permiso })
    ok(res, { message: 'Permiso vinculado al rol' })
  } catch (e) { console.log('[rbac] asignar_permiso_rol:', e); err(res, 'Error al vincular permiso') }
})

router.post('/asignar_usuario_rol', solo_admin, async function (req, res) {
  const { id_usuario, id_rol } = req.body || {}
  if (!id_usuario || !id_rol) return err(res, 'Usuario y rol requeridos')
  try {
    const existe = await global.knex('usuarios_roles').where({ usuario_id: id_usuario, rol_id: id_rol }).first()
    if (!existe) await global.knex('usuarios_roles').insert({ usuario_id: id_usuario, rol_id: id_rol })
    ok(res, { message: 'Rol asignado al usuario' })
  } catch (e) { console.log('[rbac] asignar_usuario_rol:', e); err(res, 'Error al asignar rol') }
})

// ============================ PERMISOS ============================
router.get('/get_permisos', async function (req, res) {
  try {
    const { page, pageSize, query } = buildListQuery(
      global.knex('permisos').select('*'), req,
      ['nombre', 'descripcion'], ['id', 'nombre', 'descripcion']
    )
    const total = parseInt((await query.clone().clearOrder().count('* as c'))[0].c)
    const rows = await query.offset((page - 1) * pageSize).limit(pageSize)
    ok(res, { rows, fields_def: FIELDS_DEF_PERMISOS, total, page, pageSize })
  } catch (e) { console.log('[rbac] get_permisos:', e); err(res, 'Error al listar permisos') }
})

router.post('/nuevo_permiso', async function (req, res) {
  const { nombre, descripcion } = req.body || {}
  if (!nombre) return err(res, 'Nombre del permiso requerido')
  try {
    const existente = await global.knex('permisos').where({ nombre }).first()
    if (existente) return err(res, 'El permiso ya existe')
    const [id] = await global.knex('permisos').insert({ nombre, descripcion })
    ok(res, { id, nombre })
  } catch (e) { console.log('[rbac] nuevo_permiso:', e); err(res, 'Error al crear permiso') }
})

router.put('/editar_permiso', async function (req, res) {
  const { id, nombre, descripcion } = req.body || {}
  if (!id) return err(res, 'ID requerido')
  try {
    const permiso = await global.knex('permisos').where({ id }).first()
    if (!permiso) return err(res, 'Permiso no encontrado')
    // Los permisos se comprueban por nombre: renombrar uno otorga otro a sus roles
    if (nombre && nombre !== permiso.nombre && !es_admin(req)) return err(res, SOLO_ADMIN)
    const actualizar = {}
    if (nombre) actualizar.nombre = nombre
    if (descripcion !== undefined) actualizar.descripcion = descripcion
    if (Object.keys(actualizar).length > 0) await global.knex('permisos').where({ id }).update(actualizar)
    ok(res, { message: 'Permiso actualizado correctamente' })
  } catch (e) { console.log('[rbac] editar_permiso:', e); err(res, 'Error al actualizar permiso') }
})

router.delete('/eliminar_permiso', async function (req, res) {
  const { id } = req.body || {}
  if (!id) return err(res, 'ID requerido')
  try {
    const permiso = await global.knex('permisos').where({ id }).first()
    if (!permiso) return err(res, 'Permiso no encontrado')
    await global.knex('permisos').where({ id }).del()
    ok(res, { message: 'Permiso eliminado correctamente' })
  } catch (e) { console.log('[rbac] eliminar_permiso:', e); err(res, 'Error al eliminar permiso') }
})

// ============================ RUTAS ============================
router.get('/get_rutas', async function (req, res) {
  try {
    const { page, pageSize, query } = buildListQuery(
      global.knex('rutas').select('*'), req,
      ['path', 'title', 'componente', 'icon'], ['id', 'id_ruta_root', 'path', 'componente', 'icon', 'title', 'orden_visualizacion']
    )
    const total = parseInt((await query.clone().clearOrder().count('* as c'))[0].c)
    const rows = await query.offset((page - 1) * pageSize).limit(pageSize)
    ok(res, { rows, fields_def: FIELDS_DEF_RUTAS, total, page, pageSize })
  } catch (e) { console.log('[rbac] get_rutas:', e); err(res, 'Error al listar rutas') }
})

router.post('/nueva_ruta', async function (req, res) {
  const { path, componente, icon, title, id_ruta_root, orden_visualizacion } = req.body || {}
  if (!path) return err(res, 'Path de la ruta requerido')
  try {
    const existente = await global.knex('rutas').where({ path }).first()
    if (existente) return err(res, 'La ruta ya existe')
    const [id] = await global.knex('rutas').insert({
      path,
      componente: componente || null,
      icon: icon || null,
      title: title || null,
      id_ruta_root: id_ruta_root || null,
      orden_visualizacion: orden_visualizacion || 0,
    })
    ok(res, { id, path })
  } catch (e) { console.log('[rbac] nueva_ruta:', e); err(res, 'Error al crear ruta') }
})

router.put('/editar_ruta', async function (req, res) {
  const { id, path, componente, icon, title, id_ruta_root, orden_visualizacion } = req.body || {}
  if (!id) return err(res, 'ID requerido')
  try {
    const ruta = await global.knex('rutas').where({ id }).first()
    if (!ruta) return err(res, 'Ruta no encontrada')
    const actualizar = {}
    if (path) actualizar.path = path
    if (componente !== undefined) actualizar.componente = componente
    if (icon !== undefined) actualizar.icon = icon
    if (title !== undefined) actualizar.title = title
    if (id_ruta_root !== undefined) actualizar.id_ruta_root = id_ruta_root
    if (orden_visualizacion !== undefined) actualizar.orden_visualizacion = orden_visualizacion
    if (Object.keys(actualizar).length > 0) await global.knex('rutas').where({ id }).update(actualizar)
    ok(res, { message: 'Ruta actualizada correctamente' })
  } catch (e) { console.log('[rbac] editar_ruta:', e); err(res, 'Error al actualizar ruta') }
})

router.delete('/eliminar_ruta', async function (req, res) {
  const { id } = req.body || {}
  if (!id) return err(res, 'ID requerido')
  try {
    const ruta = await global.knex('rutas').where({ id }).first()
    if (!ruta) return err(res, 'Ruta no encontrada')
    await global.knex('rutas').where({ id }).del()
    ok(res, { message: 'Ruta eliminada correctamente' })
  } catch (e) { console.log('[rbac] eliminar_ruta:', e); err(res, 'Error al eliminar ruta') }
})
