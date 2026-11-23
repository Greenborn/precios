<template>
  <form novalidate @submit.prevent>
    <div v-if="cargando" class="text-muted small mb-2" role="status">
      <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Cargando…
    </div>
    <div v-if="error" class="alert alert-danger py-2" role="alert">{{ error }}</div>
    <div v-if="mensaje" class="alert alert-success py-2" role="status">{{ mensaje }}</div>

    <div class="row g-3">
      <div v-for="campo in formulario" :key="campo.nombre" :class="campo.tipo === 'texto_largo' ? 'col-12' : 'col-12 col-md-6'">
        <template v-if="campo.tipo === 'booleano'">
          <div class="form-check">
            <input :id="`perfil-${campo.nombre}`" v-model="valores[campo.nombre]" class="form-check-input" type="checkbox">
            <label class="form-check-label" :for="`perfil-${campo.nombre}`">{{ campo.etiqueta }}</label>
          </div>
        </template>
        <template v-else>
          <label class="form-label" :for="`perfil-${campo.nombre}`">{{ campo.etiqueta }}</label>
          <textarea v-if="campo.tipo === 'texto_largo'" :id="`perfil-${campo.nombre}`" v-model="valores[campo.nombre]" class="form-control" rows="3"></textarea>
          <input v-else :id="`perfil-${campo.nombre}`" v-model="valores[campo.nombre]" class="form-control"
                 :type="campo.tipo === 'numero' ? 'number' : 'text'">
        </template>

        <div v-if="campo.publicable" class="form-check form-switch mt-2">
          <input :id="`perfil-${campo.nombre}-mostrar`" v-model="valores[campo.interruptor]" class="form-check-input" type="checkbox" role="switch">
          <label class="form-check-label small" :for="`perfil-${campo.nombre}-mostrar`">Mostrar en mi perfil público</label>
        </div>
      </div>
    </div>

    <div class="small text-muted mt-3" role="status" aria-live="polite">
      <template v-if="guardando"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Guardando…</template>
      <template v-else-if="hayCambios">Cambios sin guardar…</template>
      <template v-else>Los cambios se guardan automáticamente.</template>
    </div>
  </form>
</template>

<script setup>
import { watch, onBeforeUnmount } from 'vue'
import { usePerfil } from '@greenborn/vue-greenborn-perfil'

// Mismo comportamiento que PerfilEditor del paquete, con controles Bootstrap.
const props = defineProps({
  api: { type: Object, required: true },
  base: { type: String, default: '/api/perfil' },
  campos: { type: Array, required: true },
  terminos: { type: Object, default: () => ({}) },
})

const { formulario, valores, cargando, guardando, error, mensaje, hayCambios, cargar, guardar } =
  usePerfil({ api: props.api, base: props.base, campos: props.campos, terminos: props.terminos })

// Guardado automático con debounce: cada cambio reinicia el temporizador.
const DEBOUNCE_MS = 800
let temporizador = null

async function guardarSiHayCambios() {
  temporizador = null
  if (guardando.value) return reprogramar()
  if (hayCambios.value) {
    await guardar()
    // Si el usuario siguió editando durante el guardado, vuelve a guardar.
    if (hayCambios.value && !error.value) reprogramar()
  }
}

function reprogramar() {
  clearTimeout(temporizador)
  temporizador = setTimeout(guardarSiHayCambios, DEBOUNCE_MS)
}

watch(valores, () => { if (hayCambios.value) reprogramar() }, { deep: true })
onBeforeUnmount(() => {
  clearTimeout(temporizador)
  if (hayCambios.value && !guardando.value) guardar()
})

cargar()
</script>
