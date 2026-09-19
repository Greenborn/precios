<template>
<div class="w-100">
    <div class="row p-2">
        <div class="col-12 label-cont">
            <label  for="precio"><b>Precio</b></label>
        </div>
        <div class="col-12">
            <CurrencyInput id="monto" class="w-100"
                                    v-model="precio" :options="CURRENCY_INPUTS_CFG" />
        </div>
    </div>

    <div class="row border-top">
        <div class="col pt-3">
            <Button label="Cancelar" icon="pi-times" iconPos="right" 
                    class="me-1" @click="cancelar" />
            <Button label="Guardar" iconPos="right" 
                    @click="guardar" />
        </div>
    </div>

</div>
</template>

<script setup>
import { ref } from 'vue'
import { AppStore } from '../../stores/app'
import CurrencyInput  from '../../components/genericos/CurrencyInput'

import { cargar_nuevo_precio } from '../../api/public/publicEndpoints'

const storeApp = AppStore()
const props = defineProps(['parametros'])

const precio = ref(0)
const CURRENCY_INPUTS_CFG ={
    "currency": "USD",
    "currencyDisplay": "narrowSymbol",
    "precision": 2,
    "hideCurrencySymbolOnFocus": true,
    "hideGroupingSeparatorOnFocus": true,
    "hideNegligibleDecimalDigitsOnFocus": true,
    "autoDecimalDigits": false,
    "useGrouping": true,
    "accountingSign": true
}
function cancelar(){ storeApp.ocultar_modal( props.parametros._modal_cod ) }

async function guardar(){
    if (precio.value <= 0){
        storeApp.mostrar_alerta('El precio debe ser mayor a 0')
        return
    }

    storeApp.loading = true
    let res = await cargar_nuevo_precio( { product_id: props.parametros.item.product_id, branch_id: props.parametros.item.branch_id, price: precio.value } );
    if (res.stat){
        storeApp.loading = false
        props.parametros._callback_ok()
        storeApp.mostrar_alerta('Precio cargado, se mostrará en próxima búsqueda, diferenciado')
    } else {
        storeApp.loading = false
        storeApp.mostrar_alerta(res?.error || res?.text || 'No se pudo cargar el precio')
    }
    
}
</script>