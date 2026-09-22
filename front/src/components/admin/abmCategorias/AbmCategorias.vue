<template>
  <VteTableEditor
    ref="table_ref"
    id="categorias"
    :api="vteApi"
    :config="vteConfig"
    @rowSelected="onRowSelected"
    @rowDoubleClick="crud.editarFila"></VteTableEditor>
</template>

<script setup>
  import { ref, computed } from 'vue'
  import { TableEditor as VteTableEditor } from 'vue-table-editor'
  import { buildVteList, buildCrud, toVteElementName } from '@/helpers/tableEditorVue'
  import { get_all, add_one, put_one, delete_one } from '@/api/admin/categorias'
  import ProductosCategoria from './ProductosCategoria.vue'
  import { AppStore } from '@/stores/app'

  const storeApp = AppStore()

  const table_ref = ref()
  const seleccionado = ref(null)

  const nombre_elemento = { singular: 'Categoría', plural: 'Categorías', genero: 'F' }

  const vteApi = {
    list: buildVteList(get_all),
  }

  // Campos del formulario de alta/edicion (cant_productos solo informativo en la tabla)
  function campos_form() {
    return [
      { field: 'name', headerName: 'Categoría', required: true, form_min_max: [1, 255] },
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

  function productos() {
    if (!seleccionado.value) {
      storeApp.mostrar_alerta('Es necesario seleccionar una categoría')
      return
    }
    storeApp.mostrar_modal(ProductosCategoria, 'Productos de: ' + seleccionado.value.name, {
      categoria: seleccionado.value,
      guardado: () => {
        const t = table_ref.value
        if (t) t.refresh()
      },
    })
  }

  const vteConfig = computed(() => ({
    lazy: true,
    showFilterRow: true,
    selectionMode: 'single',
    elementName: toVteElementName(nombre_elemento),
    buttons: { toolbar: [...crud.toolbar, { key: 'productos', icon: 'list', severity: 'info', label: 'Productos', isDisabled: () => !seleccionado.value, onClick: productos }] },
  }))

  function onRowSelected(sel) {
    seleccionado.value = sel
  }
</script>

<style scoped>
</style>
