<template>
  <i :class="'bi ' + iconClass" aria-hidden="true"></i>
</template>

<script setup>
import { computed } from 'vue'
import { piToBi } from '@/utils/icons'

const props = defineProps({
  name: { type: String, default: '' }
})

const iconClass = computed(() => piToBi(props.name))
</script>
