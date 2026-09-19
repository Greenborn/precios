// Seed idempotente de RBAC: crea roles (administrador y usuario), permisos,
// rutas del panel y asegura el admin único del sistema. El rol administrador
// se remueve de cualquier otro usuario que lo tuviera asignado.
// Ejecutado automaticamente en server.js tras las migraciones.
const bcrypt = require('bcrypt')

// Email del admin único (el rol se le asigna al crear su cuenta vía SSO,
// ver sso.js::asegurar_rol_admin, o en la primera ejecución de este seed
// si la cuenta ya existe).
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'lucho.2012.tandil@gmail.com').toLowerCase()

// Permisos base del sistema (prefijos por modulo)
const PERMISOS = [
  { nombre: 'usuarios.ver',        descripcion: 'Ver listado de usuarios' },
  { nombre: 'usuarios.crear',      descripcion: 'Crear usuarios' },
  { nombre: 'usuarios.editar',     descripcion: 'Editar usuarios' },
  { nombre: 'usuarios.eliminar',   descripcion: 'Eliminar usuarios' },
  { nombre: 'roles.ver',           descripcion: 'Ver listado de roles' },
  { nombre: 'roles.crear',         descripcion: 'Crear roles' },
  { nombre: 'roles.editar',        descripcion: 'Editar roles' },
  { nombre: 'roles.eliminar',      descripcion: 'Eliminar roles' },
  { nombre: 'permisos.ver',        descripcion: 'Ver listado de permisos' },
  { nombre: 'permisos.crear',      descripcion: 'Crear permisos' },
  { nombre: 'permisos.editar',     descripcion: 'Editar permisos' },
  { nombre: 'permisos.eliminar',   descripcion: 'Eliminar permisos' },
  { nombre: 'rutas.ver',           descripcion: 'Ver listado de rutas' },
  { nombre: 'rutas.crear',         descripcion: 'Crear rutas' },
  { nombre: 'rutas.editar',        descripcion: 'Editar rutas' },
  { nombre: 'rutas.eliminar',      descripcion: 'Eliminar rutas' },
  { nombre: 'perfil.ver',          descripcion: 'Ver propio perfil' },
  { nombre: 'perfil.editar',       descripcion: 'Editar propio perfil' },
  { nombre: 'productos.editar',    descripcion: 'Administrar productos y alias de nombres' },
  { nombre: 'precios.ver',         descripcion: 'Ver precios cargados por usuarios' },
  { nombre: 'precios.eliminar',    descripcion: 'Eliminar precios cargados por usuarios' },
]

// Rutas del panel de administracion. El campo "componente" debe coincidir con las
// claves de front/src/components/referencias_importables.js
const RUTAS = [
  { path: 'dashboard', componente: 'Dasboard',      icon: 'pi-home',           title: 'Dashboard', orden_visualizacion: 1 },
  { path: 'cuenta',    componente: 'ConfigCuenta',  icon: 'pi-user',           title: 'Mi cuenta',  orden_visualizacion: 2 },
  // Grupo "Acceso" (raiz) con sub-rutas
  { path: 'acceso',    componente: '',              icon: 'pi-shield',         title: 'Acceso',     orden_visualizacion: 3 },
  { path: 'usuarios',  componente: 'AbmAdmins',     icon: 'pi-users',          title: 'Usuarios',   orden_visualizacion: 1, root: 'acceso' },
  { path: 'roles',     componente: 'AbmRoles',      icon: 'pi-id-card',        title: 'Roles',      orden_visualizacion: 2, root: 'acceso' },
  { path: 'permisos',  componente: 'AbmPermisos',   icon: 'pi-lock',           title: 'Permisos',   orden_visualizacion: 3, root: 'acceso' },
  { path: 'rutas',     componente: 'AbmRutas',      icon: 'pi-sitemap',        title: 'Rutas',      orden_visualizacion: 4, root: 'acceso' },
  { path: 'precios_comunitarios', componente: 'AbmPreciosComunitarios', icon: 'pi-tags', title: 'Precios Comunitarios', orden_visualizacion: 5, root: 'acceso' },
]

