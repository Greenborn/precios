<template>
    <PublicTopBar />

    <main class="pub-main" id="estadisticas-cnt">
      <div class="pub-container">
        <PageHeader title="Estadísticas" icon="bi-bar-chart-line"
                    subtitle="Variación de precios diaria: diferencia entre los dos últimos precios registrados de cada producto."
                    :breadcrumbs="[{ label: 'Inicio', to: '/' }, { label: 'Estadísticas' }]" />

        <div class="pub-grid pub-grid--stats mb-4">
            <StatCard label="Productos analizados" icon="bi-box-seam" :loading="cargando"
                      :value="mayor_aumento_diario.length.toLocaleString('es-AR')" />
            <StatCard label="Variación mediana" icon="bi-percent" tone="warning" :loading="cargando"
                      :value="media_porcentaje_aumento !== undefined ? media_porcentaje_aumento + '%' : '—'" />
            <StatCard label="Subieron" icon="bi-arrow-up-right" tone="danger" :loading="cargando"
                      :value="resumen.subieron.toLocaleString('es-AR')" />
            <StatCard label="Bajaron" icon="bi-arrow-down-right" tone="success" :loading="cargando"
                      :value="resumen.bajaron.toLocaleString('es-AR')" />
        </div>

        <Card title="Mayores variaciones" icon="bi-graph-up-arrow" class="mb-4"
              :subtitle="mayor_aumento_diario[0]?.fecha_utlimo_precio ? 'Calculado el ' + fechaDateToString(new Date(mayor_aumento_diario[0]?.fecha_utlimo_precio), '/') : ''">
            <Skeleton v-if="cargando" height="300px" shape="rect" />
            <EmptyState v-else-if="!itemsFiltrados.length" size="sm" title="Sin datos para graficar" />
            <Chart v-else type="bar" :data="chartData" :options="chartOptions" height="320px" />
        </Card>

        <Card flush>
            <template #header>
                <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 w-100">
                    <h2 class="fs-6 mb-0">Detalle por producto</h2>
                    <div class="pub-chips" role="group" aria-label="Filtrar variaciones">
                        <button v-for="f in FILTROS" :key="f.id" type="button" class="pub-chip"
                                :aria-pressed="filtro == f.id ? 'true' : 'false'" @click="filtro = f.id; limite = 50">{{ f.label }}</button>
                    </div>
                </div>
            </template>
            <div class="px-3 pt-3 small gb-text-muted">
                Algunas variaciones exageradas pueden deberse a artículos que antes estaban en promoción y ahora no.
                El porcentaje se calcula como (precio hoy − precio anterior) / precio anterior × 100.
            </div>
            <div v-if="cargando" class="p-3"><Skeleton :lines="6" /></div>
            <EmptyState v-else-if="!itemsFiltrados.length" size="sm" title="No hay productos en este filtro" />
            <ul v-else class="list-unstyled mb-0 est-list">
                <li v-for="(item, k) in itemsFiltrados.slice(0, limite)" :key="k" class="est-item">
                    <VariacionPrecio :value="item.porcentaje_aumento" class="est-item__delta" />
                    <div class="est-item__body">
                        <div class="fw-semibold">{{ item.nombre_producto }}</div>
                        <small class="gb-text-muted"><Icon name="bi-shop" /> {{ item.nombre_comercio }}</small>
                    </div>
                    <div class="est-item__prices gb-num">
                        <small class="gb-text-muted text-decoration-line-through">${{ item.precio_ayer }}</small>
                        <b>${{ item.precio_hoy }}</b>
                    </div>
                    <Button size="sm" variant="ghost" icon="bi-graph-up" :ariaLabel="'Ver evolución de ' + item.nombre_producto"
                            @click="mostrar_estadisticas(item)" />
                </li>
            </ul>
            <template #footer v-if="itemsFiltrados.length > limite">
                <button type="button" class="btn btn-link btn-sm w-100 text-decoration-none" @click="limite += 100">
                    Mostrar más ({{ itemsFiltrados.length - limite }} restantes)
                </button>
            </template>
        </Card>
      </div>
    </main>
    <PublicFooter />
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppStore } from "../stores/app"
import { get_estadistica } from '../api/public/publicEndpoints'
import PublicTopBar from "../components/publico/PublicTopBar.vue";
import PublicFooter from "../components/publico/PublicFooter.vue";
import VariacionPrecio from "../components/publico/VariacionPrecio.vue";
import { CHART_COLORS } from '../utils/chartTheme'

import GraficoEvolucionPrecio from '../components/publico/GraficoEvolucionPrecio.vue'
import { formatMoney, fechaDateToString } from '../helpers/formatter'

