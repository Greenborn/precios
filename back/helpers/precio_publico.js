// Saneo de precios para las respuestas publicas: nunca sale user_id y el nombre de quien cargo
// el precio solo sale en locales comunes. Se devuelven copias: las filas de las caches en memoria
// conservan todos sus datos para el area privada y la administracion.
const precios_negocio = require('../controllers/precios_negocio')

// Solo si consta que el local es comun. Ante cualquier señal de negocio, o si la sucursal no
// esta en el diccionario (sin cargar o regenerandose), el autor se oculta.
function admite_autor(precio) {
  const local = global.branchs_diccio?.[Number(precio.branch_id)]
  return !!local
    && local.propietario_id == null
    && !local.sin_local
    && !precio.negocio
    && !precios_negocio.es_negocio(precio.branch_id)
}

// con_autor: false quita el autor tambien en locales comunes
function precio_publico(precio, { con_autor = true } = {}) {
  const { user_id, user_nombre, user_apellido, ...salida } = precio
  if (con_autor && admite_autor(precio)) {
    if (user_nombre !== undefined) salida.user_nombre = user_nombre
    if (user_apellido !== undefined) salida.user_apellido = user_apellido
  }
  return salida
}

function precios_publicos(filas, opciones) {
  return filas?.map(f => precio_publico(f, opciones))
}

module.exports = { precio_publico, precios_publicos }
