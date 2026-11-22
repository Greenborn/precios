<template>
  <footer class="pub-footer">
    <div class="pub-container">
      <div class="pub-footer__grid">
        <div>
          <p class="pub-footer__brand"><Icon name="bi-tag-fill" /> Precios de Tandil</p>
          <p class="mb-0">Plataforma comunitaria para comparar precios de comercios locales. La información proviene
            de canales públicos y aportes de usuarios: es orientativa.</p>
        </div>
        <nav aria-label="Secciones">
          <h2>Secciones</h2>
          <ul>
            <li><router-link to="/">Buscador</router-link></li>
            <li><router-link to="/ofertas">Ofertas</router-link></li>
            <li><router-link to="/categorias">Categorías</router-link></li>
            <li><router-link to="/carga_precio">Carga de precios</router-link></li>
            <li><router-link to="/novedades">Novedades</router-link></li>
          </ul>
        </nav>
        <div>
          <h2>Comunidad</h2>
          <ul>
            <li><a href="https://www.facebook.com/TandilPreciosBaratos" target="_blank" rel="noopener"><Icon name="bi-facebook" /> TandilPreciosBaratos</a></li>
            <li><a href="https://cafecito.app/tandil_precios" target="_blank" rel="noopener"><Icon name="bi-cup-hot" /> Quiero aportar</a></li>
          </ul>
        </div>
        <nav aria-label="Legal">
          <h2>Legal</h2>
          <ul>
            <li><router-link to="/privacidad">Política de privacidad</router-link></li>
            <li><router-link to="/uso-de-datos">Uso de datos</router-link></li>
          </ul>
        </nav>
      </div>
      <div class="pub-footer__bottom">© {{ anio }} Precios de Tandil · Greenborn</div>
    </div>
  </footer>
</template>

<script setup>
const anio = new Date().getFullYear()
</script>
