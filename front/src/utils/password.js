// Reglas mínimas de contraseña. Espejo de back/helpers/password_reglas.js (el back es la validación definitiva).
export const LONGITUD_MIN = 8
export const LONGITUD_MAX = 128

// Devuelve null si la contraseña es válida o el mensaje de la primera regla incumplida.
export function validar_password(pass, { email = '', name = '' } = {}) {
  if (!pass) return 'La contraseña es requerida'
  if (pass.length < LONGITUD_MIN) return `La contraseña debe tener al menos ${LONGITUD_MIN} caracteres`
  if (pass.length > LONGITUD_MAX) return `La contraseña no puede superar ${LONGITUD_MAX} caracteres`
  if (!/[A-Za-z]/.test(pass)) return 'La contraseña debe incluir al menos una letra'
  if (!/\d/.test(pass)) return 'La contraseña debe incluir al menos un número'
  const minusc = pass.toLowerCase()
  if (email && minusc === email.toLowerCase()) return 'La contraseña no puede ser igual al email'
  if (name && minusc === name.toLowerCase()) return 'La contraseña no puede ser igual al nombre'
  return null
}
