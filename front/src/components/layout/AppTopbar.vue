<template>
  <div class="container-topbar">
    <Button icon="pi-bars" class="btn-topbar-toggle" @click="storeApp.toggle_sidebar" />
    <h2 class="m-0 title">{{storeApp.ruta_actual.title}}</h2>

    <Button v-if="storeApp.userInfo" icon="pi-power-off" class="btn-topbar-logout ms-auto" title="Cerrar sesión" @click="cerrar_sesion" />
  </div>
</template>

<script setup >
  import { AppStore } from "../../stores/app"
  import { logout } from "../../utils/auth"

  const storeApp = AppStore()

  function cerrar_sesion(){
    logout( storeApp )
  }
</script>

<style lang="scss" scoped>
.container-topbar{
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 4rem;
  padding: 0.9rem 1.5rem;
  background-color: #FFF;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
}

.title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn.btn-topbar-toggle {
  background-color: #fff;
  border-color: #d1d5db;
  color: #374151;
  border-radius: 10px;
  padding: 0.45rem 0.7rem;
}

.btn.btn-topbar-toggle:hover,
.btn.btn-topbar-toggle:focus {
  background-color: #f3f4f6;
  border-color: #9ca3af;
  color: #111827;
}

.btn.btn-topbar-logout {
  background-color: #fff;
  border-color: #d1d5db;
  color: #dc2626;
  border-radius: 10px;
  padding: 0.45rem 0.7rem;
}

.btn.btn-topbar-logout:hover,
.btn.btn-topbar-logout:focus {
  background-color: #fef2f2;
  border-color: #fca5a5;
  color: #b91c1c;
}

@media (max-width: 576px) {
  .container-topbar {
    padding: 0.75rem 1rem;
  }

  .title {
    font-size: 1.25rem;
  }
}
</style>
