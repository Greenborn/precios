// Área privada del negocio: locales, perfil, fotos de artículos y carga de precios propios.
// - `http`: instancia axios (rechaza ante error y devuelve { data }), requerida por los
//   paquetes @greenborn/vue-greenborn-perfil y @greenborn/vue-greenborn-locales-mapa.
// - Carga de precios: usa el request del proyecto, igual que el resto de /publico.
import axios from 'axios'
import request from '@/helpers/request'
import { getToken, setToken } from '@/utils/auth'

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

// Sesión vencida o inválida: se descarta el token y se lleva al login volviendo a la página actual
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && getToken()) {
      setToken(null)
      const destino = window.location.hash.replace(/^#/, '') || '/'
      if (!destino.startsWith('/admin/login')) {
        window.location.hash = '#/admin/login?redirect=' + encodeURIComponent(destino)
      }
    }
    return Promise.reject(err)
  }
)

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

// Ficha pública del negocio (sin login). `perfilId` es perfiles.id (igual que /api/perfil/publico/:id).
export function obtener_perfil_publico(perfilId) {
  return http.get(`/api/perfil/publico/${perfilId}`).then((r) => r.data)
}

export function listar_locales_publicos_negocio(perfilId) {
  return http.get(`/api/negocio/publico/${perfilId}/locales`).then((r) => r.data)
}

export function listar_productos_publicos_negocio(perfilId, { limit = 50, offset = 0 } = {}) {
  return http.get(`/api/negocio/publico/${perfilId}/productos`, { params: { limit, offset } }).then((r) => r.data)
}

// Las fotos se sirven desde el backend (FOTOS_URL es relativa a su raíz)
export function url_absoluta_backend(ruta) {
  return ruta ? `${import.meta.env.VITE_APP_BACKEND_ADMIN}${ruta}` : null
}

export function obtener_mi_perfil() {
  return http.get('/api/perfil/mi-perfil').then((r) => r.data)
}

export function listar_mis_precios({ limit = 50, offset = 0 } = {}) {
  return http.get('/api/negocio/mis-precios', { params: { limit, offset } }).then((r) => r.data)
}

// Portada y foto de perfil del negocio (tipo: 'portada' | 'foto')
export function obtener_mis_imagenes_perfil() {
  return http.get('/api/negocio/mi-perfil/imagenes').then((r) => r.data)
}

export function guardar_imagen_perfil(tipo, imagen) {
  return http.put(`/api/negocio/mi-perfil/imagen/${tipo}`, { imagen }).then((r) => r.data)
}

export function quitar_imagen_perfil(tipo) {
  return http.delete(`/api/negocio/mi-perfil/imagen/${tipo}`).then((r) => r.data)
}

export function obtener_imagenes_publicas_negocio(perfilId) {
  return http.get(`/api/negocio/publico/${perfilId}/imagenes`).then((r) => r.data)
}

// Elimina perfil, locales, fotos y precios del usuario (la cuenta de acceso se conserva)
export function eliminar_datos_cuenta() {
  return http.delete('/api/negocio/mi-cuenta/datos').then((r) => r.data)
}

// Medios de contacto del negocio
export function obtener_mis_contactos() {
  return http.get('/api/negocio/mi-perfil/contactos').then((r) => r.data)
}

export function guardar_mis_contactos(contactos) {
  return http.put('/api/negocio/mi-perfil/contactos', { contactos }).then((r) => r.data)
}

export function obtener_contactos_publicos_negocio(perfilId) {
  return http.get(`/api/negocio/publico/${perfilId}/contactos`).then((r) => r.data)
}
