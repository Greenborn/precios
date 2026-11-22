<template>
  <router-view v-slot="{ Component, route }">
    <Transition name="gb-route" mode="out-in">
      <div class="gb-route-view" :key="route.matched[0]?.path || route.path">
        <component :is="Component" />
      </div>
    </Transition>
  </router-view>

  <ModalContainer></ModalContainer>
  <!--<ChatBot></ChatBot>-->
  <Spinner :loading="storeApp.loading"></Spinner>
</template>

<script setup >
  import { AppStore } from "./stores/app";
  import { ModalContainer } from '@greenborn/vue-greenborn-modal-manager'
  import '@greenborn/vue-greenborn-modal-manager/style.css'
  import Spinner   from './components/layout/Spinner.vue'
  import ChatBot from "./components/layout/chatbot/ChatBot.vue"

  const storeApp = AppStore()
</script>
