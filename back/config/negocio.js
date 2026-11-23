// Configuración del área privada del negocio (locales, perfil y fotos de artículos).
const path = require('path')

// Perfil del negocio. `publicable` define qué campos pueden salir en el perfil público
// (cada uno con su interruptor mostrar_<campo>, apagado por defecto).
const CAMPOS_PERFIL = [
  { nombre: 'nombre_comercial', publicable: true, etiqueta: 'Nombre comercial' },
  { nombre: 'sitio_web', publicable: true, etiqueta: 'Sitio web' },
  { nombre: 'descripcion', tipo: 'texto_largo', publicable: true, etiqueta: 'Descripción' },
]

// Campo extra de los locales: se mapea a branch.branch_name (ver helpers/locales_branch.js).
const CAMPOS_LOCALES_EXTRA = [{ nombre: 'nombre', publicable: true }]

const TERMINOS_LOCAL = { singular: 'local', plural: 'locales' }
const TERMINOS_NEGOCIO = { singular: 'negocio', plural: 'negocios' }

// Fotos de artículos
const FOTO_MAX_BYTES = 2 * 1024 * 1024
const FOTO_TIPOS = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads')
const FOTOS_DIR = path.join(UPLOADS_DIR, 'articulos')
const FOTOS_URL = '/uploads/articulos'

// Portada y foto de perfil del negocio
const PERFIL_IMG_MAX_BYTES = 3 * 1024 * 1024
const PERFIL_IMG_DIR = path.join(UPLOADS_DIR, 'perfiles')
const PERFIL_IMG_URL = '/uploads/perfiles'

module.exports = {
  CAMPOS_PERFIL,
  CAMPOS_LOCALES_EXTRA,
  TERMINOS_LOCAL,
  TERMINOS_NEGOCIO,
  FOTO_MAX_BYTES,
  FOTO_TIPOS,
  UPLOADS_DIR,
  FOTOS_DIR,
  FOTOS_URL,
  PERFIL_IMG_MAX_BYTES,
  PERFIL_IMG_DIR,
  PERFIL_IMG_URL,
}
