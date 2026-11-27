<template>
  <AbmShell subtitle="Precios con fecha desde ayer cargados en la caché en memoria del servidor. Solo lectura.">
    <CrudModulo
      recurso="precios_hoy"
      endpoint="/precios_hoy"
      :http="crudHttp"
      :permisos="permisos"
      titulo="Precios de hoy"
      :elemento="{ singular: 'Precio de hoy', gender: 'M' }"
      :acciones="{ listar: true, crear: false, editar: false, eliminar: false }" />
  </AbmShell>
</template>

<script setup>
  import { computed } from 'vue'
  import AbmShell from '@/components/admin/shared/AbmShell.vue'
  import { CrudModulo } from '@greenborn/vue-greenborn-crud'
  import '@greenborn/vue-greenborn-crud/style.css'
  import { crudHttp } from '@/helpers/crudHttp'
  import { AppStore } from '@/stores/app'

  const storeApp = AppStore()

  // Permisos del usuario logueado (vienen de /user/info)
  const permisos = computed(() => storeApp.userInfo?.permisos || [])
</script>

<style scoped>
</style>
