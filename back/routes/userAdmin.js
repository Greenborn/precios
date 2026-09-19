const express = require('express')
var router = express.Router()
module.exports = router
const bcrypt = require('bcrypt')
const axios = require('axios')
const { firmar_token, cargar_usuario } = require('../helpers/auth')
const sso = require('../sso')

const FIELDS_DEF_USUARIOS = [
  { field: 'id',       headerName: 'ID',      sortable: true },
  { field: 'name',     headerName: 'Nombre',  sortable: true },
  { field: 'apellido', headerName: 'Apellido', sortable: true },
  { field: 'email',    headerName: 'Email',   sortable: true },
]

function responder_ok(res, data) {
  return res.status(200).send({ stat: true, data })
}

function responder_err(res, text, code = null) {
  const body = { stat: false, text }
  if (code) body.code = code
  return res.status(200).send(body)
}

// GET /info - informacion de la sesion (usuario + rutas para el menu)
router.get('/info', async function (req, res) {
  const usuario = req.session && req.session.u_data ? req.session.u_data : null
  if (!usuario) return responder_err(res, 'No hay sesion activa', 'DO_LOGIN')

  responder_ok(res, {
    id: usuario.id,
    name: usuario.name,
    apellido: usuario.apellido || null,
    email: usuario.email,
    rutas: usuario.rutas || [],
  })
})

// POST /login - autenticacion (publica)
router.post('/login', async function (req, res) {
  const { email, password } = req.body || {}
  if (!email || !password) return responder_err(res, 'Email y contraseña son requeridos')

  try {
    const usuario = await global.knex('usuarios').where({ email }).first()
    if (!usuario) return responder_err(res, 'Credenciales inválidas')

    const valida = await bcrypt.compare(password, usuario.pass)
    if (!valida) return responder_err(res, 'Credenciales inválidas')

    const u_data = await cargar_usuario(usuario.id)
    const token = firmar_token({ id: usuario.id, email: usuario.email })

    responder_ok(res, {
      token,
      u_data: {
        id: u_data.id,
        name: u_data.name,
        apellido: u_data.apellido || null,
        email: u_data.email,
        rutas: u_data.rutas,
      },
    })
  } catch (error) {
    console.log('[userAdmin] Error en login:', error)
    responder_err(res, 'Error interno al iniciar sesión')
  }
})

// POST /sso_login - inicio de sesión vía SSO Greenborn (Google) (pública)
// Recibe el bearer token del SSO + unique_id, lo verifica contra el SSO,
// busca/crea el usuario local y emite el JWT local (misma respuesta que /login).
router.post('/sso_login', async function (req, res) {
  const { token, unique_id } = req.body || {}
  if (!token || !unique_id) return responder_err(res, 'Token y unique_id son requeridos')

  try {
    const response = await sso.verifySsoToken(token, unique_id)
    if (!response?.data?.success || !response?.data?.data?.valid) {
      return responder_err(res, 'Token SSO inválido o expirado', 'DO_LOGIN')
    }

    const sso_user = response.data.data.user
    if (!sso_user?.email) return responder_err(res, 'El SSO no devolvió email de usuario', 'DO_LOGIN')

    const usuario = await sso.syncSsoUser(sso_user)
    if (!usuario) return responder_err(res, 'No se pudo obtener/crear el usuario', 'DO_LOGIN')

    // Asigna el rol administrador si corresponde al admin único del sistema
    await sso.asegurar_rol_admin(usuario)

    const u_data = await cargar_usuario(usuario.id)
    if (!u_data) return responder_err(res, 'Usuario no encontrado', 'DO_LOGIN')

    const token_local = firmar_token({ id: usuario.id, email: usuario.email })

    responder_ok(res, {
      token: token_local,
      u_data: {
        id: u_data.id,
        name: u_data.name,
        apellido: u_data.apellido || null,
        email: u_data.email,
        rutas: u_data.rutas,
      },
    })
  } catch (error) {
    console.log('[userAdmin] Error en sso_login:', error?.response?.data || error)
    responder_err(res, 'Error al validar la sesión SSO')
  }
})

// POST /logout
router.post('/logout', async function (req, res) {
  // Si la sesión inició por SSO se revoca también en el SSO central (best-effort)
  const { sso_token, unique_id } = req.body || {}
  if (sso_token && unique_id) {
    try {
      await axios.post(`${sso.ssoBaseUrl}/auth/logout`, null, {
        params: { unique_id },
        headers: { Authorization: `Bearer ${sso_token}` },
        timeout: 5000,
      })
    } catch (error) {
      console.log('[userAdmin] Logout SSO (best-effort) falló:', error?.response?.status || error.message)
    }
  }
  responder_ok(res, { message: 'Sesión cerrada' })
})

// PUT /guardar_config - editar datos de la propia cuenta
router.put('/guardar_config', async function (req, res) {
  const usuario = req.session && req.session.u_data ? req.session.u_data : null
  if (!usuario) return responder_err(res, 'No hay sesion activa', 'DO_LOGIN')

  const { id, name, apellido, email, pass } = req.body || {}

  if (id && Number(id) !== usuario.id) return responder_err(res, 'No autorizado')

  const actualizar = {}
  if (name) actualizar.name = name
  if (apellido !== undefined) actualizar.apellido = apellido
  if (email) actualizar.email = email
  if (pass && pass !== '********') {
    actualizar.pass = await bcrypt.hash(pass, 10)
  }

  if (Object.keys(actualizar).length === 0) return responder_err(res, 'No hay datos para actualizar')

  if (email) {
    const existente = await global.knex('usuarios').where({ email }).whereNot({ id: usuario.id }).first()
    if (existente) return responder_err(res, 'El email ya está en uso')
  }

  try {
    await global.knex('usuarios').where({ id: usuario.id }).update(actualizar)
    responder_ok(res, { message: 'Cuenta actualizada correctamente' })
  } catch (error) {
    console.log('[userAdmin] Error en guardar_config:', error)
    responder_err(res, 'Error al actualizar la cuenta')
  }
})

