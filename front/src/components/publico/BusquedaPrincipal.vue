<template>
<div id="buscador-cnt">
    <BusquedaHero v-model="termino_busqueda" :loading="buscando" :estadisticas="estadisticas_inc" @buscar="hacer_busqueda" />

    <section class="pub-section" aria-labelledby="resultados-title" v-if="buscado" ref="resultadosRef">
        <div class="pub-toolbar">
            <h2 id="resultados-title" class="pub-section__title mb-0">
                Resultados
                <Badge v-if="!buscando && total" tone="primary" :label="total" />
            </h2>
            <div class="pub-chips" role="group" aria-label="Ordenar resultados" v-if="total">
                <button v-for="o in ORDENES" :key="o.id" type="button" class="pub-chip"
                        :aria-pressed="orden == o.id ? 'true' : 'false'" @click="cambiarOrden(o.id)">
                    <Icon :name="o.icon" /> {{ o.label }}
                </button>
            </div>
        </div>

        <div aria-live="polite" :aria-busy="buscando ? 'true' : 'false'">
            <div v-if="buscando" class="pub-grid">
                <div v-for="n in 6" :key="n" class="pub-price-card">
                    <Skeleton width="45%" height="1.8rem" />
                    <Skeleton :lines="2" />
                    <Skeleton width="70%" />
                </div>
            </div>

            <EmptyState v-else-if="resultados.length == 0" icon="bi-search" size="lg"
                title="No encontramos resultados"
                :description="'No hay precios para “' + termino_busqueda + '”. Probá con otro término o uno más general.'" />

            <transition-group v-else name="fade" tag="div" class="pub-grid">
                <ResultadoPrecioCard v-for="(resultado, idx) in resultados" :key="(resultado.product_id ?? resultado.id) + '-' + resultado.branch_id + '-' + idx"
                    :resultado="resultado" :termino="termino_busqueda"
                    :fecha="resultado?.tipo != 'PROMO' ? formateaFecha(resultado?.date_time, resultado?.time) : ''"
                    :especificaciones="resultado?.tipo == 'ALQUILER' ? get_especificaciones(resultado?.caracteristicas) : []"
                    @estadisticas="mostrar_estadisticas" @corregir="corregir_precio" />
            </transition-group>

            <div ref="centinelaRef" aria-hidden="true" style="height: 1px"></div>
            <div v-if="cargandoMas" class="text-center my-4 gb-text-muted">
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span class="ms-2">Cargando más resultados…</span>
            </div>
        </div>
    </section>

    <div class="pub-section" v-if="deferredPrompt">
        <Card variant="outline">
            <div class="d-flex flex-wrap align-items-center gap-3">
                <span class="pub-quick__icon" aria-hidden="true"><Icon name="bi-phone" /></span>
                <div class="flex-grow-1">
                    <b>Instalá la app</b>
                    <p class="gb-text-muted small mb-0">Accedé más rápido desde tu celular.</p>
                </div>
                <Button label="Instalar aplicación móvil" icon="bi-download" @click="instalarApp" />
            </div>
        </Card>
    </div>

    <slot></slot>

    <div class="pub-section" v-if="mostrarDisclaimer">
        <div class="alert alert-light border d-flex gap-3 mb-0" role="note">
            <Icon name="bi-info-circle" class="text-primary fs-5" />
            <div class="small flex-grow-1">
                <p class="mb-1"><b>Aviso</b></p>
                <p class="mb-1">
                    Si <b>NO</b> querés que tu negocio figure en el listado escribí por MP a
                    <a href="https://www.facebook.com/TandilPreciosBaratos" target="_blank" rel="noopener">TandilPreciosBaratos</a>
                    proporcionando medios de contacto oficiales.
                </p>
                <p class="mb-0">
                    La información proporcionada es obtenida a partir de canales de acceso público y datos
                    proporcionados por usuarios y puede no ser del todo consistente con la realidad pero da una
                    idea general de los valores.
                </p>
            </div>
            <button type="button" class="btn-close" aria-label="Cerrar aviso" @click="mostrarDisclaimer = false"></button>
        </div>
    </div>
</div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { busqueda, busqueda_promociones, get_estadistica } from '../../api/public/publicEndpoints'

import { formatMoney, fechaDateToString } from '../../helpers/formatter'
import { AppStore } from "../../stores/app"

