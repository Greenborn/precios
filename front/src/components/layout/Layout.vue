<template>
  <div class="admin-shell" :class="{ 'admin-shell--collapsed': collapsed }">
    <a href="#admin-main" class="admin-skip-link">Saltar al contenido</a>
    <AppTopbar />
    <PwaUpdatePrompt />

    <SideMenu
      :items="menuItems"
      :visible="storeApp.sidebarVisible"
      title="Greenborn Precios"
      @close="storeApp.sidebarVisible = false">
      <template #footer>v{{ version }}</template>
    </SideMenu>

    <main id="admin-main" class="app-main" :class="{ 'app-main--with-sidebar': storeApp.sidebarVisible }" tabindex="-1">
      <div class="app-content">
        <router-view v-slot="{ Component, route }">
          <Transition name="gb-route" mode="out-in">
            <div class="gb-route-view gb-route-view--admin" :key="route.path">
              <component :is="Component" />
            </div>
          </Transition>
        </router-view>
      </div>
    </main>
  </div>
</template>

<script setup>
  import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
  import { provide } from 'vue'
  import PwaUpdatePrompt from './PwaUpdatePrompt.vue'
  import { version } from '../../../package.json'
  import SideMenu, { HAS_PERMISSION_KEY } from '@greenborn/vue-side-menu'
  import AppTopbar from './AppTopbar.vue'
  import { AppStore } from "../../stores/app"
  import { piToBi } from '@/utils/icons'
  import { logout } from '@/utils/auth'

  const storeApp = AppStore()

  provide(HAS_PERMISSION_KEY, () => true)

  // Sidebar colapsable a iconos (solo desktop; la libreria no lo soporta,
  // se resuelve con CSS en _admin.scss sobre .admin-shell--collapsed).
  const COLLAPSE_KEY = 'gb_admin_sidebar_collapsed'
  let collapsed_inicial = false
  try { collapsed_inicial = localStorage.getItem(COLLAPSE_KEY) === '1' } catch (e) { /* sin storage */ }
  const collapsed = ref(collapsed_inicial)
  watch(collapsed, (v) => { try { localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0') } catch (e) { /* sin storage */ } })
  provide('adminSidebarCollapsed', collapsed)

  const menuItems = computed(() => {
    let items = []
    for (let item of storeApp.opcionesMenu || []) {
      let icon = piToBi(item.icon)

      if (Array.isArray(item.sub_items) && item.sub_items.length > 0) {
        items.push({
          label: item.title,
          icon,
          children: item.sub_items.map((sub) => ({
            label: sub.title,
            to: sub.path,
            icon: piToBi(sub.icon)
          }))
        })
      } else if (item.component) {
        items.push({ label: item.title, to: item.path, icon })
      } else if (typeof item.onClick === 'function') {
        items.push({ label: item.title, icon, action: () => item.onClick(item) })
      }
    }
    return items
  })

  function handleResize(){
    if (window.innerWidth >= 768) {
      storeApp.sidebarVisible = true
    }
  }

  onMounted(() => {
    storeApp.sidebarVisible = window.innerWidth >= 768
    window.addEventListener('resize', handleResize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
  })
</script>

<style scoped>
.app-main {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  padding-top: var(--admin-topbar-h, 60px);
  overflow: hidden;
  transition: margin-left var(--gb-transition);
}
.app-main:focus { outline: none; }

.app-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--gb-space-5) var(--gb-space-4);
}

@media (min-width: 768px) {
  .app-content { padding: var(--gb-space-5) var(--gb-space-6); }
  .app-main--with-sidebar {
    margin-left: var(--admin-sidebar-w, 256px);
  }
  .admin-shell--collapsed .app-main--with-sidebar {
    margin-left: var(--admin-sidebar-w-collapsed, 72px);
  }
}
</style>
