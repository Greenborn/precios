<template>
  <LocalCard :local="parametros?.local || null" :guardando="guardando" :permitir-eliminar="false" @guardar="guardar" />
</template>

<script setup>
import { ref } from 'vue'
import LocalCard from './LocalCard.vue'

// Contenido del modal de alta / edición de local. `parametros` llega desde storeApp.mostrar_modal:
//   local: objeto del local a editar (ausente para alta)
//   _callback_guardar(datos) -> Promise<boolean>: true si se guardó (el modal se cierra)
//   _cerrar(): cierra el modal (lo provee quien lo abre)
const props = defineProps({ parametros: { type: Object, default: () => ({}) } })

const guardando = ref(false)

async function guardar(datos) {
  guardando.value = true
  try {
    const ok = await props.parametros._callback_guardar?.(datos)
    if (ok) props.parametros._cerrar?.()
  } finally {
    guardando.value = false
  }
}
</script>
