// Clave compartida de los endpoints para procesos externos (KEY_INT). Se rechaza si la
// variable no está configurada o si la petición no trae clave.
function clave_valida(recibida, esperada = process.env.KEY_INT) {
  if (!esperada) return false
  if (typeof recibida !== 'string' && typeof recibida !== 'number') return false
  return String(recibida) === esperada
}

module.exports = { clave_valida }
