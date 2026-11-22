<template>
  <div class="floating-image" @click="openChatModal">
    <img src="/images/seniora1.png" alt="Imagen" class="image">
    <div class="balloon">
      <div class="balloon-content">
        ¡Hola!
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

import { AppStore } from '../../../stores/app'

import ModalChat from './ModalChat.vue'


const storeApp = AppStore()

async function openChatModal() {
  await storeApp.mostrar_modal(ModalChat, 'Tita', {}, {})
}
</script>

<style scoped>
.floating-image {
  position: fixed;
  bottom: 20px;
  right: 20px;
}

.image {
  width: 8rem;
  height: auto;
  border-radius: 50%;
  cursor: pointer;
}

.balloon {
  position: absolute;
  bottom: 100%;
  right: 50%;
  transform: translateX(50%);
  background-color: var(--gb-surface);
  border-radius: 10px;
  padding: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  transition: opacity 0.3s ease-in-out;
}

.balloon-content {
  font-size: 16px;
  font-weight: bold;
}

.balloon-visible {
  opacity: 1;
}

.image:hover + .balloon,
.balloon:hover {
  opacity: 1;
}
</style>