const MODAL_STYLE = { width: '100vw', 'min-height': "100vh" }
const storeApp = AppStore()
  
const precios_por_negocio = ref([])
const mas_buscados = ref([])
const mayor_aumento_diario = ref([])
const media_porcentaje_aumento = ref(undefined)

// ---- UI ----
const cargando = ref(true)
const filtro = ref('todos')
const limite = ref(50)
const FILTROS = [
    { id: 'todos', label: 'Todos' },
    { id: 'subieron', label: 'Subieron' },
    { id: 'bajaron', label: 'Bajaron' }
]
const resumen = computed(() => {
    let subieron = 0, bajaron = 0
    for (const it of mayor_aumento_diario.value){
        const n = Number(it.porcentaje_aumento)
        if (n > 0) subieron++
        else if (n < 0) bajaron++
    }
    return { subieron, bajaron }
})
const itemsFiltrados = computed(() => {
    if (filtro.value == 'subieron') return mayor_aumento_diario.value.filter(i => Number(i.porcentaje_aumento) > 0)
    if (filtro.value == 'bajaron') return [...mayor_aumento_diario.value].filter(i => Number(i.porcentaje_aumento) < 0)
        .sort((a, b) => Number(a.porcentaje_aumento) - Number(b.porcentaje_aumento))
    return mayor_aumento_diario.value
})
const chartData = computed(() => {
    const top = itemsFiltrados.value.slice(0, 10)
    return {
        labels: top.map(i => String(i.nombre_producto || '').slice(0, 28)),
        datasets: [{
            label: 'Variación %',
            data: top.map(i => Number(i.porcentaje_aumento)),
            backgroundColor: top.map(i => Number(i.porcentaje_aumento) >= 0 ? CHART_COLORS.danger : CHART_COLORS.primary),
            borderRadius: 6
        }]
    }
})
const chartOptions = {
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: { x: { ticks: { callback: v => v + '%' } } }
}

async function mostrar_estadisticas( item ){
    storeApp.loading = true
    let res = await get_estadistica( "variacion_precio&id_producto="+item.id_producto+"&id_local="+item.branch_id );
    if (res){
        storeApp.loading = false
        
        storeApp.mostrar_modal(GraficoEvolucionPrecio, 'Variación del Precio a lo largo del tiempo',
            {
                'item': {...item, products: {"name": item.nombre_producto}},
                'resultados': res,
                
                }, 
                { 'styles': MODAL_STYLE })
        
    } else {
        storeApp.loading = false
    }
}

onMounted(async ()=>{
    storeApp.loading = true
    let res = await get_estadistica('precios_por_negocio')
    if (res){
        storeApp.loading = false
        if (!res.stat){
            cargando.value = false
            storeApp.mostrar_alerta( "Ocurrió un error al cargar las estadísticas de precios por negocio" )
            return false
        }
        precios_por_negocio.value = res?.items
    } else
        storeApp.loading = false

    storeApp.loading = true
    let res2 = await get_estadistica('trending')
    if (res2){
        storeApp.loading = false
        if (!res2.stat){
            cargando.value = false
            storeApp.mostrar_alerta( "Ocurrió un error al cargar las estadísticas de más buscados" )
            return false
        }
        mas_buscados.value = res2?.items
    } else
        storeApp.loading = false

        storeApp.loading = true

    let res3 = await get_estadistica('mayor_aumento_diario&limit=3000')
    if (res3){
        storeApp.loading = false
        if (!res3.stat){
            cargando.value = false
            storeApp.mostrar_alerta( "Ocurrió un error al cargar las estadísticas de los que más aumentaron" )
            return false
        }
        mayor_aumento_diario.value = res3?.items
        const cant = mayor_aumento_diario.value.length
        if (cant > 2){
            media_porcentaje_aumento.value = mayor_aumento_diario.value[Math.floor(cant/2)].porcentaje_aumento
        }
    } else
        storeApp.loading = false
    cargando.value = false
})
</script>

<style scoped>
.est-list { max-height: 70vh; overflow-y: auto; margin-top: var(--gb-space-3); }
.est-item { display: flex; align-items: center; gap: var(--gb-space-3); padding: .75rem var(--gb-space-4); border-top: 1px solid var(--gb-border); }
.est-item__delta { min-width: 5rem; justify-content: center; }
.est-item__body { flex: 1; min-width: 0; }
.est-item__prices { display: flex; flex-direction: column; align-items: flex-end; white-space: nowrap; }
@media (max-width: 575.98px) {
  .est-item { flex-wrap: wrap; }
  .est-item__body { flex-basis: calc(100% - 6rem); }
}
</style>