import GraficoEvolucionPrecio from './GraficoEvolucionPrecio.vue'
import FormularioAddPrecio from './FormularioAddPrecio.vue'
import BusquedaHero from './BusquedaHero.vue'
import ResultadoPrecioCard from './ResultadoPrecioCard.vue'


defineExpose({ buscar })
const storeApp = AppStore()

const termino_busqueda = ref('')
const solo_ofertas = ref(false)
const resultados = ref([]);
const pagina = ref(1);
const PAGE_SIZE = 30;
const total = ref(0);
const hayMas = ref(false);
const cargandoMas = ref(false);
const estadisticas_inc = ref([])
const MODAL_STYLE = { width: '100vw', 'min-height': "100vh" }
const mostrarDisclaimer = ref(true)
const deferredPrompt = ref(null)
// Estado solo visual (skeletons / orden)
const buscando = ref(false)
const buscado = ref(false)
const resultadosRef = ref(null)
const centinelaRef = ref(null)
const orden = ref('relevancia')
const ORDENES = [
    { id: 'relevancia', label: 'Relevancia', icon: 'bi-stars' },
    { id: 'precio_asc', label: 'Menor precio', icon: 'bi-sort-numeric-down' },
    { id: 'precio_desc', label: 'Mayor precio', icon: 'bi-sort-numeric-up' }
]
const MIN_CARACTERES = 3
// Identifica la búsqueda vigente para descartar respuestas viejas
// (cambio de término/orden mientras había una página en vuelo)
let busqueda_id = 0

async function cambiarOrden(id){
    if (orden.value == id) return
    orden.value = id
    await cargarPagina(1)
}

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
    if ((termino_busqueda.value || '').trim().length >= MIN_CARACTERES){
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

    const t = (termino_busqueda.value || '').trim()
    if (t === '') {
        storeApp.mostrar_alerta( "Por favor, ingrese el nombre del producto." )
        return false
    }

    if (t.length < MIN_CARACTERES) {
        storeApp.mostrar_alerta( `El nombre del producto debe tener al menos ${MIN_CARACTERES} caracteres.` )
        return false
    }

    orden.value = 'relevancia'
    buscado.value = true
    const ok = await cargarPagina(1)
    if (ok) {
        await nextTick()
        resultadosRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    return ok
}

// Pide una página al back. pagina 1 reinicia la lista; las siguientes se agregan.
async function cargarPagina( num ) {
    const id = num == 1 ? ++busqueda_id : busqueda_id
    const t = (termino_busqueda.value || '').trim()

    if (num == 1) {
        resultados.value = []
        total.value = 0
        hayMas.value = false
        buscando.value = true
    } else
        cargandoMas.value = true

    let res = null
    try {
        res = await FUNCION_BUSQUEDA[ solo_ofertas.value ? 'promociones' : 'general' ](
            t, { pagina: num, cantidad: PAGE_SIZE, orden: orden.value })
    } finally {
        if (id == busqueda_id) {
            buscando.value = false
            cargandoMas.value = false
        }
    }
    if (id != busqueda_id) return false   // respuesta de una búsqueda anterior

    if (!res || res?.error) {
        if (num == 1) storeApp.mostrar_alerta( res?.message || "Ocurrio un error, re-intente más tarde." )
        hayMas.value = false
        return false
    }

    const items = res?.items || []
    resultados.value = num == 1 ? items : [...resultados.value, ...items]
    pagina.value = num
    total.value = res?.total ?? resultados.value.length
    hayMas.value = !!res?.hay_mas
    await nextTick()
    observarCentinela()
    return true
}

function cargarMasResultados() {
    if (cargandoMas.value || buscando.value || !hayMas.value) return;
    cargarPagina(pagina.value + 1)
}

// Infinite scroll: al ver el centinela al final de la lista se pide la próxima página
let observer = null
function observarCentinela() {
    if (!observer || !centinelaRef.value) return
    observer.disconnect()
    observer.observe(centinelaRef.value)
}

onMounted(() => {
    observer = new IntersectionObserver((entries) => {
        if (entries.some(e => e.isIntersecting)) cargarMasResultados()
    }, { rootMargin: '400px 0px' })
    observarCentinela()
});

onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
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
.pub-section[aria-labelledby="resultados-title"] { scroll-margin-top: 5rem; }
.fade-enter-active, .fade-leave-active { transition: opacity var(--gb-transition-slow); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
