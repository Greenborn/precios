// Regla única de fechas para las cargas de precios: no se aceptan fechas posteriores a
// mañana según el calendario de Argentina. La replican front/src/utils/fecha.js y
// extra_services/actualizar_precios.py (validar_fecha).
// Argentina es UTC-3 todo el año (sin horario de verano).

const DESFASE_MS = 3 * 60 * 60 * 1000
const DIA_MS = 24 * 60 * 60 * 1000

const MENSAJES_FECHA = {
  no_valida: 'La fecha no es válida',
  futura: 'La fecha no puede ser posterior a mañana',
}

// "YYYY-MM-DD", opcionalmente con hora ("T" o espacio), fracción y zona (Z o ±HH[:MM])
const FORMATO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?)?$/i

const iso_argentina = (instante) => new Date(instante - DESFASE_MS).toISOString()

// Día de Argentina ("YYYY-MM-DD") desplazado `dias` respecto de hoy
function dia_desde_hoy(dias, ahora = new Date()) {
  return iso_argentina(ahora.getTime() + dias * DIA_MS).slice(0, 10)
}

// Devuelve { dia, fecha } o null si no se reconoce. `fecha` es el valor a guardar: el
// recibido, salvo las cadenas con zona, que se pasan a hora de Argentina para que lo
// guardado coincida con lo validado.
function interpretar_fecha(valor) {
  if (valor instanceof Date || typeof valor === 'number') {
    const d = new Date(valor)
    return isNaN(d.getTime()) ? null : { dia: iso_argentina(d.getTime()).slice(0, 10), fecha: valor }
  }
  if (typeof valor !== 'string') return null
  const texto = valor.trim()
  const m = FORMATO.exec(texto)
  if (!m) return null
  const [anio, mes, dia, hora, min, seg] = m.slice(1, 7).map((x) => Number(x || 0))
  const utc = Date.UTC(anio, mes - 1, dia, hora, min, seg)
  const d = new Date(utc)
  // Rechaza lo que no existe en el calendario (p. ej. 2026-02-31 o las 25 h)
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia ||
      hora > 23 || min > 59 || seg > 59) return null
  const zona = m[7]
  if (!zona) return { dia: texto.slice(0, 10), fecha: texto }
  let desfase = 0
  if (zona.toUpperCase() !== 'Z') {
    const z = zona.slice(1).replace(':', '')
    desfase = (zona[0] === '-' ? -1 : 1) * (Number(z.slice(0, 2)) * 60 + Number(z.slice(2) || 0)) * 60000
  }
  const local = iso_argentina(utc - desfase)
  return { dia: local.slice(0, 10), fecha: local.slice(0, 19).replace('T', ' ') }
}

// Devuelve { ok, fecha, motivo, mensaje }
function validar_fecha_precio(valor, { ahora = new Date() } = {}) {
  const r = interpretar_fecha(valor)
  const motivo = !r ? 'no_valida' : (r.dia > dia_desde_hoy(1, ahora) ? 'futura' : null)
  if (motivo) return { ok: false, fecha: null, motivo, mensaje: MENSAJES_FECHA[motivo] }
  return { ok: true, fecha: r.fecha, motivo: null, mensaje: null }
}

module.exports = { MENSAJES_FECHA, dia_desde_hoy, interpretar_fecha, validar_fecha_precio }
