<template>
  <header class="pub-topbar" :class="{ 'is-scrolled': scrolled || menuAbierto }">
    <nav class="pub-container pub-topbar__inner" aria-label="Navegación principal">
      <a class="pub-topbar__brand" href="#/" aria-label="Precios de Tandil - inicio">
        <span class="pub-topbar__logo" aria-hidden="true"><Icon name="bi-tags-fill" /></span>
        <span>Precios de Tandil</span>
      </a>

      <form class="pub-topbar__search d-none d-lg-flex" v-if="storeApp.ruta_actual.path == '/' && scrolled"
            role="search" @submit.prevent="buscar">
        <Icon name="bi-search" class="pub-topbar__search-icon" />
        <input v-model="termino_busqueda" type="search" placeholder="Buscar producto…" aria-label="Buscar producto">
      </form>

      <div class="navbar-filter d-flex" v-if="storeApp.ruta_actual.path == '/categorias'">
        <input class="form-control form-control-sm" v-model="termino_filtro" type="search" placeholder="Filtrar" aria-label="Filtrar categorías"
          @keyup="filtrar">
      </div>

      <div class="d-flex align-items-center gap-2 ms-auto">
        <button v-if="storeApp.ruta_actual.path == '/carga_precio'" class="btn btn-sm btn-primary d-lg-none" type="button" @click="agregar">
          <Icon name="bi-plus-lg" /> Agregar
        </button>
        <button v-if="storeApp.ruta_actual.path == '/ofertas'" class="btn btn-sm btn-outline-primary d-lg-none" type="button" @click="abrir_filtros">
          <Icon name="bi-funnel" /> Filtrar
        </button>

        <button class="pub-topbar__toggler d-lg-none" type="button" :aria-expanded="menuAbierto ? 'true' : 'false'"
                aria-controls="pubNav" :aria-label="menuAbierto ? 'Cerrar menú' : 'Abrir menú'" @click="menuAbierto = !menuAbierto">
          <Icon :name="menuAbierto ? 'bi-x-lg' : 'bi-list'" size="1.4rem" />
        </button>
      </div>

      <div id="pubNav" class="pub-topbar__nav" :class="{ 'is-open': menuAbierto }">
        <ul class="pub-topbar__links">
          <li v-for="(enlace) in enlaces" :key="enlace.path">
            <a :href="enlace.url || ('#' + enlace.path)" class="pub-topbar__link" @click.prevent="click(enlace)"
               :class="{ active: storeApp.ruta_actual.path == enlace.path }"
               :aria-current="storeApp.ruta_actual.path == enlace.path ? 'page' : null"
               :target="enlace.url ? '_blank' : null" :rel="enlace.url ? 'noopener' : null">
              {{ enlace.title }}
              <Icon v-if="enlace.url" name="bi-box-arrow-up-right" class="small ms-1" />
            </a>
          </li>
        </ul>
        <div class="pub-topbar__account">
          <button v-if="!isLogged" class="btn btn-primary btn-sm" type="button" @click="irIngresar">
            <Icon name="bi-box-arrow-in-right" /> Ingresar
          </button>
          <div v-else ref="menu_ref" class="pub-topbar__user">
            <button type="button" class="btn btn-outline-primary btn-sm" aria-haspopup="menu"
                    :aria-expanded="String(menu_usuario)" @click="menu_usuario = !menu_usuario">
              <Icon name="bi-person-circle" class="me-1" />{{ nombre_usuario }}
            </button>
            <div v-if="menu_usuario" class="pub-topbar__dropdown" role="menu" @keydown.esc="menu_usuario = false">
              <div class="pub-topbar__dd-head">
                <div class="pub-topbar__dd-name">{{ nombre_usuario }}</div>
                <div v-if="storeApp.userInfo?.email" class="pub-topbar__dd-mail">{{ storeApp.userInfo.email }}</div>
              </div>
              <button type="button" class="pub-topbar__dd-item" role="menuitem" @click="irMiNegocio('negocio')">
                <Icon name="bi-shop-window" /> Mi negocio
              </button>
              <button type="button" class="pub-topbar__dd-item" role="menuitem" @click="irMiNegocio('precios')">
                <Icon name="bi-basket" /> Mis precios
              </button>
              <button v-if="esAdmin" type="button" class="pub-topbar__dd-item" role="menuitem" @click="irDashboard">
                <Icon name="bi-speedometer2" /> Panel de administración
              </button>
              <button type="button" class="pub-topbar__dd-item pub-topbar__dd-item--danger" role="menuitem" @click="cerrar_sesion">
                <Icon name="bi-box-arrow-right" /> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watchEffect, watch } from 'vue'

