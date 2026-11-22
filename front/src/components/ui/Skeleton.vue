<template>
  <span v-if="lines <= 1" class="gb-skeleton" :class="'gb-skeleton--' + shape" :style="styleObj" aria-hidden="true"></span>
  <span v-else class="gb-skeleton-group" aria-hidden="true">
    <span v-for="n in lines" :key="n" class="gb-skeleton gb-skeleton--text" :style="{ ...styleObj, width: n === lines ? '60%' : width }"></span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  width: { type: String, default: '100%' },
  height: { type: String, default: '' },
  shape: { type: String, default: 'text' }, // text | rect | circle
  lines: { type: Number, default: 1 },
  radius: { type: String, default: '' }
})
const styleObj = computed(() => {
  const s = { width: props.width }
  if (props.height) s.height = props.height
  if (props.shape === 'circle') s.height = s.height || props.width
  if (props.radius) s.borderRadius = props.radius
  return s
})
</script>

<style scoped>
.gb-skeleton {
  display: block;
  height: 0.85em;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--gb-surface-2) 25%, var(--gb-border) 37%, var(--gb-surface-2) 63%);
  background-size: 400% 100%;
  animation: gb-shimmer 1.4s ease infinite;
}
.gb-skeleton--rect { height: 6rem; border-radius: var(--gb-radius-sm); }
.gb-skeleton--circle { border-radius: 50%; }
.gb-skeleton-group { display: flex; flex-direction: column; gap: 0.5rem; }
@keyframes gb-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
</style>
