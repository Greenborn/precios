<template>
  <div v-if="needRefresh" class="pwa-update-toast" role="status">
    <span class="pwa-update-toast__texto">Hay una versión nueva de Precios disponible.</span>
    <div class="pwa-update-toast__acciones">
      <button type="button" class="btn btn-sm btn-primary" @click="applyUpdate">Actualizar</button>
      <button type="button" class="btn btn-sm btn-secondary" @click="needRefresh = false">Más tarde</button>
    </div>
  </div>
</template>

<script setup>
import { needRefresh, applyUpdate } from '@/pwa'
</script>

<style scoped>
.pwa-update-toast {
  position: fixed;
  left: 1rem;
  right: 1rem;
  bottom: 1rem;
  z-index: 2000;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin: 0 auto;
  padding: 0.85rem 1rem;
  max-width: 28rem;
  border-radius: 0.6rem;
  background: #1976d2;
  color: #fff;
  box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.25);
}

.pwa-update-toast__texto {
  flex: 1 1 100%;
  font-size: 0.9rem;
}

.pwa-update-toast__acciones {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}
</style>
