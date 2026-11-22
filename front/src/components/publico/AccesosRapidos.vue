<template>
  <section class="pub-section" aria-labelledby="accesos-title">
    <h2 id="accesos-title" class="pub-section__title"><Icon name="bi-grid" /> Explorá</h2>
    <div class="pub-grid pub-grid--5">
      <router-link v-for="a in accesos" :key="a.to" :to="a.to" class="pub-quick">
        <span class="pub-quick__icon" aria-hidden="true"><Icon :name="a.icon" /></span>
        <h3 class="pub-quick__title">{{ a.title }}</h3>
        <p class="pub-quick__desc">{{ a.desc }}</p>
      </router-link>
    </div>
  </section>
</template>

<script setup>
const accesos = [
  { to: '/ofertas', icon: 'bi-lightning-charge', title: 'Ofertas', desc: 'Promociones vigentes agrupadas por comercio.' },
  { to: '/carga_precio', icon: 'bi-cloud-upload', title: 'Carga comunitaria', desc: 'Sumá los precios que viste en tu compra.' },
  { to: '/estadisticas', icon: 'bi-bar-chart-line', title: 'Estadísticas', desc: 'Variaciones de precios día a día.' }
]
</script>
