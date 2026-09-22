<template>
  <VteTableEditor
    ref="table_ref"
    id="usuarios"
    :api="vteApi"
    :config="vteConfig"
    @rowSelected="onRowSelected"
    @rowDoubleClick="crud.editarFila"></VteTableEditor>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue'
  import { TableEditor as VteTableEditor } from 'vue-table-editor'
  import { buildVteList, buildCrud, toVteElementName } from '@/helpers/tableEditorVue'
  import { get_all, add_one, put_one, delete_one } from '@/api/admin/gestionUsuarios'
  import { getAllRoles } from '@/api/admin/gestionRBAC'
  import { AppStore } from "@/stores/app"

  const storeApp = AppStore()

  const table_ref = ref()
  const campos = ref([])
  const campos_extras = ref({ create: [], edit: [] })
  const listado_roles = ref([])
  const seleccionado = ref(null)

  const nombre_elemento = { singular: 'Usuario', plural: 'Usuarios', genero: 'M' }

  const vteApi = {
    list: buildVteList(get_all, { onFieldsDef: (fd) => { campos.value = fd } }),
  }

  const crud = buildCrud({
    api: { create: add_one, edit: put_one, delete: delete_one },
    campos: () => campos.value,
    campos_extras: () => campos_extras.value,
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

  onMounted(async ()=>{
    storeApp.loading = true
    let peticion_roles = await getAllRoles()
    if (peticion_roles){
      listado_roles.value = peticion_roles.data
      let config_campo_roles = {
        field: 'roles', headerName: 'Roles', form_type: 'multi_select',
        rel_table: {
          'rows': listado_roles.value.rows,
          'descr_field': 'nombre',
          'id_field': 'id',
          'headerName': 'Rol'
        }
      }
      campos_extras.value.create.push(config_campo_roles)
      campos_extras.value.edit.push(config_campo_roles)
      storeApp.loading = false
    } else {
      storeApp.loading = false
      storeApp.mostrar_alerta( 'No se pudo cargar listado de roles, por favor reintente.' )
    }
  })
</script>

<style scoped>
</style>
