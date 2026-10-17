<template>
  <div class="row">

    <div class="col-12" v-for="(campo) in campos" :key="campo">
      <div class="row" v-if="campo.visible_form !== false && campo.hide !== true">
        <div class="col-3 label-cont">
          <label>{{campo.headerName}}</label>
        </div>

        <div class="col">
          <InputText 
              v-if = "(campo.form_type == undefined || (campo.form_type == 'text' || campo.form_type == 'email' || campo.form_type == 'number') )"
              :disabled="campo.editable === false"
              :type="campo.form_type" class="w-100" v-model="modelo[campo.field]" />
          
          <Editor 
            v-if="campo.form_type == 'text-editor'"
            v-model="modelo[campo.field]" editorStyle="height: 320px"/>
          
          <DatePicker 
            v-if="campo.form_type == 'date'"
            dateFormat="dd.mm.yy"
            v-model="modelo[campo.field]" />

          <div v-if="campo.form_type == 'array'">
            <span v-for="(elemento) in modelo[campo.field]" :key="elemento">
              {{elemento}};
            </span>
          </div>

          <div v-if="campo.form_type == 'file_upload'">
            <input :id="campo.field" :name="campo.field" type="file" class="file form-control" data-show-preview="false" 
                :data-msg-placeholder="campo.headerName">
          </div>

          <Select 
             v-if = "campo.form_type == 'select' && parametros.selectData[campo.field] !== undefined"
             class="w-100"
             filter
             :disabled="campo.editable === false"
             v-model="modelo[campo.field]" 
             :options="parametros.selectData[campo.field].data" 
             :optionLabel="parametros.selectData[campo.field].label" 
             :optionValue="parametros.selectData[campo.field].optionValue" 
             :placeholder="parametros.selectData[campo.field].placeholder" />

          <AutoComplete
            v-if="campo.form_type == 'autocomplete' && campo.autocomplete"
            :modelValue="modelo[campo.field]"
            :displayValue="campo.display_field ? (modelo[campo.display_field] ?? '') : ''"
            :search="campo.autocomplete.search"
            :optionLabel="campo.autocomplete.label"
            :optionValue="campo.autocomplete.optionValue"
            :placeholder="campo.autocomplete.placeholder || campo.headerName"
            :disabled="campo.editable === false"
            @update:modelValue="v => modelo[campo.field] = v" />

          <ProductSelector
            v-if="campo.form_type == 'product-selector' && campo.autocomplete"
            :modelValue="modelo[campo.field]"
            :displayValue="campo.display_field ? (modelo[campo.display_field] ?? '') : ''"
            :search="campo.autocomplete.search"
            :optionLabel="campo.autocomplete.label"
            :optionValue="campo.autocomplete.optionValue"
            :placeholder="campo.autocomplete.placeholder || campo.headerName"
            :label="campo.headerName"
            :disabled="campo.editable === false"
            @update:modelValue="v => modelo[campo.field] = v"
            @item-selected="item => {
              modelo[campo.field] = item[campo.autocomplete.optionValue];
              if (campo.display_field) modelo[campo.display_field] = item[campo.autocomplete.label];
            }" />

          <div
            v-if="campo.form_type == 'radiobutton'"
            v-for="(campo_sub_opts) in parametros.selectData[campo.field].data" :key="campo_sub_opts"
            class="field-radiobutton">
              <RadioButton 
                :id="campo_sub_opts[ parametros.selectData[campo.field].optionValue ]" 
                :value="campo_sub_opts[ parametros.selectData[campo.field].optionValue ]"
                v-model="modelo[campo.field]" />
              <label for="campo_sub_opts.optionValue">{{campo_sub_opts[ parametros.selectData[campo.field].label ]}}</label>
          </div>

          <Checkbox v-if="campo.form_type == 'checkbox'"
                    :disabled="campo.editable === false"
                    v-model="modelo[campo.field]" :binary="true" />

          <InputPassword v-if="campo.form_type == 'password'"
                  v-model="modelo[campo.field]"></InputPassword>

          <MultiSelect 
                  v-if="campo.form_type == 'multi_select'"
                  v-model="modelo[campo.field]" 
                  :options="parametros.selectData[campo.field].data" 
                  :optionLabel="parametros.selectData[campo.field].label"
                  :optionValue="parametros.selectData[campo.field].optionValue" 
                  :placeholder="parametros.selectData[campo.field].placeholder" />
        </div>
      </div>
    </div>
  </div>

  <div class="row">
    <div class="col">
      <Button label="Cancelar" icon="pi-times" iconPos="right" 
              class="me-1"
              v-if="buttons.cancel.visible"
              @click="cancelar" />
      <Button :label="btnSubmit.label" :icon="btnSubmit.icon" iconPos="right" 
              @click="guardar" />
    </div>
  </div>
