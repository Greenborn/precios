<template>
  <header class="app-topbar">
    <button
      class="app-topbar__icon-btn"
      type="button"
      :aria-label="esDesktop ? (collapsed ? 'Expandir menú' : 'Colapsar menú') : 'Alternar menú'"
      :aria-expanded="esDesktop ? String(!collapsed) : String(!!storeApp.sidebarVisible)"
      @click="toggle_menu">
      <Icon :name="esDesktop && collapsed ? 'bi-layout-sidebar-inset' : 'bi-list'" size="1.35rem" />
    </button>

    <router-link to="/admin/dashboard" class="app-topbar__brand" aria-label="Ir al panel">
      <span class="app-topbar__logo" aria-hidden="true"><Icon name="bi-tags-fill" /></span>
      <span class="app-topbar__brand-text d-none d-sm-inline">Precios <small>Admin</small></span>
    </router-link>

    <nav class="app-topbar__crumbs d-none d-md-flex" aria-label="breadcrumb">
      <ol>
        <li v-for="(b, i) in breadcrumbs" :key="i" :aria-current="i === breadcrumbs.length - 1 ? 'page' : null">
          <router-link v-if="b.to && i < breadcrumbs.length - 1" :to="b.to">{{ b.label }}</router-link>
          <span v-else>{{ b.label }}</span>
          <Icon v-if="i < breadcrumbs.length - 1" name="bi-chevron-right" class="app-topbar__sep" />
        </li>
      </ol>
    </nav>
    <h2 class="app-topbar__title d-md-none">{{ storeApp.ruta_actual?.title || '' }}</h2>

    <div v-if="storeApp.userInfo" ref="menu_ref" class="app-topbar__user">
      <button
        type="button"
        class="app-topbar__user-btn"
        aria-haspopup="menu"
        :aria-expanded="String(menu_abierto)"
        @click="menu_abierto = !menu_abierto">
        <span class="app-topbar__avatar" aria-hidden="true">{{ iniciales }}</span>
        <span class="app-topbar__user-name d-none d-lg-inline">{{ nombre }}</span>
        <Icon name="bi-chevron-down" class="d-none d-lg-inline app-topbar__caret" />
      </button>
      <transition name="app-topbar-dd">
        <div v-if="menu_abierto" class="app-topbar__dropdown" role="menu" @keydown.esc="menu_abierto = false">
          <div class="app-topbar__dd-head">
            <div class="app-topbar__dd-name">{{ nombre }}</div>
            <div v-if="storeApp.userInfo.email" class="app-topbar__dd-mail gb-truncate">{{ storeApp.userInfo.email }}</div>
          </div>
          <router-link v-if="ruta_cuenta" :to="ruta_cuenta" class="app-topbar__dd-item" role="menuitem" @click="menu_abierto = false">
            <Icon name="bi-person-gear" /> Mi cuenta
          </router-link>
          <router-link to="/mi-negocio" class="app-topbar__dd-item" role="menuitem" @click="menu_abierto = false">
            <Icon name="bi-shop-window" /> Mi negocio
          </router-link>
          <button type="button" class="app-topbar__dd-item app-topbar__dd-item--danger" role="menuitem" @click="cerrar_sesion">
            <Icon name="bi-box-arrow-right" /> Cerrar sesión
          </button>
        </div>
      </transition>
    </div>
    <span v-else class="px-2"></span>
  </header>
</template>

<script setup>
  import { ref, computed, inject, onMounted, onBeforeUnmount } from 'vue'
  import { AppStore } from "../../stores/app"
  import { logout } from "../../utils/auth"
  import { useAdminBreadcrumbs } from '@/components/admin/shared/useAdminBreadcrumbs'

  const storeApp = AppStore()
  const breadcrumbs = useAdminBreadcrumbs()
  const collapsed = inject('adminSidebarCollapsed', ref(false))

  const ancho = ref(window.innerWidth)
  const esDesktop = computed(() => ancho.value >= 768)
  const menu_abierto = ref(false)
  const menu_ref = ref(null)

  const nombre = computed(() => {
    const u = storeApp.userInfo || {}
    return [u.name, u.apellido].filter(Boolean).join(' ') || u.email || 'Usuario'
  })
  const iniciales = computed(() => {
    const u = storeApp.userInfo || {}
    const s = ((u.name || '').charAt(0) + (u.apellido || '').charAt(0)) || (u.email || '?').charAt(0)
    return s.toUpperCase()
  })
  const ruta_cuenta = computed(() => {
    const item = (storeApp.opcionesMenu || []).find(m => m.component === 'ConfigCuenta')
    return item ? item.path : ''
  })

  function toggle_menu() {
    if (esDesktop.value) {
      if (!storeApp.sidebarVisible) storeApp.sidebarVisible = true
      else collapsed.value = !collapsed.value
    } else {
      storeApp.toggle_sidebar()
    }
  }

  function cerrar_sesion(){
    menu_abierto.value = false
    logout( storeApp )
  }

  function on_click_fuera(e) {
    if (menu_abierto.value && menu_ref.value && !menu_ref.value.contains(e.target)) menu_abierto.value = false
  }
  function on_key(e) { if (e.key === 'Escape') menu_abierto.value = false }
  function on_resize() { ancho.value = window.innerWidth }

  onMounted(() => {
    document.addEventListener('click', on_click_fuera)
    document.addEventListener('keydown', on_key)
    window.addEventListener('resize', on_resize)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('click', on_click_fuera)
    document.removeEventListener('keydown', on_key)
    window.removeEventListener('resize', on_resize)
  })
