import request from '../../helpers/requestAdmin'

export function get_all(params) {
  return request({
    url: '/alias_categorias/get_all',
    method: 'get',
    params,
  })
}

export function categorias_disponibles(params) {
  return request({
    url: '/alias_categorias/categorias_disponibles',
    method: 'get',
    params,
  })
}

export function add_one(data) {
  return request({
    url: '/alias_categorias/add_one',
    method: 'post',
    data,
  })
}

export function put_one(data) {
  return request({
    url: '/alias_categorias/put_one',
    method: 'put',
    data,
  })
}

export function delete_one(data) {
  return request({
    url: '/alias_categorias/delete_one',
    method: 'delete',
    data,
  })
}
