// Adaptador HTTP para CrudModulo de @greenborn/vue-greenborn-crud.
//
// El contrato del paquete: cada método resuelve con el body JSON ({ status, data })
// y RECHAZA ante error HTTP, con el detalle en err.response.data (message, errors).
// requestAdmin (interceptor de axios) no lanza: devuelve { error: true, msg } ante fallos
// de red o HTTP, y el body si la respuesta es 2xx. Este adaptador unifica ambos casos.
import request from './requestAdmin'

async function llamar(cfg) {
  const res = await request(cfg)

  if (res && res.error) {
    const data = res.msg?.response?.data ?? { status: false, message: 'Error al comunicarse con el servidor' }
    const err = new Error(data.message || 'Error al comunicarse con el servidor')
    err.response = { data }
    throw err
  }

  if (res && res.status === false) {
    const err = new Error(res.message || 'Operación rechazada')
    err.response = { data: res }
    throw err
  }

  return res
}

export const crudHttp = {
  get: (url, cfg) => llamar({ url, method: 'get', params: cfg?.params }),
  post: (url, body) => llamar({ url, method: 'post', data: body }),
  put: (url, body) => llamar({ url, method: 'put', data: body }),
  delete: (url) => llamar({ url, method: 'delete' }),
}
