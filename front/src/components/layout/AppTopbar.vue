<template>
  <nav class="navbar navbar-dark bg-dark fixed-top app-topbar">
    <div class="container-fluid px-2 px-sm-3">
      <button
        class="navbar-toggler border-0 px-1"
        type="button"
        aria-label="Alternar menú"
        @click="storeApp.toggle_sidebar">
        <i class="bi bi-list fs-3" aria-hidden="true"></i>
      </button>

      <h2 class="m-0 app-topbar-title">{{ storeApp.ruta_actual?.title || '' }}</h2>

      <button
        v-if="storeApp.userInfo"
        class="btn btn-outline-light btn-sm border-0 px-2"
        title="Cerrar sesión"
        @click="cerrar_sesion">
        <i class="bi bi-power" aria-hidden="true"></i>
      </button>
      <span v-else class="px-2"></span>
    </div>
  </nav>
</template>

<script setup>
  import { AppStore } from "../../stores/app"
  import { logout } from "../../utils/auth"

  const storeApp = AppStore()

  function cerrar_sesion(){
    logout( storeApp )
  }
</script>

<style scoped>
.app-topbar {
  height: 56px;
  z-index: 1030;
}

.app-topbar-title {
  font-size: 1.15rem;
  font-weight: 500;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
