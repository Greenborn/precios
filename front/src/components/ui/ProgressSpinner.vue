<template>
  <div class="spinner-border local-spinner" role="status" :style="styleObject"></div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  style: { type: [String, Object], default: '' }
})

const styleObject = computed(() => {
  if (typeof props.style === 'string') return props.style
  return props.style || {}
})
</script>

<style scoped>
.local-spinner {
  color: var(--gb-primary);
}
</style>