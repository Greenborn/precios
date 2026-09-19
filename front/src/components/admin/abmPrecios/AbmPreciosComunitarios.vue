<template>
  <VteTableEditor
    ref="table_ref"
    :api="vteApi"
    :config="vteConfig"
    @rowSelected="onRowSelected"></VteTableEditor>
</template>

<script setup>
  import { ref, computed } from 'vue'
  import { TableEditor as VteTableEditor } from 'vue-table-editor'
  import { buildVteList, buildCrud, toVteElementName } from '@/helpers/tableEditorVue'
  import { get_all, delete_one } from '@/api/admin/preciosComunitarios'
  import { AppStore } from "@/stores/app"

  const storeApp = AppStore()

  const table_ref = ref()
  const seleccionado = ref(null)

  const nombre_elemento = { singular: 'Precio comunitario', plural: 'Precios comunitarios', genero: 'M' }

  const vteApi = {
    list: buildVteList(get_all),
  }

  const crud = buildCrud({
    api: { delete: delete_one },
    singular: nombre_elemento.singular,
    gender: nombre_elemento.genero,
    storeApp,
    getTable: () => table_ref.value,
    getSelected: () => seleccionado.value,
  })

  const vteConfig = computed(() => ({
    lazy: true,
    selectionMode: 'single',
    elementName: toVteElementName(nombre_elemento),
    buttons: { toolbar: crud.toolbar },
  }))

  function onRowSelected(sel) {
    seleccionado.value = sel
  }
</script>

<style scoped>
</style>
