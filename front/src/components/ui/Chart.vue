<template>
  <div class="gb-chart" :style="height ? { height } : null">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { applyChartDefaults, themeData } from '@/utils/chartTheme'

// Chart.js se carga de forma diferida (chunk propio) la primera vez que se monta un grafico.
let chartJsPromise = null
function loadChartJS() {
  if (!chartJsPromise) {
    chartJsPromise = import('chart.js/auto').then(m => {
      applyChartDefaults(m.Chart)
      return m.Chart
    })
  }
  return chartJsPromise
}

const props = defineProps({
  type: { type: String, default: 'line' },
  data: { type: Object, default: () => ({}) },
  options: { type: Object, default: () => ({}) },
  // Nuevos
  themed: { type: Boolean, default: true }, // colorear datasets sin color con la paleta de marca
  height: { type: String, default: '' }     // ej '320px' => maintainAspectRatio false
})

const canvas = ref(null)
let chart = null
let ChartJS = null
let unmounted = false

async function render() {
  if (!ChartJS) ChartJS = await loadChartJS()
  const el = canvas.value
  if (!el || unmounted) return
  if (chart) chart.destroy()
  const data = props.themed ? themeData(props.type, props.data) : props.data
  const options = props.height ? { maintainAspectRatio: false, ...props.options } : props.options
  chart = new ChartJS(el, { type: props.type, data, options })
}

onMounted(render)
onBeforeUnmount(() => { unmounted = true; if (chart) chart.destroy() })
watch(() => [props.data, props.options, props.type], () => render(), { deep: true })
</script>

<style scoped>
.gb-chart { position: relative; width: 100%; }
</style>
