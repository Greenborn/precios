<template>
  <div class="modal-chat">
    <div class="modal-chat-mensajes">
      <div v-for="mensaje in mensajes" :key="mensaje.id" class="mensaje">
        <span class="nombre">{{ mensaje.nombre }}</span>
        <span class="texto">{{ mensaje.texto }}</span>
        <span class="hora">{{ mensaje.hora }}</span>
      </div>
    </div>
    <div class="modal-chat-enviar">
      <input type="text" v-model="mensaje" placeholder="Escribe un mensaje..." aria-label="Mensaje">
      <button @click="enviarMensaje">Enviar</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

import { chat_bot_rsp } from '../../../api/public/publicEndpoints'
import { v7 as uuid } from 'uuid'

const interlocutor = ref('Tita')
const mensajes = ref([
  { id: 0, nombre: interlocutor.value, texto: 'Hola, ¿cómo estás?', hora: '10:00' },
])
const mensaje = ref('')
const user_id = ref(uuid())

function cerrarChat() {
  // Cerrar el chat
}

async function enviarMensaje() {
  let hora = new Date()
  // Enviar el mensaje
  const nuevoMensaje = {
    'id': mensajes.value.length + 1,
    'nombre': 'Yo',
    'texto': mensaje.value,
    'hora': hora,
  }
  mensajes.value.push(nuevoMensaje)

  let res = await chat_bot_rsp({ texto: nuevoMensaje.texto, user_id: user_id.value })
  if (res.stat){
    const nuevoMensaje = {
      'id': mensajes.value.length + 1,
      'nombre': interlocutor.value,
      'texto': res.msg,
      'hora': new Date(),
    }
    mensajes.value.push(nuevoMensaje)
  }
  mensaje.value = ''
}
</script>

<style scoped>
.modal-chat {
  width: min(400px, 100%);
  height: 600px;
  background-color: var(--gb-surface);
  border: 1px solid var(--gb-border);
  border-radius: var(--gb-radius);
  padding: 20px;
}

.modal-chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--gb-border);
}

.modal-chat-mensajes {
  padding: 20px;
  overflow-y: auto;
  height: 400px;
}

.mensaje {
  margin-bottom: 10px;
  padding: 10px;
  background-color: var(--gb-surface-2);
  border-radius: var(--gb-radius);
}

.nombre {
  font-weight: bold;
}

.texto {
  margin-left: 10px;
}

.hora {
  font-size: 12px;
  color: var(--gb-text-muted);
  margin-left: 10px;
}

.modal-chat-enviar {
  padding: 20px;
  border-top: 1px solid var(--gb-border);
}

input[type="text"] {
  width: 100%;
  height: 40px;
  padding: 10px;
  font-size: 16px;
  border: 1px solid var(--gb-border);
  border-radius: var(--gb-radius);
}

button {
  width: 100%;
  height: 40px;
  padding: 10px;
  font-size: 16px;
  background-color: var(--gb-primary);
  color: var(--gb-on-primary);
  border: none;
  border-radius: var(--gb-radius);
  cursor: pointer;
}

button:hover {
  background-color: var(--gb-primary-hover);
}
</style>