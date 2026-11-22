import { ref }         from "vue"
import { defineStore } from "pinia"
import { useModal } from '@greenborn/vue-greenborn-modal-manager'

// Los modales los gestiona @greenborn/vue-greenborn-modal-manager (pila única, montada en App.vue con <ModalContainer />).
// AppStore conserva la firma pública que usan las pantallas, delegando en el singleton del paquete.
const modal = useModal()

export const AppStore = defineStore('app',() =>  {
  const userInfo       = ref(null)
  const rutas          = ref([])
  const tipoUsuario    = ref('')
  const opcionesMenu   = ref([])
  const sidebarVisible = ref(false)
  const ruta_actual    = ref({})
  const loading = ref(false)

  const toggle_sidebar = function(){
    this.sidebarVisible = !this.sidebarVisible
  }

  /**
   * Abre un modal. Devuelve { code }, que se puede pasar a ocultar_modal().
   * Firma: (componente, titulo, parametros?, config_modal?)
   */
  const mostrar_modal = (componente, titulo, parametros = {}, config_modal = {}) =>
    modal.mostrar_modal(componente, titulo, parametros, config_modal)

  /**
   * Oculta el modal con el codigo recibido; sin codigo oculta todos.
   */
  const ocultar_modal = (cod = null) => modal.ocultar_modal(cod)

  const mostrar_alerta = (texto) => modal.mostrar_alerta(texto)

  /**
   * Confirmación Sí/No. params: { title, text, confirmar_accion, no_confirma_accion?, severity_confirmar? }
   */
  const mostrar_confirm = (params) => modal.mostrar_confirm(params)

  return {
    userInfo, sidebarVisible, rutas, opcionesMenu, tipoUsuario, ruta_actual, toggle_sidebar,
    mostrar_modal, ocultar_modal, loading, mostrar_alerta, mostrar_confirm
  }
})
