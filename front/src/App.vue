<template>
  <router-view v-slot="{ Component, route }">
    <Transition name="gb-route" mode="out-in">
      <div class="gb-route-view" :key="route.matched[0]?.path || route.path">
        <component :is="Component" />
      </div>
    </Transition>
  </router-view>

  <ModalContainer></ModalContainer>
  <ReporteContextual
    v-if="sgiApiUrl"
    :api-base-url="sgiApiUrl"
    :version="appVersion"
    slug-proyecto="sistema_de_precios"
  />
  <!--<ChatBot></ChatBot>-->
  <Spinner :loading="storeApp.loading"></Spinner>
</template>

<script setup >
  import { AppStore } from "./stores/app";
  import { ModalContainer } from '@greenborn/vue-greenborn-modal-manager'
  import '@greenborn/vue-greenborn-modal-manager/style.css'
  import Spinner   from './components/layout/Spinner.vue'
  import ChatBot from "./components/layout/chatbot/ChatBot.vue"
  import { ReporteContextual } from '@greenborn/vue-greenborn-reporte-contextual'
  import '@greenborn/vue-greenborn-reporte-contextual/style.css'

  const storeApp = AppStore()
  // Base del backend del SGI donde se registran las notas de desarrollo (sin /api).
  // Sin valor, el reporte contextual no se monta.
  const sgiApiUrl = import.meta.env.VITE_SGI_API_URL
  // Versión del front (define de vite.config.js, bumpeada por deploy-update.sh).
  const appVersion = __APP_VERSION__
</script>