// GET /get_all - listado paginado de usuarios (contrato TableEditor)
router.get('/get_all', async function (req, res) {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 25
  const search = req.query.search || ''
  const sortField = req.query.sortField || 'id'
  const sortOrder = req.query.sortOrder || 'asc'

  const query = global.knex('usuarios').select('*')
  const countQuery = global.knex('usuarios')

  if (search) {
    query.where(function () {
      this.where('name', 'like', `%${search}%`)
        .orWhere('apellido', 'like', `%${search}%`)
        .orWhere('email', 'like', `%${search}%`)
    })
    countQuery.where(function () {
      this.where('name', 'like', `%${search}%`)
        .orWhere('apellido', 'like', `%${search}%`)
        .orWhere('email', 'like', `%${search}%`)
    })
  }

  // Filtros por columna: { campo: "valor" } (JSON string desde la libreria)
  let filters = {}
  try { filters = req.query.filters ? JSON.parse(req.query.filters) : {} } catch (e) { filters = {} }
  for (const [field, value] of Object.entries(filters)) {
    if (value && ['id', 'name', 'apellido', 'email'].includes(field)) {
      query.where(field, 'like', `%${value}%`)
      countQuery.where(field, 'like', `%${value}%`)
    }
  }

  const orderField = ['id', 'name', 'apellido', 'email'].includes(sortField) ? sortField : 'id'
  const total = parseInt((await countQuery.count('* as c'))[0].c)
  const offset = (page - 1) * pageSize
  const rows = await query.orderBy(orderField, sortOrder === 'desc' ? 'desc' : 'asc').offset(offset).limit(pageSize)

  for (const u of rows) {
    u.roles = await global.knex('usuarios_roles')
      .join('roles', 'usuarios_roles.rol_id', 'roles.id')
      .where('usuarios_roles.usuario_id', u.id)
      .select('roles.id', 'roles.nombre')
  }

  responder_ok(res, { rows, fields_def: FIELDS_DEF_USUARIOS, total, page, pageSize })
})

// POST /add_one - crear usuario
router.post('/add_one', async function (req, res) {
  const { name, apellido, email, pass, roles } = req.body || {}
  if (!name || !email || !pass) return responder_err(res, 'Nombre, email y contraseña son requeridos')

  try {
    const existente = await global.knex('usuarios').where({ email }).first()
    if (existente) return responder_err(res, 'El email ya está en uso')

    const hash = await bcrypt.hash(pass, 10)
    const [id] = await global.knex('usuarios').insert({ name, apellido: apellido || null, email, pass: hash })

    if (roles && roles.length > 0) {
      const inserts = roles.map((rolId) => ({ usuario_id: id, rol_id: rolId }))
      await global.knex('usuarios_roles').insert(inserts)
    }

    responder_ok(res, { id, name, email })
  } catch (error) {
    console.log('[userAdmin] Error en add_one:', error)
    responder_err(res, 'Error al crear el usuario')
  }
})

// PUT /put_one - actualizar usuario
router.put('/put_one', async function (req, res) {
  const { id, name, apellido, email, pass, roles } = req.body || {}
  if (!id) return responder_err(res, 'ID requerido')

  try {
    const usuario = await global.knex('usuarios').where({ id }).first()
    if (!usuario) return responder_err(res, 'Usuario no encontrado')

    if (email && email !== usuario.email) {
      const existente = await global.knex('usuarios').where({ email }).whereNot({ id }).first()
      if (existente) return responder_err(res, 'El email ya está en uso')
    }

    const actualizar = {}
    if (name) actualizar.name = name
    if (apellido !== undefined) actualizar.apellido = apellido
    if (email) actualizar.email = email
    if (pass && pass !== '********') actualizar.pass = await bcrypt.hash(pass, 10)

    if (Object.keys(actualizar).length > 0) {
      await global.knex('usuarios').where({ id }).update(actualizar)
    }

    if (roles !== undefined && Array.isArray(roles)) {
      await global.knex('usuarios_roles').where({ usuario_id: id }).del()
      if (roles.length > 0) {
        const inserts = roles.map((rolId) => ({ usuario_id: id, rol_id: rolId }))
        await global.knex('usuarios_roles').insert(inserts)
      }
    }

    responder_ok(res, { message: 'Usuario actualizado correctamente' })
  } catch (error) {
    console.log('[userAdmin] Error en put_one:', error)
    responder_err(res, 'Error al actualizar el usuario')
  }
})

// DELETE /delete_one - eliminar usuario
router.delete('/delete_one', async function (req, res) {
  const { id } = req.body || {}
  if (!id) return responder_err(res, 'ID requerido')

  const usuario = req.session && req.session.u_data ? req.session.u_data : null
  if (usuario && Number(id) === usuario.id) return responder_err(res, 'No puedes eliminar tu propio usuario')

  try {
    const existente = await global.knex('usuarios').where({ id }).first()
    if (!existente) return responder_err(res, 'Usuario no encontrado')

    await global.knex('usuarios').where({ id }).del()
    responder_ok(res, { message: 'Usuario eliminado correctamente' })
  } catch (error) {
    console.log('[userAdmin] Error en delete_one:', error)
    responder_err(res, 'Error al eliminar el usuario')
  }
})
