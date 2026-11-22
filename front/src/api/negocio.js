// Área privada del negocio: locales, perfil, fotos de artículos y carga de precios propios.
// - `http`: instancia axios (rechaza ante error y devuelve { data }), requerida por los
//   paquetes @greenborn/vue-greenborn-perfil y @greenborn/vue-greenborn-locales-mapa.
// - Carga de precios: usa el request del proyecto, igual que el resto de /publico.
import axios from 'axios'
import request from '@/helpers/request'
import { getToken } from '@/utils/auth'

export const http = axios.create({
  baseURL: import.meta.env.VITE_APP_BACKEND_ADMIN,
  withCredentials: true,
  timeout: 30000,
})

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers['x-api-key'] = token
  return config
})

// Carga de precios del local propio. Respuesta: { stat, items: { cargados, con_error, detalle } }
export function cargar_precios_negocio(data) {
  return request({ url: '/publico/productos/cargar_precios_negocio', method: 'put', data })
}

export function guardar_foto_articulo(branchId, productId, imagen) {
  return http.put(`/api/negocio/locales/${branchId}/articulos/${productId}/foto`, { imagen })
}

export function listar_fotos_local(branchId) {
  return http.get(`/api/negocio/locales/${branchId}/fotos`).then((r) => r.data)
}
