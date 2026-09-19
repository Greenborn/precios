
// Mapa de componentes de administracion.
// Las claves deben coincidir con el campo "componente" de la tabla `rutas`
// que el backend devuelve dentro de userInfo.rutas.
import Dasboard from './admin/Dasboard.vue'
import AbmAdmins from './admin/abmAdmin/AbmAdmins.vue'
import AbmRoles from './admin/acceso/abmRoles/AbmRoles.vue'
import AbmPermisos from './admin/acceso/abmPermisos/AbmPermisos.vue'
import AbmRutas from './admin/acceso/abmRutas/AbmRutas.vue'
import AbmPreciosComunitarios from './admin/abmPrecios/AbmPreciosComunitarios.vue'
import ConfigCuenta from './admin/cuenta/ConfigCuenta.vue'

export const referencias_componentes = {
  Dasboard,
  AbmAdmins,
  AbmRoles,
  AbmPermisos,
  AbmRutas,
  AbmPreciosComunitarios,
  ConfigCuenta,
}
