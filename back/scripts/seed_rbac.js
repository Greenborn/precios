// Seed idempotente de RBAC: crea rol administrador, permisos, rutas del panel y
// un usuario admin por defecto. Ejecutado automaticamente en server.js tras las migraciones.
const bcrypt = require('bcrypt')

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
]

const USUARIO_DEFAULT = {
  name: 'Administrador',
  email: process.env.ADMIN_EMAIL || 'admin@admin.com',
  pass: process.env.ADMIN_PASS || 'admin123',
}

async function seed_rbac() {
  const knex = global.knex
  if (!knex) {
    console.error('[seed_rbac] No hay conexion de base de datos disponible')
    return
  }

  // --- Rol administrador ---
  let rol = await knex('roles').where({ nombre: 'administrador' }).first()
  if (!rol) {
    const [rolId] = await knex('roles').insert({ nombre: 'administrador', descripcion: 'Acceso total al sistema' })
    rol = { id: rolId }
    console.log('[seed_rbac] Rol administrador creado.')
  }

  // --- Permisos ---
  for (const p of PERMISOS) {
    let permiso = await knex('permisos').where({ nombre: p.nombre }).first()
    if (!permiso) {
      const [pid] = await knex('permisos').insert(p)
      permiso = { id: pid }
    }
    // asignar todos los permisos al rol administrador
    const existe = await knex('roles_permisos').where({ rol_id: rol.id, permiso_id: permiso.id }).first()
    if (!existe) {
      await knex('roles_permisos').insert({ rol_id: rol.id, permiso_id: permiso.id })
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
    const existe = await knex('roles_rutas').where({ rol_id: rol.id, ruta_id: r.id }).first()
    if (!existe) {
      await knex('roles_rutas').insert({ rol_id: rol.id, ruta_id: r.id })
    }
  }
  console.log('[seed_rbac] Rutas del panel inicializadas.')

  // --- Usuario admin por defecto ---
  let admin = await knex('usuarios').where({ email: USUARIO_DEFAULT.email }).first()
  if (!admin) {
    const hash = await bcrypt.hash(USUARIO_DEFAULT.pass, 10)
    const [uid] = await knex('usuarios').insert({
      name: USUARIO_DEFAULT.name,
      email: USUARIO_DEFAULT.email,
      pass: hash,
    })
    admin = { id: uid }
    console.log(`[seed_rbac] Usuario admin creado (${USUARIO_DEFAULT.email}).`)
  }

  const rel = await knex('usuarios_roles').where({ usuario_id: admin.id, rol_id: rol.id }).first()
  if (!rel) {
    await knex('usuarios_roles').insert({ usuario_id: admin.id, rol_id: rol.id })
    console.log('[seed_rbac] Rol administrador asignado al usuario admin.')
  }

  console.log('[seed_rbac] ✓ Seed RBAC completado.')
}

module.exports = { seed_rbac }
