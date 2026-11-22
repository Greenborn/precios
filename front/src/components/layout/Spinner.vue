<template>
  <div v-if="loading" class="portal-spinner-content" role="status" aria-live="polite">
    <ProgressSpinner :style="styleSpinner" />
    <span class="visually-hidden">Cargando…</span>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import ProgressSpinner from "../ui/ProgressSpinner.vue";

const styleSpinner = reactive({
  width: "50px",
  height: "50px",
});

const props = defineProps({
  loading: Boolean,
});
</script>
<style scoped>
.portal-spinner-content {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: color-mix(in srgb, var(--gb-surface) 72%, transparent);
  backdrop-filter: blur(2px);
  z-index: 10000;
}
</style>
