// Campos de `branch` que pueden salir en endpoints publicos (lista blanca). Quedan fuera
// propietario_id, codigo, publicado, sin_local y cualquier columna que se agregue despues.
const CAMPOS = ['id', 'enterprise_id', 'name', 'branch_name', 'address', 'address_road', 'address_number',
  'city', 'latitude', 'longitude']

function branch_publico(fila) {
  return Object.fromEntries(CAMPOS.filter((c) => fila[c] !== undefined).map((c) => [c, fila[c]]))
}

// Devuelve copias: los diccionarios en memoria conservan las filas completas
function branches_publicos(filas) {
  return filas?.map(branch_publico)
}

module.exports = { branch_publico, branches_publicos }
