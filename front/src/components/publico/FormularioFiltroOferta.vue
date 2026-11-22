<template>
    <div class="w-100">
        <div class="row p-2">
            <div class="col-12 label-cont">
                <label  for="nombre_prod"><b>Nombre</b></label>
            </div>
            <div class="col-12">
                <input id="nombre_prod" class="w-100" v-model="modelo.nombre_prod" @keyup.enter="filtrar" />
            </div>
        </div>

        <div class="row p-2">
            <div class="col-12 label-cont">
                <label  for="comercio"><b>Comercio</b></label>
            </div>
            <div class="col">
                <div class="row">

                    <div class="col-12 col-md-6"
                            v-for="(comercio, index) in parametros.listado_comercios" :key="index">
                        <div class="form-check">
                            <input class="form-check-input" v-model="modelo.comercio[comercio.branch_id]" type="checkbox" value="" 
                                :id="'promoCheck' + index">
                            <label class="form-check-label" :for="'promoCheck' + index">
                                {{comercio.name}}
                            </label>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    
        <div class="row border-top align-items-center justify-content-center">
            <div class="col-auto pt-3">
                <Button label="Cancelar" icon="pi-times" iconPos="right" 
                        class="me-1" @click="cancelar" />
                <Button label="Filtrar" iconPos="right" 
                        @click="filtrar" />
            </div>
        </div>
    
    </div>
</template>
    
<script setup>
    import { ref } from 'vue'
    import { AppStore } from '../../stores/app'
    
    const storeApp = AppStore()
    const props = defineProps(['parametros'])
    
    const opc_comercios_s = ref([{
        id: -1,
        name: "Todas"
    }])
    opc_comercios_s.value.push( props.parametros.listado_comercios )
    const modelo = ref( props.parametros?.params_filtro )

    function cancelar(){ storeApp.ocultar_modal( props.parametros._modal_cod ) }
    
    function filtrar(){
        let aux = {}
        let keys_comercios = Object.keys( modelo.value.comercio )
        for (let i=0; i < keys_comercios.length; i++)
            if (modelo.value.comercio[keys_comercios[i]])
                aux[keys_comercios[i]] = true
            
        modelo.value.comercio = aux
        props.parametros._callback_ok( modelo.value )
    }
</script>