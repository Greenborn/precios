<template>
  <span v-if="valor !== null" class="pub-delta" :class="'pub-delta--' + dir"
        :aria-label="dir === 'flat' ? 'Sin variación' : (dir === 'up' ? 'Subió ' : 'Bajó ') + texto">
    <span aria-hidden="true">{{ dir === 'up' ? '▲' : dir === 'down' ? '▼' : '=' }}</span>
    <span class="gb-num">{{ texto }}</span>
  </span>
</template>

<script setup>
// Muestra variación de precio. Subir = rojo, bajar = verde.
import { computed } from 'vue'
const props = defineProps({ value: { type: [Number, String], default: null } })
const valor = computed(() => {
  if (props.value === null || props.value === undefined || props.value === '') return null
  const n = Number(String(props.value).replace(',', '.'))
  return isNaN(n) ? null : n
})
const dir = computed(() => valor.value > 0 ? 'up' : valor.value < 0 ? 'down' : 'flat')
const texto = computed(() => Math.abs(valor.value).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + '%')
</script>
