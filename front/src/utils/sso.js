// Utilidades de integración con el servicio SSO de Greenborn (app_id "precios").
// Flujo: iniciar_sso() redirige al SSO central, que vuelve a /#/admin/login-redirect
// con un token temporal; se canjea por el bearer token y la sesión SSO queda
// disponible para su revocación al cerrar sesión.
import axios from 'axios'

const SSO_BASE_URL = import.meta.env.VITE_SSO_BASE_URL || 'https://auth.greenborn.com.ar'
const UNIQUE_ID_KEY = 'sso_client_unique_id'
const SSO_TOKEN_KEY = 'sso_bearer_token'
const SSO_USER_KEY = 'sso_user_data'
const SSO_REDIRECT = '/#/admin/login-redirect'

export function getUniqueId() {
  let id = localStorage.getItem(UNIQUE_ID_KEY)
  if (!id) {
    id = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 12)
    localStorage.setItem(UNIQUE_ID_KEY, id)
  }
  return id
}

export function getSsoToken() {
  return localStorage.getItem(SSO_TOKEN_KEY)
}

export function setSsoSession(bearerToken, user) {
  localStorage.setItem(SSO_TOKEN_KEY, bearerToken)
  localStorage.setItem(SSO_USER_KEY, JSON.stringify(user || {}))
}

export function limpiar_sso() {
  localStorage.removeItem(SSO_TOKEN_KEY)
  localStorage.removeItem(SSO_USER_KEY)
}

// Redirección post-login: como el flujo SSO pierde la query al volver del
// SSO central, el destino se persiste en localStorage (ver LoginAdmin/LoginRedirect)
const AFTER_LOGIN_KEY = 'redirect_after_login'

export function setRedirectAfterLogin(path) {
  if (path) localStorage.setItem(AFTER_LOGIN_KEY, path)
}

export function getRedirectAfterLogin() {
  return localStorage.getItem(AFTER_LOGIN_KEY)
}

export function limpiarRedirectAfterLogin() {
  localStorage.removeItem(AFTER_LOGIN_KEY)
}

// Redirige al SSO central para iniciar sesión con Google
export function iniciar_sso() {
  const params = new URLSearchParams({
    url_redireccion_app: window.location.origin + SSO_REDIRECT,
    unique_id: getUniqueId(),
  })
  window.location.href = `${SSO_BASE_URL}/auth/google?${params}`
}

// Canjea el token temporal que envía el SSO por el bearer token de sesión
export async function canjear_token_temporal(token) {
  const response = await axios.post(`${SSO_BASE_URL}/auth/login`, { token }, { timeout: 15000 })
  const data = response.data
  if (!data?.success || !data?.data?.bearer_token) {
    throw new Error(data?.message || 'El SSO no devolvió bearer token')
  }
  setSsoSession(data.data.bearer_token, data.data.user)
  return data.data
}

// Datos para que el backend revoque la sesión SSO al cerrar sesión (si aplica)
export function datos_logout_sso() {
  const token = getSsoToken()
  if (!token) return {}
  return { sso_token: token, unique_id: getUniqueId() }
}