import { AppStore } from "../../stores/app"
import { useRoute } from 'vue-router'
import { router } from "../../router"
import { getToken, setToken, getUserInfo, setUserInfo, logout } from "../../utils/auth"

const emit  = defineEmits(['buscar_evnt', 'agregar_evnt', 'filtrar_evnt', 'filtros_evnt'])
const storeApp = AppStore()
const route = useRoute()

const isLogged = ref(!!getToken())

const termino_busqueda = ref('')
const termino_filtro = ref('')
const scrolled = ref(false)
const menuAbierto = ref(false)
const menu_usuario = ref(false)
const menu_ref = ref(null)

const nombre_usuario = computed(() => {
  const u = storeApp.userInfo || {}
  return [u.name, u.apellido].filter(Boolean).join(' ') || u.email || 'Mi cuenta'
})

function on_click_fuera(e){
  if (menu_usuario.value && menu_ref.value && !menu_ref.value.contains(e.target)) menu_usuario.value = false
}

function onScroll(){ scrolled.value = (window.scrollY || 0) > 8 }
function onKey(e){ if (e.key === 'Escape') menuAbierto.value = false }
watch(() => route.path, () => { menuAbierto.value = false })

const enlaces = ref([
    { path: '/', title: 'Buscador' },
    //{ path: '/categorias', title: 'Navegar por Categorías' },
    { path: '/ofertas', title: 'Ofertas' },
    { path: '/carga_precio', title: 'Carga de Precios' },
    //{ path: '/estadisticas', title: 'Estadísticas' }, // <--- ENLACE COMENTADO TEMPORALMENTE
    //{ path: '/calcula_trueque', title: 'Calcula Trueque' },
])

watchEffect(() => {
  document.body.classList.toggle('cls-search-row', route.path === '/')
})

function click( item ){
    if (item?.url){
      window.open(item.url, '_blank')
      return
    }

    menuAbierto.value = false
    storeApp.ruta_actual = item
    router.push(item.path)
}

const esAdmin = computed(() => (storeApp.userInfo?.rutas || []).length > 0)

function irMiNegocio(seccion){
  menu_usuario.value = false
  menuAbierto.value = false
  router.push({ path: '/mi-negocio', query: { seccion } })
}

function irIngresar(){
  router.push('/admin/login')
}

async function irDashboard(){
  const token = getToken()
  if (!token) return router.push('/admin/login')

  const userInfo = await getUserInfo('admin')
  if (userInfo && userInfo.stat) {
    setUserInfo('admin', storeApp, userInfo.data, router, token)
    router.push('/admin/dashboard')
  } else {
    router.push('/admin/login')
  }
}

function cerrar_sesion(){
  menu_usuario.value = false
  logout(storeApp)
}

function filtrar(){
  emit('filtrar_evnt', termino_filtro.value)
}

function abrir_filtros(){
  emit('filtros_evnt')
}

function buscar(){
  emit('buscar_evnt', termino_busqueda.value)
}

function agregar(){
  emit('agregar_evnt', true)
}

async function cargar_usuario(){
  // En páginas públicas la sesión no se hidrata sola: se carga para mostrar nombre y accesos
  if (!isLogged.value || storeApp.userInfo) return
  try {
    const info = await getUserInfo('admin')
    if (info && info.stat) setUserInfo('admin', storeApp, info.data, router, getToken())
    else { setToken(null); isLogged.value = false } // cookie vencida: se vuelve a mostrar "Ingresar"
  } catch (e) { /* error de red: se mantiene el menú mínimo */ }
}

onMounted(()=>{
    cargar_usuario()
    storeApp.ruta_actual['path'] = route.path
    document.body.classList.add('cls-public')
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('keydown', onKey)
    document.addEventListener('click', on_click_fuera)
})

onBeforeUnmount(()=>{
    document.body.classList.remove('cls-public')
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('keydown', onKey)
    document.removeEventListener('click', on_click_fuera)
})
</script>

