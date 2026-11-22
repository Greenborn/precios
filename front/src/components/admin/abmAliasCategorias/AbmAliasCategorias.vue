<template>
  <AbmShell subtitle="Nombres alternativos que se mapean a categorías del catálogo.">
    <CrudModulo
      recurso="alias_categorias"
      endpoint="/alias_categorias"
      :http="crudHttp"
      :permisos="permisos"
      titulo="Alias de categorías"
      :elemento="{ singular: 'Alias de categoría', gender: 'M' }" />
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
