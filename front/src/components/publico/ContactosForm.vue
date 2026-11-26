<template>
  <div class="contactos-fb">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
      <h5 class="mb-0">Datos de contacto y redes</h5>
      <button type="button" class="btn btn-success btn-sm" @click="abrirModal()">
        <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Agregar red o contacto
      </button>
    </div>
    <p class="text-muted small mb-3">
      Se guardan automáticamente. Activá <em>Mostrar en mi perfil</em> para publicar cada dato.
    </p>

    <p v-if="!cargando && !contactos.length" class="text-muted small mb-0">Todavía no agregaste datos de contacto.</p>

    <div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
      <div v-for="c in contactos" :key="c.key" class="col">
        <div class="card h-100 contacto-card">
          <div class="card-body d-flex flex-column gap-2">
            <div class="d-flex align-items-center gap-2">
              <span class="contacto-marca" :style="estiloMarca(c.tipo)">
                <i :class="['bi', definicion(c.tipo).icono]" aria-hidden="true"></i>
              </span>
              <span class="fw-semibold">{{ definicion(c.tipo).label }}</span>
            </div>

            <div class="contacto-valor text-break">
              <a v-if="enlace(c)" :href="enlace(c)" :target="abreEnPestana(c) ? '_blank' : null"
                 :rel="abreEnPestana(c) ? 'noopener noreferrer' : null">{{ c.valor }}</a>
              <span v-else>{{ c.valor }}</span>
            </div>

            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-auto">
              <div class="form-check form-switch mb-0">
                <input :id="`contacto-visible-${c.key}`" v-model="c.visible" class="form-check-input" type="checkbox" role="switch"
                       @change="programarGuardado()">
                <label class="form-check-label small" :for="`contacto-visible-${c.key}`">Mostrar en mi perfil</label>
              </div>
              <div class="d-flex gap-1">
                <button type="button" class="btn btn-outline-primary btn-sm" :aria-label="`Editar ${definicion(c.tipo).label}`"
                        :title="`Editar ${definicion(c.tipo).label}`" @click="abrirModal(c)">
                  <i class="bi bi-pencil" aria-hidden="true"></i>
                </button>
                <button type="button" class="btn btn-outline-danger btn-sm" :aria-label="`Eliminar ${definicion(c.tipo).label}`"
                        :title="`Eliminar ${definicion(c.tipo).label}`" @click="confirmarEliminar(c)">
                  <i class="bi bi-trash" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <p class="form-text mt-3 mb-0" role="status" aria-live="polite">{{ estado }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { AppStore } from '../../stores/app'
import { obtener_mis_contactos, guardar_mis_contactos } from '../../api/negocio'
import { TIPOS_CONTACTO, definicionContacto, urlSegura } from '../../data/contactos'
import FormularioContactoModal from './FormularioContactoModal.vue'

// Mismo tope que valida el backend (MAX_POR_TIPO en helpers/contactos.js)
const MAX_POR_TIPO = 10
const DEBOUNCE_GUARDADO_MS = 800

const storeApp = AppStore()
const contactos = ref([]) // [{ key, tipo, valor, visible, url }]
const cargando = ref(true)
const estado = ref('')
let siguienteKey = 0
let temporizador = null

const definicion = (tipo) => definicionContacto(tipo) || { label: tipo, icono: 'bi-link-45deg', color: '#6c757d' }
const estiloMarca = (tipo) => {
  const def = definicion(tipo)
  return def.degradado ? { background: def.degradado } : { backgroundColor: def.color }
}

// El teléfono se muestra como texto; el resto enlaza al perfil o al chat (ya armado por el backend)
function enlace(c) {
  if (c.tipo === 'telefono') return null
  return urlSegura(c.url)
}
// mailto/tel no necesitan pestaña nueva; el resto sí
const abreEnPestana = (c) => /^https?:/i.test(enlace(c) || '')

function aEntrada(c) {
  return { key: ++siguienteKey, tipo: c.tipo, valor: c.valor || '', visible: c.visible === true, url: c.url || null }
}

async function cargar() {
  try {
    const body = await obtener_mis_contactos()
    contactos.value = (body.contactos || []).map(aEntrada)
  } catch {
    storeApp.mostrar_alerta('No se pudieron cargar los datos de contacto')
  } finally {
    cargando.value = false
  }
}

// Guarda la lista completa: el backend reemplaza cada tipo enviado. Ante un error recarga
// desde el servidor para mostrar lo que realmente quedó guardado.
async function guardar() {
  clearTimeout(temporizador)
  estado.value = 'Guardando…'
  try {
    const body = await guardar_mis_contactos(
      contactos.value.map((c) => ({ tipo: c.tipo, valor: String(c.valor || '').trim(), visible: c.visible === true }))
    )
    contactos.value = (body.contactos || []).map(aEntrada)
    estado.value = body.message || 'Datos de contacto guardados'
    return true
  } catch (err) {
    estado.value = ''
    storeApp.mostrar_alerta(err.response?.data?.error || 'No se pudieron guardar los datos de contacto')
    await cargar()
    return false
  }
}

// Cambios de visibilidad: autoguardado con debounce
function programarGuardado() {
  clearTimeout(temporizador)
  temporizador = setTimeout(guardar, DEBOUNCE_GUARDADO_MS)
}

async function confirmarEliminar(c) {
  storeApp.mostrar_confirm({
    title: 'Eliminar dato de contacto',
    text: `Se quitará ${definicion(c.tipo).label}: ${c.valor}. ¿Continuar?`,
    severity_confirmar: 'danger',
    confirmar_accion: async () => {
      contactos.value = contactos.value.filter((x) => x.key !== c.key)
      await guardar()
    },
  })
}

// Modal de dos pasos (tipo y dato). Devuelve true si se guardó, para que el modal se cierre.
function abrirModal(contacto = null) {
  const llenos = TIPOS_CONTACTO.map((t) => t.tipo).filter((tipo) => contactos.value.filter((c) => c.tipo === tipo).length >= MAX_POR_TIPO)
  const modal_form = storeApp.mostrar_modal(
    FormularioContactoModal,
    contacto ? 'Editar dato de contacto' : 'Agregar red o contacto',
    {
      contacto,
      llenos,
      _callback_guardar: (tipo, valor) => {
        const anterior = contactos.value
        contactos.value = contacto
          ? anterior.map((c) => (c.key === contacto.key ? { ...c, tipo, valor, url: null } : c))
          : [...anterior, { key: ++siguienteKey, tipo, valor, visible: true, url: null }]
        return guardar()
      },
      _cerrar: () => storeApp.ocultar_modal(modal_form.code),
    },
  )
}

onMounted(cargar)
onBeforeUnmount(() => clearTimeout(temporizador))
</script>

<style scoped>
.contacto-card {
  border-radius: 0.75rem;
  border: 1px solid var(--bs-border-color);
  background-color: var(--bs-body-bg);
  color: var(--bs-body-color);
}
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
