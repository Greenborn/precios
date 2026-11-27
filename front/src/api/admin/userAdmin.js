import request from '../../helpers/requestAdmin'

export function login(data) {
  return request({
    url: '/user/login',
    method: 'post',
    data
  })
}

export function ssoLogin(data) {
  return request({
    url: '/user/sso_login',
    method: 'post',
    data
  })
}

export function signup(data) {
  return request({
    url: '/user/signup',
    method: 'post',
    data
  })
}

export function info() {
  return request({
    url: '/user/info',
    method: 'get',
    data: ''
  })
}

export function logout(data = {}) {
  return request({
    url: '/user/logout',
    method: 'post',
    data
  })
}

// Datos de la propia cuenta (nombre, apellido, email, es_negocio). No incluye contraseña.
export function guardarConfig(idata) {
  const { pass, pass_repeat, ...data } = idata || {}
  return request({
    url: '/user/guardar_config',
    method: 'put',
    data
  })
}

// Cambia la contraseña de la propia cuenta. Valida reglas y coincidencia en el back.
export function cambiarPassword({ pass, pass_repeat }) {
  return request({
    url: '/user/cambiar_password',
    method: 'put',
    data: { pass, pass_repeat }
  })
}

// Compatibilidad (formulario admin ConfigCuenta): si trae contraseña real, la cambia por
// cambiarPassword y guarda el resto por guardarConfig.
export async function guardarConfigCompleto(idata) {
  const { pass, pass_repeat } = idata || {}
  const hay_pass = pass && pass !== '********'
  if (hay_pass) {
    const r = await cambiarPassword({ pass, pass_repeat })
    if (r?.stat === false) return r
  }
  return guardarConfig(idata)
}
