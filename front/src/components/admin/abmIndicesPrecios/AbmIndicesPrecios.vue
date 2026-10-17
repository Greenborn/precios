<template>
  <VteTableEditor
    ref="table_ref"
    id="indices_precios"
    :api="vteApi"
    :config="vteConfig"
    @rowSelected="onRowSelected"
    @rowDoubleClick="crud.editarFila"></VteTableEditor>
</template>

<script setup>
  import { ref, computed } from 'vue'
  import { TableEditor as VteTableEditor } from 'vue-table-editor'
  import { buildVteList, buildCrud, toVteElementName } from '@/helpers/tableEditorVue'
  import { get_all, alias_categoria_disponibles, add_one, put_one, delete_one } from '@/api/admin/indicesPrecios'
  import { AppStore } from '@/stores/app'

  const storeApp = AppStore()

  const table_ref = ref()
  const seleccionado = ref(null)

  const nombre_elemento = { singular: 'Índice de precios', plural: 'Índices de precios', genero: 'M' }

  const vteApi = {
    list: buildVteList(get_all),
  }

  // Busqueda remota de alias de categoria para el selector del formulario
  async function buscar_alias_categoria(q) {
    const res = await alias_categoria_disponibles({ search: q, limit: 20 })
    return (res && res.stat && res.data?.rows) || []
  }

  // Campos del formulario de alta/edicion. Por el momento el indice solo se
  // define por su nombre y el alias de categoria que lo origina; la relacion
  // con productos puntuales se incorporara en una etapa posterior.
  function campos_form() {
    return [
      { field: 'cod_indice', headerName: 'Nombre del índice', required: true, form_min_max: [1, 255] },
      { field: 'category_alias_id', headerName: 'Alias de categoría', form_type: 'autocomplete', required: true,
        display_field: 'alias_categoria_display',
        autocomplete: {
          search: buscar_alias_categoria,
          label: 'display',
          optionValue: 'id',
          placeholder: 'Buscar alias de categoría...',
        } },
    ]
  }

  const crud = buildCrud({
    api: { create: add_one, edit: put_one, delete: delete_one },
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
