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

export function guardarConfig(idata) {
  let data = {...idata}
  //revisamos el valor del campo contraseña, si tiene asignado los asteriscos (usado más bien como un place holder), se quitan del json
  if (data.pass == '********'){
    delete data.pass
    delete data.pass_repeat
  }
  return request({
    url: '/user/guardar_config',
    method: 'put',
    data
  })
}