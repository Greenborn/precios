<template>
  <div>
    <AppTopbar />

    <SideMenu
      :items="menuItems"
      :visible="storeApp.sidebarVisible"
      title="Menú"
      @close="storeApp.sidebarVisible = false">
      <template #footer>v{{ version }}</template>
    </SideMenu>

    <main class="app-main" :class="{ 'app-main--with-sidebar': storeApp.sidebarVisible }">
      <div class="app-content">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
  import { computed, onMounted, onBeforeUnmount } from 'vue'
  import { provide } from 'vue'
  import { version } from '../../../package.json'
  import SideMenu, { HAS_PERMISSION_KEY } from '@greenborn/vue-side-menu'
  import AppTopbar from './AppTopbar.vue'
  import { AppStore } from "../../stores/app"
  import { piToBi } from '@/utils/icons'
  import { logout } from '@/utils/auth'

  const storeApp = AppStore()

  provide(HAS_PERMISSION_KEY, () => true)

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
  padding-top: 56px;
  overflow: hidden;
}

.app-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
}

@media (min-width: 768px) {
  .app-main--with-sidebar {
    margin-left: 250px;
  }
}
</style>
