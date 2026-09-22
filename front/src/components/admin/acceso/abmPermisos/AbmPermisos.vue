<template>
  <VteTableEditor
    ref="table_ref"
    id="permisos"
    :api="vteApi"
    :config="vteConfig"
    @rowSelected="onRowSelected"
    @rowDoubleClick="crud.editarFila"></VteTableEditor>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue';
  import { TableEditor as VteTableEditor } from 'vue-table-editor'
  import { buildVteList, buildCrud, toVteElementName } from '@/helpers/tableEditorVue'
  import { getAllPermisos, crearPermiso, borrarPermiso, editarPermiso } from '@/api/admin/gestionRBAC'
  import { AppStore } from '@/stores/app'

  const storeApp = AppStore()

  const table_ref = ref()
  const campos = ref([])
  const seleccionado = ref(null)

  const nombre_elemento = { singular: 'Permiso', plural: 'Permisos', genero: 'M' }

  const vteApi = {
    list: buildVteList(getAllPermisos, { onFieldsDef: (fd) => { campos.value = fd } }),
  }

  const crud = buildCrud({
    api: { create: crearPermiso, edit: editarPermiso, delete: borrarPermiso },
    campos: () => campos.value,
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

  function onRowSelected( sel ){
    seleccionado.value = sel
  }

  onMounted(async ()=>{
  })
</script>

<style scoped>
</style>
