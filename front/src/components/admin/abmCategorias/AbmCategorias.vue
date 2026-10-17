<template>
  <div class="mb-2">
    <Button label="Nueva" icon="pi-plus" @click="accion_crear" />
    <Button label="Editar" icon="pi-pencil" class="ms-1" :disabled="!seleccionado" @click="crud.editarFila" />
    <Button label="Borrar" icon="pi-trash" class="ms-1" :disabled="!seleccionado" @click="accion_borrar" />
    <Button label="Productos" icon="pi-list" class="ms-1" :disabled="!seleccionado" @click="productos" />
  </div>
  <CategoriasArbol ref="arbol_ref" @rowSelected="onRowSelected" />
</template>

<script setup>
  import { ref } from 'vue'
  import { buildCrud } from '@/helpers/tableEditorVue'
  import { add_one, put_one, delete_one, categorias_disponibles } from '@/api/admin/categorias'
  import ProductosCategoria from './ProductosCategoria.vue'
  import CategoriasArbol from './CategoriasArbol.vue'
  import { AppStore } from '@/stores/app'

  const storeApp = AppStore()

  const arbol_ref = ref()
  const seleccionado = ref(null)

  const nombre_elemento = { singular: 'Categoría', plural: 'Categorías', genero: 'F' }

  // Busqueda remota de categorias para el selector de categoria padre
  async function buscar_categorias(q) {
    const res = await categorias_disponibles({ search: q, limit: 20, exclude_id: seleccionado.value?.id || '' })
    return (res && res.stat && res.data?.rows) || []
  }

  // Campos del formulario de alta/edicion (cant_productos solo informativo en la tabla)
  function campos_form() {
    return [
      { field: 'name', headerName: 'Categoría', required: true, form_min_max: [1, 255] },
      { field: 'root_category_id', headerName: 'Categoría padre', form_type: 'autocomplete',
        display_field: 'root_category_name',
        autocomplete: {
          search: buscar_categorias,
          label: 'name',
          optionValue: 'id',
          placeholder: 'Buscar categoría padre (opcional)...',
        } },
    ]
  }

  const crud = buildCrud({
    api: { create: add_one, edit: put_one, delete: delete_one },
    campos: campos_form,
    singular: nombre_elemento.singular,
    gender: nombre_elemento.genero,
    storeApp,
    getTable: () => arbol_ref.value,
    getSelected: () => seleccionado.value,
  })

  const accion_crear = crud.toolbar.find(b => b.key === 'create')?.onClick
  const accion_borrar = crud.toolbar.find(b => b.key === 'delete')?.onClick

  function productos() {
    if (!seleccionado.value) {
      storeApp.mostrar_alerta('Es necesario seleccionar una categoría')
      return
    }
    storeApp.mostrar_modal(ProductosCategoria, 'Productos de: ' + seleccionado.value.name, {
      categoria: seleccionado.value,
      guardado: () => arbol_ref.value?.refresh(),
    })
  }

  function onRowSelected(sel) {
    seleccionado.value = sel
  }
</script>

<style scoped>
</style>
