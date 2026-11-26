<template>
  <form class="contacto-modal" novalidate @submit.prevent="confirmar">
    <!-- Paso 1: tipo de red o contacto (sólo en alta) -->
    <div v-if="paso === 1">
      <p class="small text-muted mb-2">Elegí el tipo de dato que querés agregar.</p>
      <div class="row row-cols-2 row-cols-sm-3 g-2">
        <div v-for="t in TIPOS_CONTACTO" :key="t.tipo" class="col">
          <button type="button" class="btn btn-outline-secondary w-100 h-100 py-2 tipo-opcion" :disabled="llenos.includes(t.tipo)"
                  :title="llenos.includes(t.tipo) ? `Ya cargaste el máximo de ${MAX_POR_TIPO} de este tipo` : t.label"
                  @click="elegirTipo(t.tipo)">
            <span class="contacto-marca mb-1" :style="estiloMarca(t)"><i :class="['bi', t.icono]" aria-hidden="true"></i></span>
            <span class="d-block small">{{ t.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Paso 2: el dato -->
    <div v-else>
      <div class="d-flex align-items-center gap-2 mb-3">
        <span class="contacto-marca" :style="estiloMarca(definicion)"><i :class="['bi', definicion.icono]" aria-hidden="true"></i></span>
        <span class="fw-semibold">{{ definicion.label }}</span>
        <button v-if="!contacto" type="button" class="btn btn-link btn-sm p-0 ms-auto" @click="paso = 1">Cambiar tipo</button>
      </div>

      <label class="form-label" for="contacto-valor-modal">{{ definicion.label }}</label>
      <input id="contacto-valor-modal" ref="entrada" v-model="valor" class="form-control" :class="{ 'is-invalid': error }"
             :type="tipoInput" :placeholder="definicion.placeholder" maxlength="255" autocomplete="off"
             aria-describedby="contacto-valor-ayuda" :disabled="enviando">
      <div id="contacto-valor-ayuda" class="form-text">{{ definicion.ayuda }}</div>
      <div v-if="error" class="invalid-feedback d-block" role="alert">{{ error }}</div>

      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-secondary" :disabled="enviando" @click="parametros._cerrar?.()">Cancelar</button>
        <button type="submit" class="btn btn-success" :disabled="enviando">
          <span v-if="enviando" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          {{ contacto ? 'Guardar cambios' : 'Agregar' }}
        </button>
      </div>
    </div>
  </form>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { TIPOS_CONTACTO, definicionContacto } from '../../data/contactos'

const MAX_POR_TIPO = 10

// `parametros` llega desde storeApp.mostrar_modal:
//   contacto: { tipo, valor } al editar (sin paso 1); ausente en alta
//   llenos: tipos que ya llegaron al máximo
//   _callback_guardar(tipo, valor) -> Promise<boolean>; si es true el modal se cierra
//   _cerrar(): cierra el modal
const props = defineProps({ parametros: { type: Object, default: () => ({}) } })

const contacto = computed(() => props.parametros?.contacto || null)
const llenos = computed(() => props.parametros?.llenos || [])

const paso = ref(contacto.value ? 2 : 1)
const tipo = ref(contacto.value?.tipo || null)
const valor = ref(contacto.value?.valor || '')
const error = ref('')
const enviando = ref(false)
const entrada = ref(null)

const definicion = computed(() => definicionContacto(tipo.value) || { label: '', icono: 'bi-link-45deg', placeholder: '', ayuda: '' })
const tipoInput = computed(() => {
  if (tipo.value === 'telefono' || tipo.value === 'whatsapp') return 'tel'
  if (tipo.value === 'email') return 'email'
  return 'text'
})
const estiloMarca = (t) => (t.degradado ? { background: t.degradado } : { backgroundColor: t.color })

function elegirTipo(elegido) {
  tipo.value = elegido
  paso.value = 2
  nextTick(() => entrada.value?.focus())
}

async function confirmar() {
  error.value = ''
  const dato = valor.value.trim()
  if (!dato) {
    error.value = 'Ingresá el dato de contacto'
    return
  }
  enviando.value = true
  try {
    const ok = await props.parametros._callback_guardar?.(tipo.value, dato)
    if (ok) props.parametros._cerrar?.()
  } finally {
    enviando.value = false
  }
}

onMounted(() => {
  if (paso.value === 2) nextTick(() => entrada.value?.focus())
})
</script>

<style scoped>
.tipo-opcion { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.contacto-marca {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.5rem;
  color: #fff;
  font-size: 0.95rem;
}
</style>
