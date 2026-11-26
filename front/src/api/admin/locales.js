import request from '../../helpers/requestAdmin'

export function get_all(params) {
  return request({
    url: '/locales/get_all',
    method: 'get',
    params,
  })
}

export function put_one(data) {
  return request({
    url: '/locales/put_one',
    method: 'put',
    data,
  })
}