async function seed_rbac() {
  const knex = global.knex
  if (!knex) {
    console.error('[seed_rbac] No hay conexion de base de datos disponible')
    return
  }

  // --- Rol administrador ---
  let rol_admin = await knex('roles').where({ nombre: 'administrador' }).first()
  if (!rol_admin) {
    const [rolId] = await knex('roles').insert({ nombre: 'administrador', descripcion: 'Acceso total al sistema' })
    rol_admin = { id: rolId }
    console.log('[seed_rbac] Rol administrador creado.')
  }

  // --- Rol usuario (pueden publicar precios; se asigna por defecto vía SSO) ---
  let rol_usuario = await knex('roles').where({ nombre: 'usuario' }).first()
  if (!rol_usuario) {
    await knex('roles').insert({
      nombre: 'usuario',
      descripcion: 'Usuarios registrados: pueden publicar precios mediante el formulario de carga'
    })
    console.log('[seed_rbac] Rol usuario creado.')
  }

  // --- Permisos ---
  for (const p of PERMISOS) {
    let permiso = await knex('permisos').where({ nombre: p.nombre }).first()
    if (!permiso) {
      const [pid] = await knex('permisos').insert(p)
      permiso = { id: pid }
    }
    // asignar todos los permisos al rol administrador
    const existe = await knex('roles_permisos').where({ rol_id: rol_admin.id, permiso_id: permiso.id }).first()
    if (!existe) {
      await knex('roles_permisos').insert({ rol_id: rol_admin.id, permiso_id: permiso.id })
    }
  }
  console.log('[seed_rbac] Permisos inicializados.')

  // --- Rutas ---
  // Insertar raices primero y luego las hijas referenciando el id de la raiz
  const rutas_insertadas = {}
  for (const r of RUTAS) {
    if (!r.root) {
      let existente = await knex('rutas').where({ path: r.path }).first()
      if (!existente) {
        const [rid] = await knex('rutas').insert({
          path: r.path,
          componente: r.componente || null,
          icon: r.icon,
          title: r.title,
          orden_visualizacion: r.orden_visualizacion,
          id_ruta_root: null,
        })
        existente = { id: rid }
      }
      rutas_insertadas[r.path] = existente
    }
  }
  for (const r of RUTAS) {
    if (r.root) {
      const root = rutas_insertadas[r.root]
      if (!root) continue
      let existente = await knex('rutas').where({ path: r.path }).first()
      if (!existente) {
        const [rid] = await knex('rutas').insert({
          path: r.path,
          componente: r.componente || null,
          icon: r.icon,
          title: r.title,
          orden_visualizacion: r.orden_visualizacion,
          id_ruta_root: root.id,
        })
        existente = { id: rid }
      }
      rutas_insertadas[r.root + '/' + r.path] = existente
    }
  }

  // asignar todas las rutas al rol administrador
  const todas_rutas = await knex('rutas').select('id')
  for (const r of todas_rutas) {
    const existe = await knex('roles_rutas').where({ rol_id: rol_admin.id, ruta_id: r.id }).first()
    if (!existe) {
      await knex('roles_rutas').insert({ rol_id: rol_admin.id, ruta_id: r.id })
    }
  }
  console.log('[seed_rbac] Rutas del panel inicializadas.')

  // --- Admin único ---
  // Quitar el rol administrador a cualquier usuario que no sea el admin único
  const otros_admins = await knex('usuarios_roles as ur')
    .join('usuarios as u', 'ur.usuario_id', 'u.id')
    .where('ur.rol_id', rol_admin.id)
    .whereRaw('LOWER(u.email) != ?', [ADMIN_EMAIL])
    .select('ur.usuario_id', 'u.email')
  for (const otro of otros_admins) {
    await knex('usuarios_roles')
      .where({ usuario_id: otro.usuario_id, rol_id: rol_admin.id })
      .del()
    console.log(`[seed_rbac] Rol administrador removido de ${otro.email} (admin único: ${ADMIN_EMAIL}).`)
  }

  // Si la cuenta del admin único ya existe (p.ej. se registró vía SSO), asignarle el rol
  const admin = await knex('usuarios')
    .whereRaw('LOWER(email) = ?', [ADMIN_EMAIL])
    .first()
  if (admin) {
    const rel = await knex('usuarios_roles').where({ usuario_id: admin.id, rol_id: rol_admin.id }).first()
    if (!rel) {
      await knex('usuarios_roles').insert({ usuario_id: admin.id, rol_id: rol_admin.id })
      console.log(`[seed_rbac] Rol administrador asignado a ${ADMIN_EMAIL}.`)
    }
  } else {
    console.log(`[seed_rbac] La cuenta del admin (${ADMIN_EMAIL}) aún no existe; se le asignará el rol en su primer login SSO.`)
  }

  console.log('[seed_rbac] ✓ Seed RBAC completado.')
}

module.exports = { seed_rbac }
