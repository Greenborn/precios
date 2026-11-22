<template>
  <PublicTopBar />
  <main class="pub-main">
    <section class="pub-status" aria-labelledby="nf-title">
      <svg viewBox="0 0 240 160" role="img" aria-label="Etiqueta de precio perdida">
        <ellipse cx="120" cy="146" rx="80" ry="8" fill="var(--gb-surface-2)" />
        <path d="M70 30h70l50 50-60 60-60-60z" fill="var(--gb-primary-soft-2)" stroke="var(--gb-primary)" stroke-width="3" stroke-linejoin="round" transform="rotate(-12 120 85)" />
        <circle cx="92" cy="52" r="7" fill="var(--gb-surface)" stroke="var(--gb-primary)" stroke-width="3" />
        <text x="122" y="104" text-anchor="middle" font-size="34" font-weight="700" fill="var(--gb-primary)" font-family="inherit">404</text>
      </svg>
      <h1 id="nf-title">Esta página no está en la góndola</h1>
      <p>La dirección que buscaste no existe o fue movida. Volvé al inicio para seguir comparando precios.</p>
      <div class="d-flex flex-wrap gap-2 justify-content-center mt-2">
        <router-link to="/" class="btn btn-primary"><Icon name="bi-house" /> Volver al inicio</router-link>
        <router-link to="/ofertas" class="btn btn-outline-secondary">Ver ofertas</router-link>
      </div>
    </section>
  </main>
  <PublicFooter />
</template>

<script setup>
import PublicTopBar from "../components/publico/PublicTopBar.vue";
import PublicFooter from "../components/publico/PublicFooter.vue";
</script>
