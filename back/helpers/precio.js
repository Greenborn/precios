// Regla única de validación de precios. La columna price.price es decimal(10,2): todo precio
// que se guarde tiene que validarse acá antes de tocar la base.
// El front replica la regla de las cargas de usuarios en front/src/utils/precio.js
// (test_validacion_precio.js comprueba que ambas coincidan).

const PRECIO_MAX = 99999999.99

const MENSAJES = {
  obligatorio: 'El precio es obligatorio',
  no_numerico: 'El precio debe ser un número',
  no_positivo: 'El precio debe ser mayor a 0',
  maximo: 'El precio no puede superar 99.999.999,99',
  decimales: 'El precio admite hasta 2 decimales, sin separador de miles',
}

// Sólo dígitos con un separador decimal opcional: sin exponente, hexadecimal ni separador de miles
const FORMATO_USUARIO = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/
const FORMATO_IMPORTADOR = /^[+-]?(\d+(\.\d*)?|\.\d+)$/

const error = (motivo) => ({ ok: false, precio: null, motivo, mensaje: MENSAJES[motivo] })

function interpretar(valor, formato) {
  if (typeof valor === 'number') return valor
  const texto = valor.trim()
  return formato.test(texto) ? Number(texto.replace(',', '.')) : NaN
}

// opciones.redondear: para importadores. Admite más de 2 decimales (se redondean, como hace
// la columna) y no admite coma decimal.
// Devuelve { ok, precio, motivo, mensaje }; si es válido, precio es un número con 2 decimales.
function validar_precio(valor, { redondear = false } = {}) {
  if (valor === undefined || valor === null || (typeof valor === 'string' && !valor.trim()))
    return error('obligatorio')
  if (typeof valor !== 'number' && typeof valor !== 'string') return error('no_numerico')

  const n = interpretar(valor, redondear ? FORMATO_IMPORTADOR : FORMATO_USUARIO)
  if (!Number.isFinite(n)) return error('no_numerico')

  const redondeado = Math.round(n * 100) / 100
  if (redondeado <= 0) return error('no_positivo')
  if ((redondear ? redondeado : n) > PRECIO_MAX) return error('maximo')
  if (!redondear) {
    // Texto: se cuentan los decimales escritos ("1.500" suele querer decir mil quinientos)
    const escritos = typeof valor === 'string' ? (valor.trim().split(/[.,]/)[1] || '').length : 0
    if (escritos > 2 || Math.abs(n - redondeado) > 1e-9) return error('decimales')
  }
  return { ok: true, precio: redondeado, motivo: null, mensaje: null }
}

module.exports = { PRECIO_MAX, MENSAJES, validar_precio }
