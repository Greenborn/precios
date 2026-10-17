<template>
  <VteTableEditor
    ref="table_ref"
    id="alias_categorias"
    :api="vteApi"
    :config="vteConfig"
    @rowSelected="onRowSelected"
    @rowDoubleClick="crud.editarFila"></VteTableEditor>
</template>

<script setup>
  import { ref, computed } from 'vue'
  import { TableEditor as VteTableEditor } from 'vue-table-editor'
  import { buildVteList, buildCrud, toVteElementName } from '@/helpers/tableEditorVue'
  import { get_all, categorias_disponibles, add_one, put_one, delete_one } from '@/api/admin/aliasCategorias'
  import { AppStore } from '@/stores/app'

  const storeApp = AppStore()

  const table_ref = ref()
  const seleccionado = ref(null)

  const nombre_elemento = { singular: 'Alias de categoría', plural: 'Alias de categorías', genero: 'M' }

  const vteApi = {
    list: buildVteList(get_all),
  }

  // Busqueda remota de categorias para el selector del formulario
  async function buscar_categorias(q) {
    const res = await categorias_disponibles({ search: q, limit: 20 })
    return (res && res.stat && res.data?.rows) || []
  }

  // Campos del formulario de alta/edicion
  function campos_form() {
    return [
      { field: 'category_id', headerName: 'Categoría', form_type: 'autocomplete', required: true,
        display_field: 'category_name',
        autocomplete: {
          search: buscar_categorias,
          label: 'name',
          optionValue: 'id',
          placeholder: 'Buscar categoría por nombre...',
        } },
      { field: 'alias', headerName: 'Alias', required: true, form_min_max: [1, 255] },
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
