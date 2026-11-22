<template>
  <PublicTopBar @buscar_evnt="buscar" />

  <main class="pub-main" id="contenido">
    <div class="pub-container">
      <BusquedaPrincipal ref="busqueda_y_carga">
        <AccesosRapidos />
      </BusquedaPrincipal>
    </div>
  </main>

  <PublicFooter />
</template>

<script setup>
import { ref } from 'vue'
import PublicTopBar from "../components/publico/PublicTopBar.vue";
import BusquedaPrincipal from "../components/publico/BusquedaPrincipal.vue";
import AccesosRapidos from "../components/publico/AccesosRapidos.vue";
import PublicFooter from "../components/publico/PublicFooter.vue";

const busqueda_y_carga = ref()

async function buscar( termino_busqueda ){
  await busqueda_y_carga.value.buscar(termino_busqueda)
}
</script>
