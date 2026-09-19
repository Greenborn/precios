import create from '../../helpers/request'
const request = create(import.meta.env.VITE_APP_BACKEND_ADMIN, false)

export function chat_bot_rsp( data ) {
  return request({ url: '/publico/chatbot/chat_bot_rsp', method: 'post', data })
}

export function busqueda( termino ) {
  return request({ url: '/publico/busqueda/precios?product_name='+encodeURI(termino), method: 'get' })
}
export function busqueda_promociones( termino ) {
  return request({ url: '/publico/busqueda/promociones?product_name='+encodeURI(termino), method: 'get' })
}

export function comercios_promociones() {
  return request({ url: '/publico/busqueda/comercios_promociones', method: 'get' })
}

export function info_comercio( website ) {
  return request({ url: '/publico/busqueda/info_comercio?website='+encodeURI(website), method: 'get' })
}

export function public_news() {
  return request({ url: '/public-news', method: 'get' })
}

export function get_estadistica(id) {
  return request({ url: '/publico/estadistica/data?id_estadistica='+id, method: 'get' })
}

export function enviar_datos(datos) {
  return request({ url: '/publico/estadistica/precios_usuarios', method: 'post', data: datos })
}

export function get_categorias() {
  return request({ url: '/publico/categorias/all', method: 'get' })
}

export function get_sub_categorias( cat_menu_id ) {
  return request({ url: '/publico/categorias/get_sub_categorias?cat_menu_id='+cat_menu_id, method: 'get' })
}

export function get_empresas_categoria( menu_category_id ) {
  return request({ url: '/publico/categorias/get_empresas_categoria?menu_category_id='+menu_category_id, method: 'get' })
}

export function get_categorias_empresa( enterprise_id ) {
  return request({ url: '/publico/categorias/get_categoria_empresa?enterprise_id='+enterprise_id, method: 'get' })
}

export function get_productos( category_id ) {
  return request({ url: '/publico/productos/all?category_id='+category_id, method: 'get' })
}

export function cargar_nuevo_precio( data ) {
  return request({ url: '/publico/productos/cargar_nuevo_precio', method: 'put',  data:data })
}

export function cargar_precios_formulario( data ) {
  return request({ url: '/publico/productos/cargar_precios_formulario', method: 'put', data:data })
}