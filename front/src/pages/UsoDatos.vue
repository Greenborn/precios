<template>
<PublicTopBar />

<main class="pub-main" id="uso-datos-cnt">
  <div class="pub-container pub-container--narrow">
    <PageHeader title="Uso de datos" icon="bi-database" subtitle="Qué información pública mostramos y de dónde sale."
                :breadcrumbs="[{ label: 'Inicio', to: '/' }, { label: 'Uso de datos' }]" />

    <Card>
      <p>Los precios que se muestran en Precios de Tandil provienen de dos fuentes: canales públicos de comercios y aportes de la comunidad.</p>

      <h2 class="h5 mt-4">Origen de la información</h2>
      <ul>
        <li><strong>Canales públicos:</strong> precios publicados por comercios en medios abiertos, procesados de forma automatizada.</li>
        <li><strong>Aportes de usuarios:</strong> precios cargados voluntariamente desde la sección "Carga de precios".</li>
      </ul>

      <h2 class="h5 mt-4">Qué significa para vos</h2>
      <p>La información es orientativa: puede estar desactualizada o contener errores. Verificá el precio final en el comercio.</p>

      <h2 class="h5 mt-4">Reutilización</h2>
      <p>Los datos de precios se publican sin datos personales de quienes los cargaron. Si detectás información incorrecta o querés que se retire un dato, escribinos a nuestro perfil oficial de Facebook: <a href="https://www.facebook.com/TandilPreciosBaratos" target="_blank" rel="noopener">TandilPreciosBaratos</a>.</p>

      <h2 class="h5 mt-4">Más información</h2>
      <p>El tratamiento de datos personales se describe en la <router-link to="/privacidad">política de privacidad</router-link>.</p>

      <p class="small gb-text-muted mt-4 mb-0">Última actualización: noviembre de 2026.</p>
    </Card>
  </div>
</main>
<PublicFooter />
</template>

<script setup>
    import PublicTopBar from '../components/publico/PublicTopBar.vue';
    import PublicFooter from '../components/publico/PublicFooter.vue';
</script>
