import request from '../../helpers/requestAdmin'

export function get_all(params) {
  return request({
    url: '/alias_productos/get_all',
    method: 'get',
    params,
  })
}

export function get_productos(params) {
  return request({
    url: '/alias_productos/productos',
    method: 'get',
    params,
  })
}

export function add_one(data) {
  return request({
    url: '/alias_productos/add_one',
    method: 'post',
    data,
  })
}

export function put_one(data) {
  return request({
    url: '/alias_productos/put_one',
    method: 'put',
    data,
  })
}

export function delete_one(data) {
  return request({
    url: '/alias_productos/delete_one',
    method: 'delete',
    data,
  })
}
