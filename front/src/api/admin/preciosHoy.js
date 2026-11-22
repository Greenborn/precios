// API de precios del día de hoy (caché en memoria del backend). Solo listado (GET /list).
// Los métodos de crudHttp RECHAZAN ante error; el detalle viene en err.response.data.message.
import { crudHttp } from '@/helpers/crudHttp'

const BASE = '/precios_hoy'

// Resuelve con { status, data: { rows, totalRecords, fields_def, paginacion } }
export function get_all(params) {
  return crudHttp.get(`${BASE}/list`, { params })
}
