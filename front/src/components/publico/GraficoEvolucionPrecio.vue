<template>
<div class="evo">
    <div class="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
        <div>
            <h2 class="fs-5 mb-1">{{ parametros?.item?.products?.name }}</h2>
            <p class="gb-text-muted small mb-0"><Icon name="bi-shop" /> {{ parametros?.item?.nombre_comercio }}{{ parametros?.item?.empresa?.name }}</p>
        </div>
        <div class="pub-chips" role="group" aria-label="Rango de fechas" v-if="serie.labels.length > 7">
            <button v-for="r in RANGOS" :key="r.dias" type="button" class="pub-chip"
                    :aria-pressed="rango == r.dias ? 'true' : 'false'" @click="rango = r.dias">{{ r.label }}</button>
        </div>
    </div>

    <div class="pub-grid pub-grid--stats mb-3">
        <StatCard label="Precio actual" icon="bi-tag" :value="kpis.actual" :delta="kpis.delta" invertColors hint="en el período" />
        <StatCard label="Mínimo" icon="bi-arrow-down" tone="success" :value="kpis.min" />
        <StatCard label="Máximo" icon="bi-arrow-up" tone="danger" :value="kpis.max" />
        <StatCard label="Registros" icon="bi-calendar3" tone="info" :value="kpis.registros" />
    </div>

    <Card flush>
        <div class="p-3">
            <EmptyState v-if="!chartData.labels.length" size="sm" title="Sin historial de precios" />
            <Chart v-else type="line" :data="chartData" :options="chartOptions" height="360px" class="w-100" />
        </div>
    </Card>
</div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {  fechaDateToString, fechaStringToDate, formatMoney } from '../../helpers/formatter'
import { CHART_COLORS, alpha } from '../../utils/chartTheme'

const props = defineProps(['parametros'])

// Serie completa (se calcula una vez en onMounted); chartData aplica el rango elegido
const serie = ref({ labels: [], data: [], registros: 0 })
const rango = ref(0)
const RANGOS = [
    { dias: 7, label: '7 días' },
    { dias: 30, label: '30 días' },
    { dias: 90, label: '90 días' },
    { dias: 0, label: 'Todo' }
]
const chartData = computed(() => {
    const n = rango.value && serie.value.labels.length > rango.value ? rango.value : serie.value.labels.length
    return {
        labels: serie.value.labels.slice(-n),
        datasets: [{
            label: 'Precio',
            data: serie.value.data.slice(-n),
            borderColor: CHART_COLORS.primary,
            backgroundColor: alpha(CHART_COLORS.primary, 0.12),
            fill: true,
            pointRadius: n > 60 ? 0 : 3,
            tension: 0
        }]
    }
})
const kpis = computed(() => {
    const d = chartData.value.datasets[0].data.map(Number).filter(v => !isNaN(v))
    if (!d.length) return { actual: '—', min: '—', max: '—', delta: null, registros: serie.value.registros }
    const first = d[0], last = d[d.length - 1]
    return {
        actual: '$ ' + formatMoney(last),
        min: '$ ' + formatMoney(Math.min(...d)),
        max: '$ ' + formatMoney(Math.max(...d)),
        delta: first ? Math.round(((last - first) / first) * 10000) / 100 : null,
        registros: serie.value.registros
    }
})
const chartOptions = ref({
    "responsive": true,
    plugins: { legend: { display: false } },
    scales: { y: { ticks: { callback: v => '$ ' + Number(v).toLocaleString('es-AR') } } }
});


function insertar_ordenado( array_, elemento, campo = 'price' ){
  const ARR_LEN = array_.length

  if (ARR_LEN == 0){
    array_.push(elemento)
    return array_
  }

  for (let i=0; i < ARR_LEN; i++){
    if (array_[i][campo] > elemento[campo]){
      array_.splice(i, 0, elemento)
      return array_
    }
  }

  array_.push(elemento)
  return array_
}


function formateaFecha( fecha, time ){
    let hora = new Date(time)
    fecha = new Date(fecha)
    fecha.setHours(hora.getHours(), hora.getMinutes(), hora.getSeconds())
    
    return fechaDateToString(new Date(fecha),"/", "dd-mm-YYYY H:M" )
}

onMounted(() => {
    let labels = []

    let precios = []
    let resultados = props.parametros.resultados['items']

    for (let i = 0; i < resultados.length; i++){
        let fecha = new Date(resultados[i].time)
        resultados[i]['time'] = fecha.getTime()
        precios = insertar_ordenado(precios, resultados[i], 'time')
    }

    let data_set = []
    let fecha_existe = {}
    let aux_fechas = []
    for (let i = 0; i < precios.length; i++){
        if ( fecha_existe[precios[i]['date_time']] == undefined){
            fecha_existe[precios[i]['date_time']] = true
            labels.push( formateaFecha( precios[i].date_time, precios[i].time ) )
            aux_fechas.push( precios[i]['date_time'] )
            data_set.push( precios[i].price )
        }
    }

    let labels_aux = []
    let data_aux = []
    const CANT_E = data_set.length
    if (CANT_E > 1){
        for (let i = 1; i < CANT_E; i++){
            let dato1_f = new Date(aux_fechas[i-1])
            let dato2_f = new Date(aux_fechas[i])

            labels_aux.push( labels[i-1])
            data_aux.push( data_set[i-1] )
            
            if (dato1_f.getTime() < dato2_f.getTime() ){
                let f_ini = new Date(dato1_f)
                f_ini.setDate(f_ini.getDate() + 1)
                while (f_ini.getTime() < dato2_f.getTime()){
                    labels_aux.push( fechaDateToString( f_ini, "/", 'dd-mm-YYYY' ) )
                    data_aux.push( data_set[i-1] )
                    f_ini.setDate(f_ini.getDate() + 1)
                }           
            }
        }
        labels_aux.push( labels[CANT_E-1])
        data_aux.push( data_set[CANT_E-1] )
        labels = labels_aux
        data_set = data_aux
    }

    serie.value = { labels, data: data_set, registros: precios.length }
})
</script>