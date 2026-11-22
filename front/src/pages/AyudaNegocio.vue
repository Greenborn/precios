<template>
<PublicTopBar />

<main class="pub-main" id="ayuda-negocio-cnt">
  <div class="pub-container pub-container--narrow">
    <PageHeader title="Cargá los precios de tu negocio" icon="bi-shop-window"
                subtitle="Cómo publicar y mantener actualizados los precios de tu comercio."
                :breadcrumbs="[{ label: 'Inicio', to: '/' }, { label: 'Ayuda para negocios' }]" />

    <Card>
      <p>Si tenés un negocio en Tandil, podés cargar tus propios precios para que los vecinos los encuentren.</p>

      <h2 class="h5 mt-4">Paso a paso</h2>
      <ol>
        <li><strong>Registrate con tu cuenta de Google.</strong> Es el único método de ingreso: no necesitás crear una contraseña nueva.</li>
        <li>Una vez dentro, abrí el menú de tu usuario y entrá a <strong>Perfil Comercial</strong>.</li>
        <li>Completá los datos de tu negocio y agregá al menos un local.</li>
        <li>En la pestaña de precios, cargá tus productos y sus precios. Podés actualizarlos cuando cambien.</li>
      </ol>

      <div class="mt-4">
        <router-link to="/admin/login" class="btn btn-primary">
          <Icon name="bi-google" class="me-1" /> Registrarme / ingresar con Google
        </router-link>
      </div>

      <p class="small gb-text-muted mt-4 mb-0">Tratamos tus datos según la <router-link to="/privacidad">política de privacidad</router-link>.</p>
    </Card>
  </div>
</main>
<PublicFooter />
</template>

<script setup>
    import PublicTopBar from '../components/publico/PublicTopBar.vue';
    import PublicFooter from '../components/publico/PublicFooter.vue';
</script>
