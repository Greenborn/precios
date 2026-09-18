<template>
<nav class="navbar fixed-top navbar-expand-lg navbar-dark bg-primary site-navbar">
    <div class="container">
      <a class="navbar-brand" href="#/">Precios de Tandil</a>

      <div class="navbar-search d-none d-lg-flex" v-if="storeApp.ruta_actual.path == '/'">
        <div class="input-group">
          <input class="form-control" v-model="termino_busqueda" type="text" placeholder="Por ej: Manzana" aria-label="Buscar"
            @keyup.enter="buscar">
          <button class="btn btn-buscar" type="button" @click="buscar" aria-label="Buscar">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-search" viewBox="0 0 16 16">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zm-5.442 1.398a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="d-md-none me-2" v-if="storeApp.ruta_actual.path == '/carga_precio'">
        <button class="btn btn-cuenta" type="button" @click="agregar">Agregar</button>
      </div>

      <div class="d-md-none me-2" v-if="storeApp.ruta_actual.path == '/ofertas'">
        <button class="btn btn-cuenta" type="button" @click="filtrar">Filtrar</button>
      </div>

      <div class="navbar-filter d-flex me-2" v-if="storeApp.ruta_actual.path == '/categorias'">
        <input class="form-control" v-model="termino_filtro" type="text" placeholder="Filtrar" aria-label="Filtrar"
          @keyup="filtrar">
      </div>

      <button class="navbar-toggler ms-auto" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto align-items-center gap-lg-2">
          <li class="nav-item" v-for="(enlace) in enlaces" :key="enlace">
            <span class="nav-link" @click="click(enlace)"
                :class="{ active: storeApp.ruta_actual.path == enlace.path }">{{ enlace.title }}</span>
          </li>
          <li class="nav-item ms-lg-2" v-if="!isLogged">
            <button class="btn btn-cuenta" type="button" @click="irIngresar">Ingresar</button>
          </li>
          <li class="nav-item ms-lg-2" v-else>
            <button class="btn btn-cuenta" type="button" @click="irDashboard">
              <i class="bi bi-person-circle me-1"></i>{{ storeApp.userInfo?.name || 'Mi cuenta' }}
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div class="navbar-search-row d-lg-none" v-if="storeApp.ruta_actual.path == '/'">
      <div class="container py-2">
        <div class="input-group">
          <input class="form-control" v-model="termino_busqueda" type="text" placeholder="Por ej: Manzana" aria-label="Buscar"
            @keyup.enter="buscar">
          <button class="btn btn-buscar" type="button" @click="buscar" aria-label="Buscar">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-search" viewBox="0 0 16 16">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zm-5.442 1.398a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref, onMounted, watchEffect } from 'vue'

import { AppStore } from "../../stores/app"
import { useRoute } from 'vue-router'
import { router } from "../../router"
import { getToken, getUserInfo, setUserInfo } from "../../utils/auth"

const emit  = defineEmits(['buscar_evnt', 'agregar_evnt', 'filtrar_evnt'])
const storeApp = AppStore()
const route = useRoute()

const isLogged = !!getToken()

const termino_busqueda = ref('')
const termino_filtro = ref('')

const enlaces = ref([
    { path: '/', title: 'Buscador' },
    //{ path: '/categorias', title: 'Navegar por Categorías' },
    { path: '/ofertas', title: 'Ofertas' },
    //{ path: '/carga_precio', title: 'Carga de Precios' },
    //{ path: '/estadisticas', title: 'Estadísticas' }, // <--- ENLACE COMENTADO TEMPORALMENTE
    //{ path: '/calcula_trueque', title: 'Calcula Trueque' },
    { path: '/aporta', url: "https://cafecito.app/tandil_precios", title: 'Quiero Aportar' }
])

watchEffect(() => {
  document.body.classList.toggle('cls-search-row', route.path === '/')
})

function click( item ){
    if (item?.url){
      window.open(item.url, '_blank')
      return
    }

    storeApp.ruta_actual = item
    router.push(item.path)
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

function filtrar(){
  emit('filtrar_evnt', termino_filtro.value)
}

function buscar(){
  emit('buscar_evnt', termino_busqueda.value)
}

function agregar(){
  emit('agregar_evnt', true)
}

onMounted(()=>{
    storeApp.ruta_actual['path'] = route.path
})
</script>

<style>
.site-navbar {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.28);
  padding-block: 0.65rem;
  background-color: rgb(0, 38, 94);
}

.site-navbar .navbar-brand {
  font-weight: 700;
  letter-spacing: 0.3px;
}

.navbar-search {
  width: min(420px, 42vw);
  margin-inline: auto;
}

.navbar-filter {
  width: min(260px, 50vw);
}

.navbar-search-row {
  background-color: rgb(0, 38, 94);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-buscar {
  background-color: #20c997;
  border-color: #20c997;
  color: #fff;
}

.btn-buscar:hover,
.btn-buscar:focus {
  background-color: #1aa87f;
  border-color: #1aa87f;
  color: #fff;
}

.btn-cuenta {
  background-color: #20c997;
  border-color: #20c997;
  color: #fff;
  border-radius: 10px;
  font-weight: 600;
}

.btn-cuenta:hover,
.btn-cuenta:focus {
  background-color: #1aa87f;
  border-color: #1aa87f;
  color: #fff;
}

.site-navbar .nav-link {
  cursor: pointer;
  color: #cfcfcf;
  transition: color 0.15s ease;
}

.site-navbar .nav-link:hover {
  color: #fff;
}

.site-navbar .nav-link.active {
  color: #fff;
  box-shadow: inset 0 -2px 0 #20c997;
}

@media (max-width: 991.98px) {
  body.cls-search-row #buscador-cnt {
    margin-top: 8.5rem;
  }
}
</style>
