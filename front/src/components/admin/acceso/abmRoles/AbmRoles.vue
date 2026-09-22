<template>
  <div class="row" v-if="abm_listo">
    <div class="col">

      <Button label="Vincular permiso" icon="pi-link" iconPos="right"
              class="ms-2"
              @click="vincular_permiso" />
      <Button label="Vincular usuario" icon="pi-link" iconPos="right"
              class="ms-2"
              @click="vincular_permiso" />
    </div>
  </div>

  <VteTableEditor
    ref="table_ref"
    id="roles"
    :api="vteApi"
    :config="vteConfig"
    @loaded="abm_listo = true"
    @rowSelected="onRowSelected"
    @rowDoubleClick="crud.editarFila"></VteTableEditor>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue';
  import { TableEditor as VteTableEditor } from 'vue-table-editor'
  import { buildVteList, buildCrud, toVteElementName } from '@/helpers/tableEditorVue'
  import { getAllRoles, crearRol, borrarRol, editarRol, vincularPermiso, getAllPermisos } from '@/api/admin/gestionRBAC'
  import { AppStore } from '@/stores/app'

  import  FormularioGenerico  from '@/components/genericos/FormularioGenerico'

  const storeApp = AppStore()
  const abm_listo = ref(false)

  const table_ref = ref()
  const campos = ref([])
  const seleccionado = ref(null)

  const nombre_elemento = { singular: 'Rol', plural: 'Roles', genero: 'M' }

  const vteApi = {
    list: buildVteList(getAllRoles, { onFieldsDef: (fd) => { campos.value = fd } }),
  }

  const crud = buildCrud({
    api: { create: crearRol, edit: editarRol, delete: borrarRol },
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

  const modelo_vinculo_permiso = ref({
    id_rol: '',
    id_permiso: '',
    nombre_rol: ''
  })

  function onRowSelected( sel ){
    seleccionado.value = sel
  }

  async function vincular_permiso(){
    if ( !seleccionado.value ){
      storeApp.mostrar_alerta( "Es necesario seleccionar un rol" )
      return
    }

    storeApp.loading = true
    let permisos_req = await getAllPermisos()
    if (permisos_req){
      storeApp.loading = false
      modelo_vinculo_permiso.value.id_rol     = seleccionado.value.id
      modelo_vinculo_permiso.value.nombre_rol = seleccionado.value.nombre

      storeApp.mostrar_modal( FormularioGenerico, 'Vincular Permiso',
        {
          "onSubmit": vincularPermiso,
          "guardado": permiso_vinculado,
          "modelo": modelo_vinculo_permiso.value,
          "campos": [
            { "field":"id_rol",     "headerName": "ID Rol", "visible_form": false },
            { "field":"nombre_rol", "headerName": "Rol" },
            { "field":"id_permiso", "headerName": "ID Permiso", "form_type": "select" }
          ],
          "selectData": { "id_permiso": { data: permisos_req.data.rows, label:"descripcion", placeholder:"Seleccionar permiso", optionValue:"id" } }
        } )
    } else {
      storeApp.loading = false
    }
  }

  function permiso_vinculado( res_peticion ){
    storeApp.mostrar_alerta( res_peticion.text )
  }

  onMounted(async ()=>{
    abm_listo.value = false
  })
</script>

<style scoped>
</style>
