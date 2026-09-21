<template>
  <VteTableEditor
    ref="table_ref"
    :api="vteApi"
    :config="vteConfig"
    @rowSelected="onRowSelected"
    @rowDoubleClick="crud.editarFila"></VteTableEditor>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue'
  import { TableEditor as VteTableEditor } from 'vue-table-editor'
  import { buildVteList, buildCrud, toVteElementName } from '@/helpers/tableEditorVue'
  import { get_all, get_productos, add_one, put_one, delete_one } from '@/api/admin/aliasProductos'
  import { AppStore } from '@/stores/app'

  const storeApp = AppStore()

  const table_ref = ref()
  const seleccionado = ref(null)
  const productos = ref([])

  const nombre_elemento = { singular: 'Alias de producto', plural: 'Alias de productos', genero: 'M' }

  const vteApi = {
    list: buildVteList(get_all),
  }

  // Campos del formulario de alta/edicion (product_name solo informativo en la tabla)
  function campos_form() {
    return [
      { field: 'alias', headerName: 'Alias', required: true, form_min_max: [1, 512] },
      { field: 'product_id', headerName: 'Producto', form_type: 'select', required: true,
        rel_table: { rows: productos.value, descr_field: 'name', id_field: 'id' } },
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
    selectionMode: 'single',
    elementName: toVteElementName(nombre_elemento),
    buttons: { toolbar: crud.toolbar },
  }))

  function onRowSelected(sel) {
    seleccionado.value = sel
  }

  onMounted(async () => {
    storeApp.loading = true
    const res = await get_productos({ limit: 5000 })
    storeApp.loading = false
    if (res && res.stat) {
      productos.value = res.data?.rows || []
    }
  })
</script>

<style scoped>
</style>
