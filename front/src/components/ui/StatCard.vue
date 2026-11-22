<template>
  <div class="gb-stat" :class="{ 'gb-stat--loading': loading }">
    <div class="gb-stat__top">
      <span class="gb-stat__label">{{ label }}</span>
      <span v-if="icon" class="gb-stat__icon" :class="'gb-stat__icon--' + tone"><Icon :name="icon" /></span>
    </div>
    <Skeleton v-if="loading" width="60%" height="1.75rem" />
    <div v-else class="gb-stat__value gb-num"><slot>{{ value }}</slot></div>
    <div v-if="!loading && (delta !== null && delta !== undefined && delta !== '' || hint)" class="gb-stat__foot">
      <span v-if="delta !== null && delta !== undefined && delta !== ''" class="gb-stat__delta gb-num" :class="['is-' + trend, good === true ? 'is-good' : good === false ? 'is-bad' : '']">
        <span aria-hidden="true">{{ trend === 'up' ? '▲' : trend === 'down' ? '▼' : '•' }}</span>
        {{ deltaText }}
      </span>
      <span v-if="hint" class="gb-stat__hint">{{ hint }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Icon from './Icon.vue'
import Skeleton from './Skeleton.vue'

const props = defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  delta: { type: [Number, String], default: null },  // variación; número => se formatea como %
  deltaSuffix: { type: String, default: '%' },
  // Si subir es malo (p.ej. precios/inflación), invertir colores
  invertColors: { type: Boolean, default: false },
  hint: { type: String, default: '' },               // texto al lado de la variación, ej "vs. mes anterior"
  icon: { type: String, default: '' },
  tone: { type: String, default: 'primary' },        // color del ícono: primary|success|warning|danger|info|accent
  loading: { type: Boolean, default: false }
})

const num = computed(() => typeof props.delta === 'number' ? props.delta : parseFloat(String(props.delta).replace(',', '.')))
const dir = computed(() => isNaN(num.value) || num.value === 0 ? 'flat' : (num.value > 0 ? 'up' : 'down'))
// trend = dirección + semántica de color
const trend = computed(() => dir.value)
const good = computed(() => dir.value === 'flat' ? null : (dir.value === 'up') !== props.invertColors)
const deltaText = computed(() => {
  if (typeof props.delta === 'string' && isNaN(num.value)) return props.delta
  const abs = Math.abs(num.value)
  return abs.toLocaleString('es-AR', { maximumFractionDigits: 2 }) + props.deltaSuffix
})
</script>

<style scoped>
.gb-stat {
  background: var(--gb-surface);
  border: 1px solid var(--gb-border);
  border-radius: var(--gb-radius);
  box-shadow: var(--gb-shadow-sm);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}
.gb-stat__top { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
.gb-stat__label { font-size: 0.8125rem; font-weight: 500; color: var(--gb-text-muted); }
.gb-stat__icon {
  width: 2rem; height: 2rem; border-radius: var(--gb-radius-sm);
  display: grid; place-items: center;
  color: var(--gb-primary); background: var(--gb-primary-soft-2);
}
.gb-stat__icon--success { color: var(--gb-success); background: var(--gb-success-soft); }
.gb-stat__icon--warning { color: var(--gb-warning); background: var(--gb-warning-soft); }
.gb-stat__icon--danger { color: var(--gb-danger); background: var(--gb-danger-soft); }
.gb-stat__icon--info { color: var(--gb-info); background: var(--gb-info-soft); }
.gb-stat__icon--accent { color: var(--gb-accent); background: color-mix(in srgb, var(--gb-accent) 12%, transparent); }
.gb-stat__value { font-size: 1.625rem; font-weight: 700; color: var(--gb-heading); line-height: 1.2; letter-spacing: -0.01em; }
.gb-stat__foot { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: 0.8rem; }
.gb-stat__delta { font-weight: 600; display: inline-flex; align-items: center; gap: 0.2rem; padding: 0.1rem 0.4rem; border-radius: 6px; }
.gb-stat__delta.is-good { color: var(--gb-success); background: var(--gb-success-soft); }
.gb-stat__delta.is-bad { color: var(--gb-danger); background: var(--gb-danger-soft); }
.gb-stat__delta.is-flat { color: var(--gb-text-muted); background: var(--gb-surface-2); }
.gb-stat__hint { color: var(--gb-text-muted); }
</style>
