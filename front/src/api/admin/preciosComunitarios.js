import request from '../../helpers/requestAdmin'

export function get_all(params) {
  return request({
    url: '/precios_comunitarios/get_all',
    method: 'get',
    params,
  })
}

export function delete_one(data) {
  return request({
    url: '/precios_comunitarios/delete_one',
    method: 'delete',
    data,
  })
}
