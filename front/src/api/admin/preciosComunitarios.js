// API de precios comunitarios. Listado con el paquete express-greenborn-crud (GET /list);
// borrado propio (DELETE /:id) porque restaura price_today y las caches.
// Los métodos de crudHttp RECHAZAN ante error; el detalle viene en err.response.data.message.
import { crudHttp } from '@/helpers/crudHttp'

const BASE = '/precios_comunitarios'

// Resuelve con { status, data: { rows, totalRecords, fields_def, ... } }
export function get_all(params) {
  return crudHttp.get(`${BASE}/list`, { params })
}

export function delete_one(id) {
  return crudHttp.delete(`${BASE}/${id}`)
}
