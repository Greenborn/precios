<template>
<div class="container-fluid" id="buscador-cnt">
    <div  class="row align-items-center justify-content-center d-none d-sm-flex">
        <div class="col-12 col-md-10 col-lg-8 p-0 p-md-2">
            <div class="card mb-1 p-0 rounded-0">
                <div class="card-header p-4">
                    <h4>Buscá tu precio </h4>
                    <small>Ingrese el nombre del producto que desea consultar:</small>
                </div>
                <div class="card-body p-4">
                    <div class="row align-items-center justify-content-center">

                        <div class="col-12 col-md-8">
                            <div class="input-group">
                                <input v-model="termino_busqueda" type="text" class="form-control"
                                    placeholder="Nombre del producto" @keyup.enter="hacer_busqueda">
                                <button @click="buscar" class="btn btn-primary" type="button" aria-label="Buscar">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-search" viewBox="0 0 16 16">
                                        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zm-5.442 1.398a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>

                       <!-- <div class="col-12 col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" @change="ofertas_check_change" v-model="solo_ofertas" type="checkbox" value="" id="promoCheck">
                                <label class="form-check-label" for="promoCheck">
                                    Buscar Promociones y Ofertas
                                </label>
                            </div>
                        </div>-->

                    </div>                    
                </div>
            </div>
        </div>
    </div>

    <div class="row align-items-center justify-content-center">
        <div class="col-12 col-md-10 col-lg-8 p-0 pt-5 p-md-2">
            <div class="card mb-1 p-0 rounded-0">

                <div class="card-header p-4 pb-0">
                    <div class="row align-items-center justify-content-center">
                        <div class="col p-0 pl-2">
                            <h4>
                                Resultados
                                <small v-if="resultados?.length"> - {{ resultados.length }}</small>
                            </h4>
                        </div>
                    </div>
                </div>

                <div class="card-body p-4" aria-live="polite">
                    <!--
                    <div class="row align-items-center justify-content-center d-sm-none">
                        <div class="col-12">
                            <div class="form-check">
                                <input class="form-check-input" @change="ofertas_check_change" v-model="solo_ofertas" type="checkbox" value="" id="promoCheck">
                                <label class="form-check-label" for="promoCheck">
                                    Buscar Promociones y Ofertas
                                </label>
                            </div>
                        </div>
                    </div>-->

                    <template v-if="resultados.length == 0">
                        <div class="alert alert-info">
                            No hay resultados, pruebe con otro término de búsqueda.
                        </div>
                    </template>
                    <transition name="fade">
                        <div v-if="resultadosPaginados.length != 0">
                            <div v-for="resultado in resultadosPaginados" :key="resultado.producto" class="card mb-1 p-0 fade-item">
                            <div v-if="cargandoMas" class="text-center my-3">
                                <span class="spinner-border" role="status" aria-hidden="true"></span>
                                <span class="ms-2">Cargando más resultados...</span>
                            </div>
                                <div class="card-header p-4 pt-0 pb-0">
                                    <div class="row align-items-center justify-content-center">
                                        <div class="col-12 col-sm-4">
                                            <p class="price-cont mb-0" v-if="resultado?.price != -1">
                                                {{ resultado?.tipo == "ALQUILER" ? resultado.moneda : "$" }} {{ formatMoney(resultado?.price) }}
                                            </p>
                                            <p class="price-cont mb-0" 
                                                v-if="resultado?.caracteristicas?.promo_cnt 
                                                        && resultado?.price == -1">
                                                {{ resultado?.caracteristicas?.promo_cnt }}
                                            </p>
                                            <b v-if='resultado?.tipo != "PROMO"'>
                                                <small>{{ formateaFecha(resultado?.date_time, resultado?.time) }}</small>
                                            </b>
                                        </div>
                                        <div class="col-12 col-sm product-name-cont">
                                            <span v-html="resaltarBusqueda(resultado?.name, termino_busqueda)"></span>
                                            &nbsp;
                                            <small v-if="resultado?.url"><a :href="resultado?.url" target="_blank">IR A WEB</a></small>
                                            &nbsp;
                                            <small v-if="resultado?.tipo != 'ALQUILER' && resultado?.tipo != 'PROMO'" class="btn-corregir" @click="corregir_precio(resultado)">CLICK para CORREGIR</small>
                                        </div>
                                    </div>
                                    
                                </div>
                                <div class="card-body pl-4 pr-4">
                                    <div class="row align-items-center justify-content-center">

                                        <div class="col">
                                            <div class="row" 
                                                v-if="resultado?.notas != '' && resultado?.notas != null
                                                        || resultado?.caracteristicas?.desde || resultado?.caracteristicas?.hasta">
                                                <div class="col">
                                                    <span class="text-success">
                                                        <b>{{ resultado?.notas }}</b>
                                                        <b v-if="resultado?.caracteristicas?.desde">Desde: {{ resultado?.caracteristicas?.desde }}</b>
                                                        <b v-if="resultado?.caracteristicas?.hasta"> - Hasta: {{ resultado?.caracteristicas?.hasta }}</b>
                                                    </span>
                                                </div>
                                            </div>

                                            <div class="row"
                                                v-if="resultado?.user_nombre || resultado?.user_apellido">
                                                <div class="col">
                                                    <small class="text-muted">
                                                        <i class="bi bi-person-check me-1"></i>Cargado por:
                                                        <b>{{ [resultado?.user_nombre, resultado?.user_apellido].filter(Boolean).join(' ') }}</b>
                                                    </small>
                                                </div>
                                            </div>

                                            <div class="row">
                                                <div class="col cnt-negocios">
                                                    <div v-if="resultado?.tipo != 'ALQUILER'">
                                                        <b>Comercio: &nbsp;</b> {{ resultado?.empresa?.name }} &nbsp; -
                                                        <span v-for="comercio in resultado?.locales" :key="comercio">
                                                            {{ comercio?.address_road }} &nbsp;
                                                            {{ comercio?.address_number }}  &nbsp; |
                                                        </span>
                                                    </div>
                                                    <div v-if="resultado?.tipo == 'ALQUILER'">
                                                        <b>Locador: &nbsp;</b> {{ resultado?.empresa?.name }} &nbsp; -
                                                        <span v-for="_data in get_especificaciones(resultado?.caracteristicas)" :key="_data">
                                                            {{ _data?.name }} &nbsp;
                                                            {{ _data?.value }}  &nbsp; |
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="col-auto">
                                            <button v-if="resultado?.tipo != 'ALQUILER' && resultado?.tipo != 'PROMO'" type="button" class="btn btn-primary" @click="mostrar_estadisticas(resultado)">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-graph-up" viewBox="0 0 16 16">
                                                    <path fill-rule="evenodd" d="M0 0h1v15h15v1H0zm14.817 3.113a.5.5 0 0 1 .07.704l-4.5 5.5a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61 4.15-5.073a.5.5 0 0 1 .704-.07"/>
                                                </svg>
                                            </button>
                                        </div>

                                    </div>
                                    
                                </div>
                            </div>
                        </div>
                    </transition>
                </div>
            </div>

        </div>
    </div>

    <div class="row align-items-center justify-content-center" v-if="mostrarDisclaimer">
        <div class="col-12 col-md-10 col-lg-8 p-0 p-md-2">
            <div class="alert alert-success alert-dismissible fade show" role="alert">
                <button type="button" class="btn-close" aria-label="Cerrar" @click="mostrarDisclaimer = false"></button>
                <p><b>Disclaimer:</b></p>
                <p>
                    Si <b>NO</b> queres que tu negocio figure en el listado escribí por MP a 
                    <a href="https://www.facebook.com/TandilPreciosBaratos">TandilPreciosBaratos</a>
                    proporcionando medios de contacto oficiales.
                </p>
                <p>
                    La información proporcionada es obtenida a partir de canales de acceso público y datos 
                    proporcionados por usuarios y puede no ser del todo consistente con la realidad pero da una 
                    idea general de los valores.
                </p>
            </div>
        </div>
    </div>
        <div class="row align-items-center justify-content-center" v-if="deferredPrompt">
            <div class="col-12 col-md-10 col-lg-8">
                <button class="btn btn-primary w-100 mb-3" @click="instalarApp">
                    Instalar aplicación móvil
                </button>
            </div>
        </div>

    <div class="row align-items-center justify-content-center">
        <div class="col-12 col-md-10 col-lg-8 p-0 p-md-2">
            <div class="card mb-1 p-0 rounded-0">

                <div class="card-header p-4 pb-0">
                    <h4>Estadísticas Generales</h4>
                </div>

                <div class="card-body p-4">
                    <template v-if="estadisticas_inc.length != 0">
                        <div class="row">
                            <div class="col-12 col-md-6" v-for="estadistica in estadisticas_inc" :key="estadistica">
                                <div class="row">

                                    <div class="col-12 col-md-6 col-lg-auto">
                                        <b>{{ estadistica.description }}:</b>
                                    </div>

                                    <div class="col-12 col-md-6 col-lg-auto">
                                        {{ estadistica.value }}
                                    </div>
                                </div>
                                
                            </div>
                        </div>
                    </template>
                </div>
            </div>

        </div>
    </div>
