// Helpers de autenticación JWT para el servicio RBAC.
const jwt = require('jsonwebtoken')

const SECRET = process.env.JWT_SECRET || 'clave_secreta_jwt_cambiar_en_produccion'
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'

function firmar_token(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN })
}

function verificar_token(token) {
  return jwt.verify(token, SECRET)
}

// Extrae el token del header 'x-api-key' (como lo envia el front) o del header Authorization Bearer.
function obtener_token(request) {
  const xApiKey = request.get('x-api-key')
  if (xApiKey) return xApiKey
  const auth = request.get('authorization')
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7)
  return null
}

// Carga el usuario junto a sus roles, permisos y rutas asignadas.
async function cargar_usuario(usuario_id) {
  const knex = global.knex
  const usuario = await knex('usuarios').where({ id: usuario_id }).first()
  if (!usuario) return null

  const roles = await knex('usuarios_roles')
    .join('roles', 'usuarios_roles.rol_id', 'roles.id')
    .where('usuarios_roles.usuario_id', usuario_id)
    .select('roles.id', 'roles.nombre')

  const rolIds = roles.map(r => r.id)
  let permisos = []
  if (rolIds.length > 0) {
    permisos = await knex('roles_permisos')
      .join('permisos', 'roles_permisos.permiso_id', 'permisos.id')
      .whereIn('roles_permisos.rol_id', rolIds)
      .select('permisos.nombre')
      .distinct()
  }

  let rutas = []
  if (rolIds.length > 0) {
    rutas = await knex('roles_rutas')
      .join('rutas', 'roles_rutas.ruta_id', 'rutas.id')
      .whereIn('roles_rutas.rol_id', rolIds)
      .select('rutas.id', 'rutas.id_ruta_root', 'rutas.path', 'rutas.componente', 'rutas.icon', 'rutas.title', 'rutas.orden_visualizacion')
      .distinct()
  }

  return {
    id: usuario.id,
    name: usuario.name,
    apellido: usuario.apellido || null,
    email: usuario.email,
    roles: roles.map(r => r.nombre),
    permisos: permisos.map(p => p.nombre),
    rutas,
  }
}

module.exports = { firmar_token, verificar_token, obtener_token, cargar_usuario }
