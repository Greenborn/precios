// API de alias de categorías: rutas del paquete express-greenborn-crud (montadas en /admin/alias_categorias).
// Los métodos de crudHttp RECHAZAN ante error; el detalle viene en err.response.data.message.
import { crudHttp } from '@/helpers/crudHttp'

const BASE = '/alias_categorias'

// Resuelve con { status, data: { rows, totalRecords, fields_def, ... } }
export function get_all(params) {
  return crudHttp.get(`${BASE}/list`, { params })
}

export function add_one(data) {
  return crudHttp.post(`${BASE}/`, data)
}

export function put_one(id, data) {
  return crudHttp.put(`${BASE}/${id}`, data)
}

export function delete_one(id) {
  return crudHttp.delete(`${BASE}/${id}`)
}