<style lang="scss">
.pub-topbar {
  position: fixed; inset: 0 0 auto 0; z-index: 1030;
  background: var(--gb-surface);
  border-bottom: 1px solid transparent;
  transition: background var(--gb-transition), box-shadow var(--gb-transition), border-color var(--gb-transition);
  &.is-scrolled {
    background: color-mix(in srgb, var(--gb-surface) 82%, transparent);
    backdrop-filter: saturate(180%) blur(12px);
    -webkit-backdrop-filter: saturate(180%) blur(12px);
    border-bottom-color: var(--gb-border);
    box-shadow: var(--gb-shadow-sm);
  }
  &__inner { display: flex; align-items: center; flex-wrap: wrap; gap: var(--gb-space-3); min-height: 4rem; }
  &__brand {
    display: flex; align-items: center; gap: .5rem;
    font-weight: 700; font-size: 1.0625rem; color: var(--gb-heading); text-decoration: none;
    &:hover { color: var(--gb-heading); }
    &:focus-visible { outline: 0; box-shadow: var(--gb-focus-ring); border-radius: var(--gb-radius-sm); }
  }
  &__logo {
    width: 2rem; height: 2rem; border-radius: var(--gb-radius-sm);
    display: grid; place-items: center;
    background: var(--gb-primary); color: var(--gb-on-primary);
  }
  &__search {
    align-items: center; gap: .5rem;
    width: min(340px, 30vw);
    padding: 0 .75rem; height: 2.25rem;
    border-radius: var(--gb-radius-pill);
    background: var(--gb-surface-2); border: 1px solid var(--gb-border);
    &:focus-within { box-shadow: var(--gb-focus-ring); border-color: var(--gb-primary); }
    input { border: 0; outline: 0; background: transparent; flex: 1; min-width: 0; color: var(--gb-text); font-size: .9rem; }
  }
  &__search-icon { color: var(--gb-text-muted); }
  &__toggler {
    width: 2.5rem; height: 2.5rem; display: grid; place-items: center;
    border: 1px solid var(--gb-border); border-radius: var(--gb-radius-sm);
    background: var(--gb-surface); color: var(--gb-heading);
    &:focus-visible { outline: 0; box-shadow: var(--gb-focus-ring); }
  }
  &__nav {
    display: flex; align-items: center; gap: var(--gb-space-4);
    @media (max-width: 991.98px) {
      display: none; flex-basis: 100%; flex-direction: column; align-items: stretch;
      padding: var(--gb-space-2) 0 var(--gb-space-4);
      &.is-open { display: flex; }
    }
  }
  &__links {
    list-style: none; margin: 0; padding: 0; display: flex; gap: .25rem;
    @media (max-width: 991.98px) { flex-direction: column; }
  }
  &__link {
    display: block; padding: .5rem .75rem; border-radius: var(--gb-radius-sm);
    color: var(--gb-text-muted); font-weight: 500; text-decoration: none;
    transition: color var(--gb-transition-fast), background var(--gb-transition-fast);
    &:hover { color: var(--gb-heading); background: var(--gb-surface-2); }
    &:focus-visible { outline: 0; box-shadow: var(--gb-focus-ring); }
    &.active { color: var(--gb-primary); background: var(--gb-primary-soft); font-weight: 600; }
  }
  &__account { display: flex; gap: .5rem; align-items: center;
    @media (max-width: 991.98px) { padding-top: var(--gb-space-3); border-top: 1px solid var(--gb-border); } }
  &__user { position: relative; }
  &__dropdown {
    position: absolute; right: 0; top: calc(100% + 8px); z-index: 1040;
    min-width: 240px; padding: var(--gb-space-2);
    background: var(--gb-surface); border: 1px solid var(--gb-border);
    border-radius: var(--gb-radius); box-shadow: var(--gb-shadow-lg);
  }
  &__dd-head { padding: var(--gb-space-2) var(--gb-space-3) var(--gb-space-3); border-bottom: 1px solid var(--gb-border); margin-bottom: var(--gb-space-2); }
  &__dd-name { font-weight: 600; color: var(--gb-heading); }
  &__dd-mail { font-size: .8125rem; color: var(--gb-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__dd-item {
    display: flex; align-items: center; gap: var(--gb-space-2); width: 100%;
    padding: var(--gb-space-2) var(--gb-space-3); border: 0; background: transparent;
    border-radius: var(--gb-radius-sm); color: var(--gb-text); font-size: .9rem; text-align: left;
    &:hover, &:focus-visible { background: var(--gb-surface-2); outline: none; }
    &--danger { color: var(--gb-danger); &:hover { background: var(--gb-danger-soft); } }
  }
  @media (min-width: 992px) { &__nav { margin-left: auto; } }
}
.navbar-filter { width: min(240px, 40vw); }
</style>
