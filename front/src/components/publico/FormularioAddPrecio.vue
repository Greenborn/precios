<template>
<form class="w-100" @submit.prevent="guardar">
    <div class="d-flex gap-3 align-items-center p-3 mb-3 rounded-3 gb-bg-surface-2">
        <span class="pub-quick__icon" aria-hidden="true"><Icon name="bi-tag" /></span>
        <div class="small">
            <div class="fw-semibold">{{ parametros?.item?.name || parametros?.item?.products?.name }}</div>
            <div class="gb-text-muted">{{ parametros?.item?.empresa?.name }}
                <template v-if="parametros?.item?.price > 0"> · Precio actual <span class="gb-num">$ {{ formatMoney(parametros?.item?.price) }}</span></template>
            </div>
        </div>
    </div>

    <div class="gb-field mb-3">
        <label for="monto" class="gb-field__label">Nuevo precio</label>
        <CurrencyInput id="monto" class="form-control form-control-lg gb-num"
                                v-model="precio" :options="CURRENCY_INPUTS_CFG" />
        <small class="gb-field__help">Se publicará diferenciado como aporte comunitario.</small>
    </div>

    <div class="d-flex justify-content-end gap-2 pt-3 border-top">
        <Button label="Cancelar" variant="ghost" @click="cancelar" />
        <Button label="Guardar" type="submit" icon="bi-check-lg" :loading="guardando" />
    </div>
</form>
</template>

<script setup>
import { ref } from 'vue'
import { AppStore } from '../../stores/app'
import CurrencyInput  from '../../components/genericos/CurrencyInput'
import { formatMoney } from '../../helpers/formatter'
import { validar_precio } from '../../utils/precio'

import { cargar_nuevo_precio } from '../../api/public/publicEndpoints'

const storeApp = AppStore()
const props = defineProps(['parametros'])

const precio = ref(0)
const guardando = ref(false)
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
    const validacion = validar_precio(precio.value)
    if (!validacion.ok){
        storeApp.mostrar_alerta(validacion.mensaje)
        return
    }

    storeApp.loading = true
    guardando.value = true
    let res = await cargar_nuevo_precio( { product_id: props.parametros.item.product_id, branch_id: props.parametros.item.branch_id, price: validacion.precio } );
    guardando.value = false
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