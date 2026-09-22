<template>
  <VteTableEditor
    ref="table_ref"
    id="rutas"
    :api="vteApi"
    :config="vteConfig"
    @loaded="abm_listo = true"
    @rowDoubleClick="crud.editarFila"></VteTableEditor>

</template>

<script setup>
  import { ref, computed, onMounted } from 'vue';
  import { TableEditor as VteTableEditor } from 'vue-table-editor'
  import { buildVteList, buildCrud, toVteElementName } from '@/helpers/tableEditorVue'
  import { getAllRutas, crearRuta, borrarRuta, editarRuta } from '@/api/admin/gestionRBAC'
  import { AppStore } from '@/stores/app'

  const storeApp = AppStore()
  const abm_listo = ref(false)

  const table_ref = ref()
  const campos = ref([])
  const seleccionado = ref(null)

  const nombre_elemento = { singular: 'Ruta', plural: 'Rutas', genero: 'F' }

  const vteApi = {
    list: buildVteList(getAllRutas, { onFieldsDef: (fd) => { campos.value = fd } }),
  }

  const crud = buildCrud({
    api: { create: crearRuta, edit: editarRuta, delete: borrarRuta },
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

  onMounted(async ()=>{
    abm_listo.value = false
  })
</script>

<style scoped>
</style>
