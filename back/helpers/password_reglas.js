// Reglas mínimas para contraseñas (mismas que usa el front en el modal de cambio de contraseña).
// Devuelve null si es válida o el mensaje de la primera regla incumplida.
const LONGITUD_MIN = 8
const LONGITUD_MAX = 128

function validar_password(pass, { email, name } = {}) {
  if (typeof pass !== 'string') return 'La contraseña es requerida'
  if (pass.length < LONGITUD_MIN) return `La contraseña debe tener al menos ${LONGITUD_MIN} caracteres`
  if (pass.length > LONGITUD_MAX) return `La contraseña no puede superar ${LONGITUD_MAX} caracteres`
  if (!/[A-Za-z]/.test(pass)) return 'La contraseña debe incluir al menos una letra'
  if (!/\d/.test(pass)) return 'La contraseña debe incluir al menos un número'
  const minusc = pass.toLowerCase()
  if (email && minusc === String(email).toLowerCase()) return 'La contraseña no puede ser igual al email'
  if (name && minusc === String(name).toLowerCase()) return 'La contraseña no puede ser igual al nombre'
  return null
}

module.exports = { validar_password, LONGITUD_MIN, LONGITUD_MAX }
