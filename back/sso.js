// Integración con el servicio SSO de Greenborn (inicio de sesión con Google).
// La aplicación queda registrada en el SSO central con app_id "precios".
// Flujo: el frontend redirige a {SSO}/auth/google, recibe un token temporal,
// lo canjea por un bearer token y el backend lo verifica contra {SSO}/auth/verify
// para luego emitir el JWT local (firmar_token) que consume el middleware RBAC.
const { createSsoAuth } = require('express-greenborn-sso-back')
const bcrypt = require('bcrypt')
const { randomBytes } = require('crypto')

const ssoBaseUrl = process.env.URL_AUTH_SERVICE || 'https://auth.greenborn.com.ar'

// Rol que se asigna a los usuarios creados automáticamente vía SSO
const ROL_DEFAULT_SSO = process.env.SSO_DEFAULT_ROL || 'usuario'

async function obtener_o_crear_rol(knex) {
  const existente = await knex('roles').where({ nombre: ROL_DEFAULT_SSO }).first()
  if (existente) return existente

  const [id] = await knex('roles').insert({
    nombre: ROL_DEFAULT_SSO,
    descripcion: 'Usuarios creados automáticamente vía SSO (sin acceso al panel hasta asignar roles/rutas)',
  })
  return { id, nombre: ROL_DEFAULT_SSO }
}

// Busca el usuario local por el email verificado del SSO; si no existe lo crea
// (auto-registro) con una contraseña inutilizable y el rol por defecto.
async function createUserFromSso(ssoUser, ctx) {
  const email = ssoUser?.email
  if (!email || !ctx?.knex) return null

  const knex = ctx.knex
  const existente = await knex('usuarios')
    .whereRaw('LOWER(email) = ?', [String(email).toLowerCase()])
    .first()
  if (existente) return existente

  const name = ssoUser.name || String(email).split('@')[0]
  const pass = await bcrypt.hash(randomBytes(32).toString('hex'), 10)

  const [id] = await knex('usuarios').insert({ name, email, pass })

  const rol = await obtener_o_crear_rol(knex)
  if (rol) await knex('usuarios_roles').insert({ usuario_id: id, rol_id: rol.id })

  return knex('usuarios').where({ id }).first()
}

const sso = createSsoAuth({
  knex: global.knex,
  ssoBaseUrl,
  // Tablas RBAC: usuarios_roles/roles_permisos/roles/permisos coinciden con los
  // defaults de la librería; solo cambia la tabla de usuarios.
  tables: { user: 'usuarios' },
  rbac: true,
  createUserFromSso,
  logger: { error: console.error, warn: console.warn, log: console.log },
})

module.exports = sso
module.exports.ssoBaseUrl = ssoBaseUrl