</div>
    
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { busqueda, busqueda_promociones, get_estadistica } from '../../api/public/publicEndpoints'

import { formatMoney, fechaDateToString } from '../../helpers/formatter'
import { AppStore } from "../../stores/app"

import GraficoEvolucionPrecio from './GraficoEvolucionPrecio.vue'
import FormularioAddPrecio from './FormularioAddPrecio.vue'


defineExpose({ buscar })
const storeApp = AppStore()

const termino_busqueda = ref('')
const solo_ofertas = ref(false)
const resultados = ref([]);
const pagina = ref(1);
const pageSize = 100;
const resultadosPaginados = ref([]);
const cargandoMas = ref(false);
const estadisticas_inc = ref([])
const MODAL_STYLE = { width: '100vw', 'min-height': "100vh" }
const mostrarDisclaimer = ref(true)
const deferredPrompt = ref(null)

function instalarApp() {
    if (deferredPrompt.value) {
        deferredPrompt.value.prompt();
        deferredPrompt.value.userChoice.then((choiceResult) => {
            deferredPrompt.value = null;
        });
    }
}

onMounted(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt.value = e;
    });
});

async function ofertas_check_change(){
    if (termino_busqueda.value != '' && termino_busqueda.value?.length >= 3){
        await buscar(termino_busqueda.value)
    }
}

