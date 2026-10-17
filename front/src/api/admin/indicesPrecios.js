import request from '../../helpers/requestAdmin'

export function get_all(params) {
  return request({
    url: '/indices_precios/get_all',
    method: 'get',
    params,
  })
}

export function alias_categoria_disponibles(params) {
  return request({
    url: '/indices_precios/alias_categoria_disponibles',
    method: 'get',
    params,
  })
}

export function add_one(data) {
  return request({
    url: '/indices_precios/add_one',
    method: 'post',
    data,
  })
}

export function put_one(data) {
  return request({
    url: '/indices_precios/put_one',
    method: 'put',
    data,
  })
}

export function delete_one(data) {
  return request({
    url: '/indices_precios/delete_one',
    method: 'delete',
    data,
  })
}
