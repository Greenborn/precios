// Validación de precios cargados por usuarios. Réplica de back/helpers/precio.js (la columna
// price.price es decimal(10,2)); back/test_validacion_precio.js comprueba que coincidan.

export const PRECIO_MAX = 99999999.99

const MENSAJES = {
  obligatorio: 'El precio es obligatorio',
  no_numerico: 'El precio debe ser un número',
  no_positivo: 'El precio debe ser mayor a 0',
  maximo: 'El precio no puede superar 99.999.999,99',
  decimales: 'El precio admite hasta 2 decimales, sin separador de miles',
}

// Sólo dígitos con un separador decimal opcional: sin exponente, hexadecimal ni separador de miles
const FORMATO = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/

const error = (motivo) => ({ ok: false, precio: null, motivo, mensaje: MENSAJES[motivo] })

// Devuelve { ok, precio, motivo, mensaje }; si es válido, precio es un número con 2 decimales.
export function validar_precio(valor) {
  if (valor === undefined || valor === null || (typeof valor === 'string' && !valor.trim()))
    return error('obligatorio')
  if (typeof valor !== 'number' && typeof valor !== 'string') return error('no_numerico')

  let n = valor
  if (typeof valor === 'string') {
    const texto = valor.trim()
    n = FORMATO.test(texto) ? Number(texto.replace(',', '.')) : NaN
  }
  if (!Number.isFinite(n)) return error('no_numerico')

  const redondeado = Math.round(n * 100) / 100
  if (redondeado <= 0) return error('no_positivo')
  if (n > PRECIO_MAX) return error('maximo')
  // Texto: se cuentan los decimales escritos ("1.500" suele querer decir mil quinientos)
  const escritos = typeof valor === 'string' ? (valor.trim().split(/[.,]/)[1] || '').length : 0
  if (escritos > 2 || Math.abs(n - redondeado) > 1e-9) return error('decimales')
  return { ok: true, precio: redondeado, motivo: null, mensaje: null }
}
