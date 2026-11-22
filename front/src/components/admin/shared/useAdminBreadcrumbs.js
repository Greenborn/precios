import { computed } from 'vue'
import { AppStore } from '@/stores/app'

// Breadcrumbs del panel admin a partir de la ruta actual y el menu RBAC.
export function useAdminBreadcrumbs() {
  const storeApp = AppStore()
  return computed(() => {
    const actual = storeApp.ruta_actual || {}
    const crumbs = [{ label: 'Panel', to: '/admin/dashboard' }]
    if (actual.id_ruta_root) {
      const padre = (storeApp.opcionesMenu || []).find(m => m.id == actual.id_ruta_root)
      if (padre) crumbs.push({ label: padre.title })
    }
    if (actual.title) crumbs.push({ label: actual.title })
    return crumbs
  })
}
