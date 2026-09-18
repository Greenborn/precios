import Cookies from 'js-cookie'
import { markRaw } from 'vue'
import Layout from '../components/layout/Layout.vue'
import { routes as rutas_iniciales } from "../router";

import { info as infoAdmins, logout as logoutAdmins } from '../api/admin/userAdmin'
import { datos_logout_sso, limpiar_sso } from '../utils/sso'

import { referencias_componentes } from '../components/referencias_importables'

const tiposUsuario = {
  'admin':{
    api_get_info: ()=>{ return infoAdmins() },
    api_logout:()=>{  return logoutAdmins( datos_logout_sso() ) }
  },
}

const TokenKey = 'token_agc'

export function getToken() {
  return Cookies.get(TokenKey)
}

export function setToken(token) {
  return Cookies.set(TokenKey, token)
}

async function do_logout( storeApp, router ){
  let logout_rpt = await tiposUsuario[ storeApp.tipoUsuario ].api_logout()

  if (logout_rpt) {
    limpiar_sso()
    setUserInfo( 'admin', storeApp, undefined, router, null)
    router.replace({ path: '/' })
  } else {
    console.log('No se pudo cerrar sessión')
  }
}

export function setUserInfo( tipo_usuario, storeApp, userData, router, token = null ) {
  storeApp.userInfo = userData
  storeApp.tipoUsuario = tipo_usuario
  setToken( token )

  if (storeApp.userInfo == null){
    storeApp.rutas = []
  } else {
    storeApp.rutas        = {... rutas_parseadas( storeApp.userInfo.rutas, tipo_usuario)}
    storeApp.opcionesMenu = configuracion_menu( storeApp.userInfo.rutas, tipo_usuario )
    
    storeApp.opcionesMenu.push({
      'icon':      'pi-power-off',
      'title':     'Salir',
      'sub_items': [],
      'orden_visualizacion': 100000,
      'onClick':   ()=>{
        return do_logout( storeApp, router )
      }
    })
  }
  actualizar_rutas( router, storeApp )
}

export async function getUserInfo( consultar_por ){
  
  if (consultar_por == '') //si se trata de la url base
    return undefined

  if (!tiposUsuario.hasOwnProperty(consultar_por)) //no se trata de una url de cual haya peticion de informacion registrada
    return undefined
    
  let user_info_req = await tiposUsuario[consultar_por].api_get_info()

  if (user_info_req){
    if (!user_info_req.stat) { //no hay sesion activa
      return undefined
    }
    //hay sesion activa
    return user_info_req
  } 
}

function configuracion_menu( rutas, tipo_usuario ){
  let menu_conf = []

  for (let c = 0; c < rutas.length; c++){
    let menu_item = {
      'id':        rutas[c].id,
      'path':      '',
      'id_ruta_root': rutas[c].id_ruta_root,
      'component': rutas[c].componente,
      'icon':      rutas[c].icon,
      'title':     rutas[c].title,
      'orden_visualizacion': rutas[c].orden_visualizacion,
      'sub_items': [],
      'expanded': false  
    }

    if (rutas[c].id_ruta_root == null || rutas[c].id_ruta_root == ""){
      menu_item.path = '/' + tipo_usuario + '/' + rutas[c].path
      menu_conf.push( menu_item )
    } 
  }

  for (let c = 0; c < rutas.length; c++){
    let menu_item = {
      'id':        rutas[c].id,
      'path':      '',
      'id_ruta_root': rutas[c].id_ruta_root,
      'component': rutas[c].componente,
      'orden_visualizacion': rutas[c].orden_visualizacion,
      'icon':      rutas[c].icon,
      'title':     rutas[c].title,
      'sub_items': [],
      'expanded': false 
    }

    if (rutas[c].id_ruta_root != null && rutas[c].id_ruta_root != ""){
      
      for (let i = 0; i < menu_conf.length; i++){
        if (rutas[c].id_ruta_root == menu_conf[i].id){
          menu_item.path = menu_conf[i].path + '/' + rutas[c].path
          menu_conf[i].sub_items.push( menu_item )
          break;
        }
      }
    }
  }

  menu_conf.sort((item1, item2) => {
    if (item1.orden_visualizacion < item2.orden_visualizacion) {
      return -1;
    }
    if (item1.orden_visualizacion > item2.orden_visualizacion) {
      return 1;
    }
    return 0;
  })

  for(let c=0; c < menu_conf.length; c++){
    menu_conf[c].sub_items.sort((item1, item2) => {
      if (item1.orden_visualizacion < item2.orden_visualizacion) {
        return -1;
      }
      if (item1.orden_visualizacion > item2.orden_visualizacion) {
        return 1;
      }
      return 0;
    })
  }

  return menu_conf
}

function rutas_parseadas( rutas, tipo_usuario ){
  let rutas_tmp = []

  for (let c = 0; c < rutas.length; c++){
    let comp = referencias_componentes[rutas[c].componente]
    let ruta = {
      name: rutas[c].id,
      path: '',
      component: comp ? markRaw(comp) : comp,//import(rutas[c].componente),//, //
      children: [],
      meta: { }
    }

    if (rutas[c].title !== null)
      ruta.meta['title'] = rutas[c].title 
    
    if (rutas[c].icon !== null)
      ruta.meta['icon'] = rutas[c].icon 
    

    if (rutas[c].id_ruta_root == null || rutas[c].id_ruta_root == ""){
      ruta.path = '/' + tipo_usuario + '/' + rutas[c].path
    } else {
      for (let i = 0; i < rutas.length; i++){
        if (rutas[c].id_ruta_root == rutas[i].id){
          ruta.path = '/' + tipo_usuario + '/' + rutas[i].path + '/' + rutas[c].path
          break;
        }
      }
    }

    rutas_tmp.push(ruta)
  }

  return rutas_tmp
}

function actualizar_rutas( router, storeApp){
  //Se resetean las rutas
  let rutas_actuales = router.getRoutes()
  for (let c=0; c < rutas_actuales.length; c++){
    router.removeRoute(rutas_actuales[c].name)
  }
  for (let c=0; c < rutas_iniciales.length; c++){
    router.addRoute(rutas_iniciales[c])
  }

  //Se agregan nuevas rutas
  for (const key in storeApp.rutas) {
    const element = storeApp.rutas[key];
    
    if (!router.hasRoute(element.name)){
      router.addRoute('root',element)
    }
  }
  
  if (!router.hasRoute('redirect_404'))
    router.addRoute({ path: '/:error*', name:'redirect_404', redirect: '/', hidden: true })
//console.log(router.getRoutes())
}

function getTipoUsuarioFURL(){
  let url_actual = window.location
  let partes = String(url_actual).split('/#/')
  if (partes.length < 2) return ''
  return partes[1].split('/')[0]
}

export async function getRouterConRutas( router, storeApp ){
  let token = getToken()
  let tipoUsuario = getTipoUsuarioFURL()
  let userInfo = await getUserInfo( tipoUsuario )

  if (userInfo != undefined){
    if (!userInfo.stat) { //esta situacion no debería darse pero igual se hace comprobacion opr las dudas
      router.replace({ path: '/' })
      return router
    }

    setUserInfo( tipoUsuario, storeApp, userInfo.data, router, token )
    return router
  } else {
    if (!router.hasRoute('redirect_404'))
      router.addRoute({ path: '/:error*', name:'redirect_404', redirect: '/', hidden: true })
    return null
  }

}
