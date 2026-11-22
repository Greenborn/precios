<template>
<PublicTopBar />

<main class="pub-main" id="privacidad-cnt">
  <div class="pub-container pub-container--narrow">
    <PageHeader title="Política de privacidad" icon="bi-shield-lock" subtitle="Cómo tratamos tus datos personales."
                :breadcrumbs="[{ label: 'Inicio', to: '/' }, { label: 'Política de privacidad' }]" />

    <Card>
      <p>Precios de Tandil es una plataforma comunitaria para comparar precios de comercios locales. Esta política describe qué datos personales se recolectan y para qué se usan.</p>

      <h2 class="h5 mt-4">Datos que recolectamos</h2>
      <ul>
        <li><strong>Cuenta de usuario:</strong> cualquier titular de un negocio puede registrarse con su cuenta de Google. Quienes administran el sitio también tienen una cuenta, con credenciales de acceso.</li>
        <li><strong>Ingreso con Google:</strong> al ingresar mediante Google (a través de nuestro servicio de inicio de sesión único) recibimos y guardamos tu nombre, tu apellido y tu correo electrónico. No accedemos a tu contraseña de Google; en nuestro sistema la cuenta queda con una contraseña propia aleatoria que no se usa para ingresar.</li>
        <li><strong>Perfil comercial:</strong> el nombre del negocio, sus locales con su ubicación en el mapa y los precios que cargues. Esta información es pública y se muestra en el sitio.</li>
        <li><strong>Carga de precios:</strong> los precios, productos y comercios que cargan los usuarios. No se asocian a datos personales del cargador salvo que la carga lo requiera.</li>
        <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador y registros de uso necesarios para la seguridad y el funcionamiento del servicio.</li>
      </ul>

      <h2 class="h5 mt-4">Finalidad</h2>
      <p>Usamos los datos para operar el buscador de precios, gestionar las cargas comunitarias, mantener la seguridad del sistema y responder consultas.</p>

      <h2 class="h5 mt-4">Compartición</h2>
      <p>No vendemos datos personales. Utilizamos a Google como proveedor de autenticación para el ingreso con tu cuenta de Google, por lo que ese proceso se rige además por la política de privacidad de Google. Podemos compartirlos con proveedores de infraestructura que sólo los procesan para prestar el servicio, o cuando una norma legal lo exija.</p>

      <h2 class="h5 mt-4">Tus derechos</h2>
      <p>Podés solicitar acceso, rectificación o eliminación de tus datos personales escribiendo a nuestro perfil oficial de Facebook: <a href="https://www.facebook.com/TandilPreciosBaratos" target="_blank" rel="noopener">TandilPreciosBaratos</a>.</p>

      <h2 class="h5 mt-4">Cambios</h2>
      <p>Podemos actualizar esta política. La versión vigente es la publicada en esta página.</p>

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