</template>

<script setup>
  import { ref, onMounted } from 'vue';
  import { AppStore } from '@/stores/app'
  import { fechaStringToDate, fechaDateToString } from '@/helpers/formatter'
  import ProductSelector from '@/components/genericos/ProductSelector.vue'

  defineExpose({ actualizar_modelo })

  const storeApp = AppStore()
  const props = defineProps(['parametros'])

  const modelo = ref({
    id: '',
    nombre:'',
    descripcion: ''
  })

  const campos = ref([])
  const buttons = ref({
    'cancel': { 'visible':true }
  })
  const btnSubmit = ref({ label: "Guardar", icon: 'pi-save' })
  const productosCache = ref({})

  async function guardar(){
    traducir_campos_a_out()
    //validacion
    let resultado_validacion = modelo_es_valido()
    if (!resultado_validacion.status){
      storeApp.mostrar_alerta( resultado_validacion.error )
      return
    }
    
    storeApp.loading = true
    let res_peticion = await props.parametros.onSubmit( modelo.value )
    
    if (res_peticion){
      storeApp.loading = false
      if (!res_peticion.stat) {
        storeApp.mostrar_alerta( res_peticion.text )
        return 
      }

      storeApp.modal_generico.activo = false
      props.parametros.guardado( res_peticion )
    } else {
      storeApp.loading = false
      console.log('error!')
    }
  }

  //esta funcion se encarga de traducir el contenido del modelo, de lo definido por los inputs
  //al formato esperable por el endpoint
  function traducir_campos_a_out(){
    for (let c=0; c < campos.value.length; c++){
      //se procesan los campos de tipo checkbox
      if (campos.value[c].form_type == 'checkbox'){ //podria usar un switch para eso, pero dentro de un case no puedo definir variables locales con let :/
        if (modelo.value[campos.value[c].field] == true){
          modelo.value[campos.value[c].field] = 1
        } else {
          modelo.value[campos.value[c].field] = 0
        }
      } else if (campos.value[c].form_type == 'file_upload'){
        let campo = document.querySelector('#'+campos.value[c].field)
        
        for (let i = 0; i< campo.files.length; i++){
          modelo.value[campos.value[c].field + i] = { 'form_type': 'file_upload', data: campo.files[i] }
        }

        modelo.value[campos.value[c].field] = '_' //para que pase por el validador en caso de que se necesite archivo requerido (Se debe modificar a posteriori)
      } else if (campos.value[c].form_type == 'date'){
        modelo.value[campos.value[c].field] = fechaDateToString(modelo.value[campos.value[c].field], '-')
      }
    }
  }

  function modelo_es_valido(){
    let salida = { status: true, error: '' }

    for (let c=0; c < campos.value.length; c++){
      let campo = campos.value[c]
      if (campo.hasOwnProperty('required') && campo.required && 
          (!modelo.value.hasOwnProperty(campo.field) || modelo.value[campo.field] == undefined || modelo.value[campo.field] == '')){
        salida.status = false
        salida.error += 'El campo '+ campo.headerName +" es necesario. \n"
      }

      if (campo.hasOwnProperty('form_min_max') && 
            (modelo.value.hasOwnProperty(campo.field) && modelo.value[campo.field] != null && modelo.value[campo.field].length < campo.form_min_max[0])){
        salida.status = false
        salida.error += 'El campo '+ campo.headerName +' debe tener al menos '+campo.form_min_max[0]+" caracteres. \n"
      }

      if (campo.hasOwnProperty('form_min_max') && 
            (modelo.value.hasOwnProperty(campo.field) && modelo.value[campo.field] != null && modelo.value[campo.field].length > campo.form_min_max[1])){
        salida.status = false
        salida.error += 'El campo '+ campo.headerName +' no debe superar los '+campo.form_min_max[1]+" caracteres. \n"
      }
    }

    return salida
  }

  function cancelar(){
    storeApp.modal_generico.activo = false
  }

  function traducir_campos_d_input(){
    for (let c=0; c < campos.value.length; c++){
      //se procesan campos de tipo fecha
      if (campos.value[c].form_type == 'date'){
        modelo.value[campos.value[c].field] = fechaStringToDate( modelo.value[campos.value[c].field], '-')
      }
      //se procesan los campos de tipo checkbox
      if (campos.value[c].form_type == 'checkbox'){
        if (modelo.value[campos.value[c].field] == 1){
          modelo.value[campos.value[c].field] = true
        }
      }
      //se procesan opciones de campos con multiples opciones 
      if (campos.value[c].hasOwnProperty('rel_table')){
        props.parametros['selectData'][campos.value[c].field] = {
          data:        campos.value[c].rel_table.rows,
          label:       campos.value[c].rel_table.descr_field,
          optionValue: campos.value[c].rel_table.id_field,
          placeholder: campos.value[c].headerName
        }
        
        if (campos.value[c]['form_type'] == undefined) //no deberia venir undefined pero se aplica este parche por que si sucede con la info que viene de la api
          campos.value[c]['form_type'] = 'select'
      }
      if (campos.value[c].hasOwnProperty('form_values')){
        props.parametros['selectData'][campos.value[c].field] = {
          data:        campos.value[c].form_values,
          label:       'name',
          optionValue: 'id',
          placeholder: ''
        }

        if (campos.value[c]['form_type'] == undefined) //no deberia venir undefined pero se aplica este parche por que si sucede con la info que viene de la api
          campos.value[c]['form_type'] = 'select'
      }
      //arreglo para los casos en los que el json se define un 'form_input_type'
      if (campos.value[c].hasOwnProperty('form_input_type')){
        campos.value[c]['form_type'] = campos.value[c]['form_input_type']
      }

      //en los casos que tenemos un selector multiple, hay que traducir los campos, a partir de lo que llega de la api
      if (campos.value[c].hasOwnProperty('form_type') && campos.value[c].form_type === 'multi_select'
          && (modelo.value[campos.value[c].field] != undefined && modelo.value[campos.value[c].field] != null)){
        let aux = []
        for (let i=0; i < modelo.value[campos.value[c].field].length; i++){
          aux.push(modelo.value[campos.value[c].field][i][ campos.value[c].rel_table.id_field ])
        }
        modelo.value[campos.value[c].field] = aux
      }
    }
  }

  function actualizar_modelo(){
    if (props.parametros.hasOwnProperty('modelo') ){
      modelo.value = {...props.parametros.modelo}
    }

    if (props.parametros.hasOwnProperty('btnSubmit') ){
      btnSubmit.value = props.parametros.btnSubmit
    }

    if (!props.parametros.hasOwnProperty('selectData') ){
      props.parametros['selectData'] = {}
    }

    if (props.parametros.hasOwnProperty('buttons') ){
      buttons.value = props.parametros.buttons
    }

    campos.value = props.parametros.campos
    traducir_campos_d_input()

    if (props.parametros.hasOwnProperty('quitar_campos')){
      for (let c=0; c < props.parametros.quitar_campos.length; c++){
        for (let i=0; i < campos.value.length; i++){
          if (campos.value[i].field == props.parametros.quitar_campos[c]){
            campos.value.splice(i, 1)
            break
          }
        }
      }
    }

    setTimeout(()=>{
      if (typeof $ !== 'undefined' && $.fn && $.fn.fileinput) {
        $(".file").fileinput({
          language: 'es',
          showRemove: false,
          showUpload: false,
        });
      }
    }, 200)
  }

  onMounted(async ()=>{
    actualizar_modelo()
  })
</script>

<style scoped>
.label-cont{
  padding-top: 1rem;
}
</style>