</script>

<style scoped>
.app-topbar {
  position: fixed;
  inset: 0 0 auto 0;
  height: var(--admin-topbar-h, 60px);
  z-index: 1030;
  display: flex;
  align-items: center;
  gap: var(--gb-space-3);
  padding: 0 var(--gb-space-3);
  background: var(--gb-surface);
  border-bottom: 1px solid var(--gb-border);
  box-shadow: var(--gb-shadow-sm);
}

.app-topbar__icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px;
  border: 0; border-radius: var(--gb-radius-sm);
  background: transparent; color: var(--gb-text);
  transition: background-color var(--gb-transition-fast);
}
.app-topbar__icon-btn:hover { background: var(--gb-surface-2); }
.app-topbar__icon-btn:focus-visible,
.app-topbar__user-btn:focus-visible { outline: none; box-shadow: var(--gb-focus-ring); }

.app-topbar__brand {
  display: inline-flex; align-items: center; gap: var(--gb-space-2);
  text-decoration: none; color: var(--gb-heading); font-weight: 700;
  white-space: nowrap;
}
.app-topbar__brand small { color: var(--gb-text-muted); font-weight: 500; }
.app-topbar__logo {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: var(--gb-radius-sm);
  background: var(--gb-primary); color: var(--gb-on-primary);
}

.app-topbar__crumbs { flex: 1; min-width: 0; padding-left: var(--gb-space-3); border-left: 1px solid var(--gb-border); }
.app-topbar__crumbs ol { display: flex; align-items: center; gap: 0.35rem; list-style: none; margin: 0; padding: 0; font-size: 0.875rem; color: var(--gb-text-muted); min-width: 0; }
.app-topbar__crumbs li { display: inline-flex; align-items: center; gap: 0.35rem; white-space: nowrap; }
.app-topbar__crumbs a { color: var(--gb-text-muted); text-decoration: none; }
.app-topbar__crumbs a:hover { color: var(--gb-primary); }
.app-topbar__crumbs li[aria-current] { color: var(--gb-heading); font-weight: 600; }
.app-topbar__sep { font-size: 0.7rem; opacity: 0.6; }

.app-topbar__title {
  flex: 1; min-width: 0; margin: 0;
  font-size: 1rem; font-weight: 600; color: var(--gb-heading);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.app-topbar__user { position: relative; margin-left: auto; }
.app-topbar__user-btn {
  display: inline-flex; align-items: center; gap: var(--gb-space-2);
  border: 0; background: transparent; padding: 4px 8px 4px 4px;
  border-radius: var(--gb-radius-pill); color: var(--gb-text);
  transition: background-color var(--gb-transition-fast);
}
.app-topbar__user-btn:hover { background: var(--gb-surface-2); }
.app-topbar__avatar {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--gb-primary-soft); color: var(--gb-primary);
  font-weight: 700; font-size: 0.85rem;
}
.app-topbar__user-name { font-weight: 500; font-size: 0.9rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.app-topbar__caret { font-size: 0.7rem; color: var(--gb-text-muted); }

.app-topbar__dropdown {
  position: absolute; right: 0; top: calc(100% + 8px);
  min-width: 240px; padding: var(--gb-space-2);
  background: var(--gb-surface); border: 1px solid var(--gb-border);
  border-radius: var(--gb-radius); box-shadow: var(--gb-shadow-lg);
}
.app-topbar__dd-head { padding: var(--gb-space-2) var(--gb-space-3) var(--gb-space-3); border-bottom: 1px solid var(--gb-border); margin-bottom: var(--gb-space-2); }
.app-topbar__dd-name { font-weight: 600; color: var(--gb-heading); }
.app-topbar__dd-mail { font-size: 0.8125rem; color: var(--gb-text-muted); }
.app-topbar__dd-item {
  display: flex; align-items: center; gap: var(--gb-space-2); width: 100%;
  padding: var(--gb-space-2) var(--gb-space-3); border: 0; background: transparent;
  border-radius: var(--gb-radius-sm); color: var(--gb-text); text-decoration: none; font-size: 0.9rem; text-align: left;
}
.app-topbar__dd-item:hover, .app-topbar__dd-item:focus-visible { background: var(--gb-surface-2); outline: none; }
.app-topbar__dd-item--danger { color: var(--gb-danger); }
.app-topbar__dd-item--danger:hover { background: var(--gb-danger-soft); }

.app-topbar-dd-enter-active, .app-topbar-dd-leave-active { transition: opacity var(--gb-transition-fast), transform var(--gb-transition-fast); }
.app-topbar-dd-enter-from, .app-topbar-dd-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
