import request from '../../helpers/requestAdmin'

export function get_all(params) {
  return request({
    url: '/categorias/get_all',
    method: 'get',
    params,
  })
}

export function productos_categoria(params) {
  return request({
    url: '/categorias/productos_categoria',
    method: 'get',
    params,
  })
}

export function productos_disponibles(params) {
  return request({
    url: '/categorias/productos_disponibles',
    method: 'get',
    params,
  })
}

export function categorias_disponibles(params) {
  return request({
    url: '/categorias/categorias_disponibles',
    method: 'get',
    params,
  })
}

export function arbol(params) {
  return request({
    url: '/categorias/arbol',
    method: 'get',
    params,
  })
}

export function add_one(data) {
  return request({
    url: '/categorias/add_one',
    method: 'post',
    data,
  })
}

export function put_one(data) {
  return request({
    url: '/categorias/put_one',
    method: 'put',
    data,
  })
}

export function delete_one(data) {
  return request({
    url: '/categorias/delete_one',
    method: 'delete',
    data,
  })
}

export function add_producto(data) {
  return request({
    url: '/categorias/add_producto',
    method: 'post',
    data,
  })
}

export function remove_producto(data) {
  return request({
    url: '/categorias/remove_producto',
    method: 'delete',
    data,
  })
}
