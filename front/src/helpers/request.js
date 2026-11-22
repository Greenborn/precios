import axios from 'axios'
import { getToken } from '../utils/auth'

const create = function( url,  with_credentials=true){
  const service = axios.create({
    baseURL: url, // url = base url + request url
    withCredentials: with_credentials, // send cookies when cross-domain requests
    timeout: 30000 // request timeout
  })
  
  // request interceptor
  // Seudo Proxy
  service.interceptors.request.use(
  
    config => {
      const token = getToken();
      if (token !== null) {
        config.headers['x-api-key'] = token
      }
      return config
    },
    error => {
  
      // do something with request error
      console.error("request err", error)
      return Promise.reject(error)
    }
  )
  
  // response interceptor
  service.interceptors.response.use(
    /**
     * If you want to get http information such as headers or status
     * Please return  response => response
    */
  
    /**
     * Determine the request status by custom code
     * Here is just an example
     * You can also judge the status by HTTP Status Code
     */
    response => {
      //loadingInstance.close()
  
      const res = response.data
  
      // if the custom code is not 20000, it is judged as an error.
      return res
  
    },
    error => {
      console.error("response err", error)
      const res = { error: true, msg: error }
      return res
    }
  )
  return service
}

var loadingInstance;
// create an axios instance


export default create