function get_especificaciones( data ){
    let aux = []
    
    if (data['direccion'] != "")
        aux.push( { name: "Direccion:", value: data['direccion'] } )

    if (data['ambientes'] != "")
        aux.push( { name: "Ambientes:", value: data['ambientes'] } )

    return aux
}
    
async function mostrar_estadisticas( item ){
    storeApp.loading = true
    let res = await get_estadistica( "variacion_precio&id_producto="+item.product_id+"&id_local="+item.branch_id );
    if (res){
        storeApp.loading = false
        
        storeApp.mostrar_modal(GraficoEvolucionPrecio, 'Variación del Precio a lo largo del tiempo',
            {
                'item': item,
                'resultados': res,
                
                }, 
                { 'styles': MODAL_STYLE })
        
    } else {
        storeApp.loading = false
    }
}

const FUNCION_BUSQUEDA = {
    'promociones': busqueda_promociones,
    'general': busqueda
}

async function buscar ( termino = undefined ) {
    if (termino != undefined && typeof termino == 'string')
        termino_busqueda.value = termino

    if (termino_busqueda.value === '') {
        storeApp.mostrar_alerta( "Por favor, ingrese el nombre del producto." )
        return false
    }

    if (termino_busqueda.value.length < 3) {
        storeApp.mostrar_alerta( "El nombre del producto debe tener al menos 3 caracteres." )
        return false
    }

    resultados.value = []
    pagina.value = 1
    storeApp.loading = true
    let res = await FUNCION_BUSQUEDA[ solo_ofertas.value ? 'promociones' : 'general' ](termino_busqueda.value);
    if (res) {
        storeApp.loading = false
        if (res?.error){
            storeApp.mostrar_alerta( "Ocurrio un error, re-intente más tarde." )
            return false
        }

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        })

        resultados.value = res?.items;
        actualizarResultadosPaginados();
        return true
    } else {
        storeApp.loading = false
        return false
    }
}

