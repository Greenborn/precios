<template>
  <div class="row">
    <div class="col-12 col-sm-10 col-md-9 col-lg-6 p-5">
      <FormularioGenerico ref="ref_formulario" :parametros="config_formulario"></FormularioGenerico>
    </div>
  </div>
</template>

<script setup>
  import { ref, onMounted } from 'vue';
  import  FormularioGenerico  from '@/components/genericos/FormularioGenerico'
  import { guardarConfig } from '@/api/admin/userAdmin'
  import { getUserInfo } from '@/utils/auth'
  import { AppStore } from '@/stores/app'

  const storeApp = AppStore()

  const formulario_config = ref({
    'id': '',
    'name': '',
    'apellido': '',
    'email': '',
    'pass': '********',
    'pass_repeat': '********',
  })

  const ref_formulario = ref(null)

  const campos_form_config = ref([
    { field: 'id',          visible_form: false },
    { field: 'name',        headerName: 'Nombre', required: true, form_min_max: [2, 64]  },
    { field: 'apellido',    headerName: 'Apellido', form_min_max: [2, 128] },
    { field: "email",       headerName: "Email",  required: true, form_min_max: [2, 255] },
    { field: "pass",        headerName: "Contraseña", required: true,  form_min_max: [2, 128], form_type: 'password' },
    { field: "pass_repeat", headerName: 'Repetir contraseña', required: true, form_type: 'password'  },
  ])

  const config_formulario = ref({
    "onSubmit": guardarConfig, 
    "guardado": configuracion_guardada, 
    "modelo": formulario_config.value,
    "campos": campos_form_config.value,
    "buttons": { 'cancel': { 'visible':false } },
  })

  async function configuracion_guardada( resp ){
    storeApp.mostrar_alerta( resp.text )
    let user_info = await getUserInfo('admin')
    if (user_info){
      storeApp.userInfo = user_info.data
      actualizar_modelo()
    }
  }

  function actualizar_modelo(){
    formulario_config.value.name     = storeApp.userInfo.name
    formulario_config.value.apellido = storeApp.userInfo.apellido || ''
    formulario_config.value.email    = storeApp.userInfo.email
    formulario_config.value.id       = storeApp.userInfo.id
    ref_formulario.value.actualizar_modelo()
  }

  onMounted(async ()=>{
    actualizar_modelo()
  })
</script>

<style scoped>

</style>