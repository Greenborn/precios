<template>
  <AbmShell subtitle="Locales de los comercios. Desde acá se controla si cada local figura públicamente.">
    <VteTableEditor
      ref="table_ref"
      id="locales"
      :api="vteApi"
      :config="vteConfig"
      @rowSelected="onRowSelected"
      @rowDoubleClick="crud.editarFila"></VteTableEditor>
  </AbmShell>
</template>

<script setup>
  import AbmShell from '@/components/admin/shared/AbmShell.vue'
  import { ref, computed } from 'vue'
  import { TableEditor as VteTableEditor } from '@greenborn/vue-table-editor'
  import { buildVteList, buildCrud, toVteElementName } from '@/helpers/tableEditorVue'
  import { get_all, put_one } from '@/api/admin/locales'
  import { AppStore } from '@/stores/app'

  const storeApp = AppStore()

  const table_ref = ref()
  const seleccionado = ref(null)

  const nombre_elemento = { singular: 'Local', plural: 'Locales', genero: 'M' }

  const vteApi = {
    list: buildVteList(get_all),
  }

  // Solo se edita el flag publicado; el resto de los datos del local es de lectura
  function campos_form() {
    return [
      { field: 'publicado', headerName: 'Publicado', form_type: 'checkbox' },
    ]
  }

  const crud = buildCrud({
    api: { edit: put_one },
    campos: campos_form,
    singular: nombre_elemento.singular,
    gender: nombre_elemento.genero,
    storeApp,
    getTable: () => table_ref.value,
    getSelected: () => seleccionado.value,
  })

  const vteConfig = computed(() => ({
    lazy: true,
    showFilterRow: true,
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