function actualizarResultadosPaginados() {
    resultadosPaginados.value = resultados.value.slice(0, pagina.value * pageSize);
}

function cargarMasResultados() {
    if (cargandoMas.value) return;
    if (resultadosPaginados.value.length >= resultados.value.length) return;
    cargandoMas.value = true;
    setTimeout(() => {
        pagina.value++;
        actualizarResultadosPaginados();
        cargandoMas.value = false;
    }, 500); // Simula carga, puede quitarse si es instantáneo
}

function handleScroll() {
    const scrollY = window.scrollY || window.pageYOffset;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    if (scrollY + windowHeight >= docHeight - 200) {
        cargarMasResultados();
    }
}

onMounted(() => {
    window.addEventListener('scroll', handleScroll);
});

onBeforeUnmount(() => {
    window.removeEventListener('scroll', handleScroll);
});

function formateaFecha( fecha, time ){
    let hora = new Date(time)
    fecha = new Date(fecha)
    fecha.setHours(hora.getHours(), hora.getMinutes(), hora.getSeconds())
    
    return fechaDateToString(new Date(fecha),"/", "dd-mm-YYYY H:M" )
}

async function hacer_busqueda(){
    await buscar(termino_busqueda.value)
}

async function cargar_estadisticas(){
    storeApp.loading = true
    let res = await get_estadistica("incremental_stats")
    if (res){
        storeApp.loading = false
        if (res?.error){
            storeApp.mostrar_alerta( "Ocurrio un error al cargar las estadísticas" )
            return false
        }
        estadisticas_inc.value = res?.items
    } else
        storeApp.loading = false
}

function corregir_precio(resultado){
    let modal_form = storeApp.mostrar_modal(FormularioAddPrecio, 'Corregir precio - '+resultado?.products?.name,
        {
            'item': resultado,
            _callback_ok: async () => {
                storeApp.ocultar_modal( modal_form.code )
            }
        },
    )
}

function resaltarBusqueda(texto, termino) {
  if (!termino || typeof texto !== 'string') return texto;
  const regex = new RegExp(`(${termino})`, 'ig');
  return texto.replace(regex, '<mark>$1</mark>');
}

onMounted(async ()=>{
    await cargar_estadisticas()
})

</script>

<style>
.btn-corregir{
    font-weight: bolder;
    color: #82321e;
    cursor: pointer;
}

.price-cont{
    color:rgb(70, 116, 0);
    font-weight: bolder;
    min-width: 226px;
    font-size: 2rem;
}

.product-name-cont{
  font-weight: bolder;
  font-size: 1rem;
  color: #1e3c82;
}

.cnt-negocios{
    overflow-x: scroll;
    max-height: 3rem;
    overflow-y: hidden;
}

#buscador-cnt{
    margin-top: 5rem;
}

.input-group .form-control {
    border-bottom: 2px solid #ced4da;
    transition: box-shadow 0.2s, border-color 0.2s;
}
.input-group .form-control:focus {
    box-shadow: 0 0 0 0.2rem rgba(32, 201, 151, 0.25);
    border-color: #20c997;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.form-control:focus, .btn:focus {
  outline: 2px solid #20c997;
  outline-offset: 2px;
  box-shadow: 0 0 0 0.2rem rgba(32, 201, 151, 0.25);
}
</style>