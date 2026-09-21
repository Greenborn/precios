import { ref }         from "vue"
import { defineStore } from "pinia"
import { shallowRef } from "vue"

import DialogConfirm  from '../components/genericos/DialogConfirm.vue'

export const MAX_MODALS_LVLS = 20
export const MODALS_INIT = { activo: false, id: 0, code: 0,  componente: null, parametros: {}, titulo: '', refresh:()=>{}, dismiss:()=>{}, after_hide:()=>{}, config_modal:{} }

export const AppStore = defineStore('app',() =>  {
  const userInfo       = ref(null)
  const rutas          = ref([])
  const tipoUsuario    = ref('')
  const opcionesMenu   = ref([])
  const sidebarVisible = ref(false)
  const ruta_actual    = ref({})
  const ultimo_cod_modal = ref(0)

  const modals_ = ref(null)
  const loading = ref(false)

  const toggle_sidebar = function(){
    this.sidebarVisible = !this.sidebarVisible
  }

  //Esta funcion se encarga de ordenar la pila de modals para no dejar huecos vacios e ir por la asignación automática de
  // los mismos para asi evitar algunos posibles errores
  const inic_modals = function(){
    if (this.modals_ == null){
      modals_.value = []
      for (let i=0; i < MAX_MODALS_LVLS; i++){
        let n_m = {...MODALS_INIT}
        n_m.id  = i
        this.modals_.push(n_m)
      }
    }
  }

  function modals_ordenados(){
    let aux = []
    let aux_i = []
    let ultimo_id = -1
    for (let i=0; i<modals_.value.length; i++){
      if (modals_.value[i].activo){
        aux.push(modals_.value[i])
        modals_.value[i].id = i
        ultimo_id = i
      } else {
        aux_i.push(modals_.value[i])
      }
    }
    aux = aux.concat( aux_i )
    return { 'modals': aux, 'ultimo_id': ultimo_id }
  }
  
/**
 * Función genérica para mostrar modals
 *
 * @param {VueComponent} componente - Referencia de componente a incrustar en el cuerpo del modal
 * @param {String} titulo - Título a mostrar en el modal
 * @param {Object} parametros - Parametros a pasar al componente interno
 * @param {Object} config_modal - Parametros de configuración para el propio modal
 * 
 * @returns {Object} - { code: Number(this.ultimo_cod_modal)  }
 */
  const mostrar_modal = function( componente, titulo, parametros = {}, config_modal={} ){
    this.ultimo_cod_modal = this.ultimo_cod_modal + 1

    if (!config_modal?.id){
      let m_ordenados = modals_ordenados()

      this.modals_       = m_ordenados.modals
      //console.log(m_ordenados)
      config_modal['id'] = m_ordenados.ultimo_id + 1
    }

    if (this.modals_[config_modal.id].activo){
      console.log(' Se sobreescribe modal! lo que puede dar lugar a errores inesperados!', config_modal)
    }

    this.modals_[config_modal.id].activo       = true
    this.modals_[config_modal.id].componente   = shallowRef(componente)
    this.modals_[config_modal.id].parametros   = {...parametros, '_config_modal': config_modal, '_modal_cod': this.ultimo_cod_modal }
    this.modals_[config_modal.id].titulo       = titulo
    this.modals_[config_modal.id].config_modal = config_modal
    this.modals_[config_modal.id].code         = Number(this.ultimo_cod_modal)

    this.modals_[config_modal.id].after_hide = async ( modal )=> {
      this.modals_[modal.id].activo = false
    }
    
    for (let i=0; i < this.modals_.length; i++)
      this.modals_[i].refresh(config_modal)

    return { code: Number(this.ultimo_cod_modal)  }
  }

/**
 * Oculta el modal con el codigo recibido por parametro, si no se especifica ninguno se ocultan todos los modals
 *
 * @param {string} cod - El código que identifica al modal a ocultar
 */
  const ocultar_modal = function( cod = null ){
    //console.log( cod )
    if (cod != null){
      for (let i=0; i < this.modals_.length; i++)
        if (cod == this.modals_[i].code){
          this.modals_[i].activo = false
          break;
        }
    } else {
      for (let i=0; i < this.modals_.length;i++)
        this.modals_[i].activo = false
    }  
  }

  const mostrar_alerta = function( texto ){
    let modal_id = this.modals_.length-1
    this.mostrar_modal( DialogConfirm, 'Info', { "texto": texto, 
      "botones": [ 
        { label: 'Aceptar', icon: 'pi-check', class: 'p-button-text', autofocus:true, onClick: ()=>{ this.ocultar_modal(this.modals_[modal_id].code); } } 
      ] }, { id:modal_id } )
  }

  const mostrar_confirm = function( params ){
    if (!params.hasOwnProperty('no_confirma_accion'))
      params['no_confirma_accion'] = ()=>{}
    let modal_id = this.modals_.length-1
    this.mostrar_modal(DialogConfirm, params.title, { "texto": params.text, 
      "botones": [
        { label: 'No', icon: 'pi-times', class: 'p-button-text', autofocus:true, onClick: ()=>{ this.ocultar_modal(this.modals_[modal_id].code); params.no_confirma_accion() } },
        { label: 'Si', icon: 'pi-check', class: 'p-button-text', autofocus:false,  onClick: ()=>{ this.ocultar_modal(this.modals_[modal_id].code); params.confirmar_accion() } }
      ],
      after_hide: params.no_confirma_accion
    }, { id:modal_id } )
  }

  return {
    userInfo, sidebarVisible, rutas, opcionesMenu, tipoUsuario, ruta_actual, toggle_sidebar, ultimo_cod_modal,
    modals_, mostrar_modal, ocultar_modal, loading, mostrar_alerta, mostrar_confirm, inic_modals
  }
})