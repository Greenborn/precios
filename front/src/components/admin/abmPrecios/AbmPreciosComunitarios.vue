<template>
  <AbmShell subtitle="Precios cargados por la comunidad. Revisá y eliminá los incorrectos.">
    <CrudModulo
      recurso="precios"
      endpoint="/precios_comunitarios"
      :http="crudHttp"
      :permisos="permisos"
      titulo="Precios comunitarios"
      :elemento="{ singular: 'Precio comunitario', gender: 'M' }"
      :acciones="{ listar: true, crear: false, editar: false, eliminar: true }" />
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
