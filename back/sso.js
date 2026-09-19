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

// Email del admin único del sistema
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'lucho.2012.tandil@gmail.com').toLowerCase()

async function obtener_o_crear_rol(knex) {
  const existente = await knex('roles').where({ nombre: ROL_DEFAULT_SSO }).first()
  if (existente) return existente

  const [id] = await knex('roles').insert({
    nombre: ROL_DEFAULT_SSO,
    descripcion: 'Usuarios creados automáticamente vía SSO (sin acceso al panel hasta asignar roles/rutas)',
  })
  return { id, nombre: ROL_DEFAULT_SSO }
}

// Asegura que el usuario indicado tenga el rol administrador si su email es el
// admin único del sistema (se invoca en cada login SSO y en el seed RBAC).
async function asegurar_rol_admin(usuario) {
  const knex = global.knex
  if (!knex || !usuario?.id) return false

  const email = String(usuario.email || '').toLowerCase()
  if (email !== ADMIN_EMAIL) return false

  const rol = await knex('roles').where({ nombre: 'administrador' }).first()
  if (!rol) return false

  const existe = await knex('usuarios_roles').where({ usuario_id: usuario.id, rol_id: rol.id }).first()
  if (!existe) {
    await knex('usuarios_roles').insert({ usuario_id: usuario.id, rol_id: rol.id })
    console.log(`[sso] Rol administrador asignado a ${ADMIN_EMAIL} (admin único).`)
  }
  return true
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
  if (existente) {
    // El admin único conserva su rol aunque la cuenta sea previa al seed
    await asegurar_rol_admin(existente)
    return existente
  }

  // Nombre y apellido: primero los campos separados del perfil; si no vienen
  // se divide el nombre completo (primera palabra = nombre, resto = apellido)
  let name = ssoUser.given_name || null
  let apellido = ssoUser.family_name || null
  if (!name) {
    const partes = String(ssoUser.name || String(email).split('@')[0]).trim().split(/\s+/)
    name = partes[0]
    apellido = apellido || (partes.length > 1 ? partes.slice(1).join(' ') : null)
  }
  const pass = await bcrypt.hash(randomBytes(32).toString('hex'), 10)

  const [id] = await knex('usuarios').insert({ name, apellido, email, pass })

  const rol = await obtener_o_crear_rol(knex)
  if (rol) await knex('usuarios_roles').insert({ usuario_id: id, rol_id: rol.id })

  await asegurar_rol_admin({ id, email })

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
module.exports.asegurar_rol_admin = asegurar_rol_admin
