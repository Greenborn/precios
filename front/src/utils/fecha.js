// Fechas de las cargas de precios. Réplica de back/helpers/fecha_precio.js: no se aceptan
// fechas posteriores a mañana según el calendario de Argentina (UTC-3 todo el año).

export const MENSAJE_FECHA_FUTURA = 'La fecha no puede ser posterior a mañana'

// Día de Argentina ("YYYY-MM-DD") desplazado `dias` respecto de hoy
export function dia_desde_hoy(dias = 0, ahora = new Date()) {
  return new Date(ahora.getTime() + (dias * 24 - 3) * 3600000).toISOString().slice(0, 10)
}

// `fecha` es el valor de un input date ("YYYY-MM-DD")
export const es_fecha_futura = (fecha, ahora = new Date()) => String(fecha || '') > dia_desde_hoy(1, ahora)
