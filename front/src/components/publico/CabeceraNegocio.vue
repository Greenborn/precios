<template>
  <div class="cab-negocio">
    <div class="cab-negocio__portada" :style="portada_url ? { backgroundImage: `url('${portada_url}')` } : {}">
      <button v-if="editable" type="button" class="btn btn-warning btn-sm cab-negocio__editar" @click="elegir('portada')">
        <i class="bi bi-image me-1" aria-hidden="true"></i>Editar portada
      </button>
    </div>
    <div class="cab-negocio__fila">
      <div class="cab-negocio__avatar">
        <img v-if="foto_url" :src="foto_url" :alt="'Foto de ' + nombre">
        <i v-else class="bi bi-shop" aria-hidden="true"></i>
        <button v-if="editable" type="button" class="btn btn-warning btn-sm cab-negocio__avatar-btn" aria-label="Cambiar foto de perfil" @click="elegir('foto')">
          <i class="bi bi-camera" aria-hidden="true"></i>
        </button>
      </div>
      <div class="flex-grow-1 fw-bold fs-5">{{ nombre }}</div>
      <div v-if="editable" class="d-flex gap-2">
        <button v-if="portada_url" type="button" class="btn btn-outline-danger btn-sm" @click="quitar('portada')">Quitar portada</button>
        <button v-if="foto_url" type="button" class="btn btn-outline-danger btn-sm" @click="quitar('foto')">Quitar foto</button>
      </div>
    </div>

    <input ref="entrada" type="file" class="visually-hidden" accept="image/jpeg,image/png,image/webp" @change="al_elegir">
    <p v-if="error" class="small text-danger mt-2 mb-0" role="alert">{{ error }}</p>

    <RecorteModal :archivo="archivo" :ancho="medidas.ancho" :alto="medidas.alto" :circular="tipo === 'foto'"
                  :titulo="tipo === 'foto' ? 'Foto de perfil' : 'Imagen de portada'"
                  :texto-aceptar="tipo === 'foto' ? 'Guardar foto' : 'Guardar portada'"
                  :guardando="guardando" @aceptar="guardar" @cancelar="cerrar" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import RecorteModal from './RecorteModal.vue'
import {
  obtener_mis_imagenes_perfil, obtener_imagenes_publicas_negocio,
  guardar_imagen_perfil, quitar_imagen_perfil, url_absoluta_backend,
} from '../../api/negocio'

// editable = true: "Mi negocio" (dueño). Si no, solo lectura con el id de perfil público.
const props = defineProps({
  nombre: { type: String, default: 'Mi negocio' },
  editable: { type: Boolean, default: false },
  perfilId: { type: [Number, String], default: null },
})

const MAX_BYTES = 8 * 1024 * 1024
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const MEDIDAS = { portada: { ancho: 1600, alto: 533 }, foto: { ancho: 512, alto: 512 } }

const entrada = ref(null)
const archivo = ref(null)
const tipo = ref('portada')
const guardando = ref(false)
const error = ref('')
const portada_url = ref('')
const foto_url = ref('')
const medidas = computed(() => MEDIDAS[tipo.value])

async function cargar() {
  try {
    const d = props.editable
      ? await obtener_mis_imagenes_perfil()
      : (props.perfilId ? await obtener_imagenes_publicas_negocio(props.perfilId) : null)
    portada_url.value = url_absoluta_backend(d?.portada_url) || ''
    foto_url.value = url_absoluta_backend(d?.foto_url) || ''
  } catch (e) { /* sin imágenes: se muestra el encabezado por defecto */ }
}
watch(() => [props.editable, props.perfilId], cargar, { immediate: true })

function elegir(t) {
  tipo.value = t
  error.value = ''
  entrada.value.value = ''
  entrada.value.click()
}

function al_elegir(e) {
  const f = e.target.files?.[0]
  if (!f) return
  if (!TIPOS.includes(f.type)) { error.value = 'Formato no permitido. Se aceptan JPG, PNG o WEBP.'; return }
  if (f.size > MAX_BYTES) { error.value = 'La imagen supera los 8 MB.'; return }
  archivo.value = f
}

function cerrar() { archivo.value = null }

async function guardar(dataUrl) {
  guardando.value = true
  error.value = ''
  try {
    const r = await guardar_imagen_perfil(tipo.value, dataUrl)
    const url = url_absoluta_backend(r.url)
    if (tipo.value === 'foto') foto_url.value = url; else portada_url.value = url
    cerrar()
  } catch (e) {
    error.value = e?.response?.data?.error || 'No se pudo guardar la imagen. Probá de nuevo.'
  } finally {
    guardando.value = false
  }
}

async function quitar(t) {
  error.value = ''
  try {
    await quitar_imagen_perfil(t)
    if (t === 'foto') foto_url.value = ''; else portada_url.value = ''
  } catch (e) {
    error.value = e?.response?.data?.error || 'No se pudo quitar la imagen.'
  }
}
</script>

<style scoped>
.cab-negocio__portada { position: relative; height: 10rem; border-radius: var(--gb-radius, .75rem); background: var(--gb-primary-soft, #dde7ff) center / cover no-repeat; }
.cab-negocio__editar { position: absolute; right: .75rem; bottom: .75rem; }
.cab-negocio__fila { display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap; padding: 0 1rem; margin-top: -2.5rem; }
.cab-negocio__avatar { position: relative; width: 6rem; height: 6rem; border-radius: 50%; border: 4px solid var(--gb-surface, #fff); background: var(--gb-surface-2, #eee); display: grid; place-items: center; font-size: 2rem; flex: none; }
.cab-negocio__avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.cab-negocio__avatar-btn { position: absolute; right: -.25rem; bottom: -.25rem; border-radius: 50%; padding: .25rem .45rem; }
</style>
