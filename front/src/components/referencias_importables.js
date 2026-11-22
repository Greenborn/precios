// Mapa de componentes de administracion.
// Las claves deben coincidir con el campo "componente" de la tabla `rutas`
// que el backend devuelve dentro de userInfo.rutas.
// Carga diferida: cada ABM se descarga en su propio chunk al navegar a la ruta.
export const referencias_componentes = {
  Dasboard: () => import('./admin/Dasboard.vue'),
  AbmAdmins: () => import('./admin/abmAdmin/AbmAdmins.vue'),
  AbmRoles: () => import('./admin/acceso/abmRoles/AbmRoles.vue'),
  AbmPermisos: () => import('./admin/acceso/abmPermisos/AbmPermisos.vue'),
  AbmRutas: () => import('./admin/acceso/abmRutas/AbmRutas.vue'),
  AbmPreciosComunitarios: () => import('./admin/abmPrecios/AbmPreciosComunitarios.vue'),
  AbmAliasProductos: () => import('./admin/abmAliasProductos/AbmAliasProductos.vue'),
  AbmCategorias: () => import('./admin/abmCategorias/AbmCategorias.vue'),
  AbmAliasCategorias: () => import('./admin/abmAliasCategorias/AbmAliasCategorias.vue'),
  AbmIndicesPrecios: () => import('./admin/abmIndicesPrecios/AbmIndicesPrecios.vue'),
  ConfigCuenta: () => import('./admin/cuenta/ConfigCuenta.vue'),
}
