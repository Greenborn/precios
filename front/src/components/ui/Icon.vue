<template>
  <i :class="['bi', iconClass]" :style="size ? { fontSize: size } : null" :aria-hidden="label ? null : 'true'" :aria-label="label || null" :role="label ? 'img' : null"></i>
</template>

<script setup>
import { computed } from 'vue'
import { piToBi } from '@/utils/icons'

// Único sistema de íconos: bootstrap-icons. Acepta 'pi-*' (legacy), 'bi-*' o nombre corto.
const props = defineProps({
  name: { type: String, default: '' },
  size: { type: String, default: '' },
  label: { type: String, default: '' }
})

const iconClass = computed(() => piToBi(props.name))
</script>
