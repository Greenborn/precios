<template>
  <PublicTopBar />
  <main class="pub-main">
    <section class="pub-status" aria-labelledby="err-title" role="alert">
      <svg viewBox="0 0 240 160" role="img" aria-label="Carrito con un signo de advertencia">
        <ellipse cx="120" cy="146" rx="80" ry="8" fill="var(--gb-surface-2)" />
        <path d="M40 40h22l18 70h90l16-50H72" fill="none" stroke="var(--gb-text-muted)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="90" cy="128" r="8" fill="var(--gb-text-muted)" />
        <circle cx="160" cy="128" r="8" fill="var(--gb-text-muted)" />
        <circle cx="180" cy="40" r="22" fill="var(--gb-danger-soft)" stroke="var(--gb-danger)" stroke-width="3" />
        <rect x="177" y="27" width="6" height="16" rx="3" fill="var(--gb-danger)" />
        <circle cx="180" cy="51" r="3.5" fill="var(--gb-danger)" />
      </svg>
      <h1 id="err-title">Algo salió mal</h1>
      <p>Ocurrió un error inesperado. Probá recargar la página o volvé al inicio en unos minutos.</p>
      <div class="d-flex flex-wrap gap-2 justify-content-center mt-2">
        <router-link to="/" class="btn btn-primary"><Icon name="bi-house" /> Volver al inicio</router-link>
        <button type="button" class="btn btn-outline-secondary" @click="recargar"><Icon name="bi-arrow-clockwise" /> Reintentar</button>
      </div>
    </section>
  </main>
  <PublicFooter />
</template>

<script setup>
import PublicTopBar from "../components/publico/PublicTopBar.vue";
import PublicFooter from "../components/publico/PublicFooter.vue";
function recargar(){ window.location.reload() }
</script>
