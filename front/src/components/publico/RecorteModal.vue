<template>
  <div v-if="archivo" class="recorte-backdrop" role="dialog" aria-modal="true" :aria-label="titulo" @keydown.esc="$emit('cancelar')">
    <div class="recorte-dialog">
      <h2 class="h5 mb-1">{{ titulo }}</h2>
      <p class="form-text mt-0">Arrastrá la imagen para encuadrarla, o usá las flechas del teclado para moverla y + / − para acercar y alejar.</p>

      <div :class="{ 'recorte-marco-circular': circular }" :style="{ maxWidth: circular ? '20rem' : '100%' }">
        <canvas ref="lienzo" class="recorte-lienzo" :class="{ 'recorte-lienzo-circular': circular }"
                :width="ancho" :height="alto" :style="{ aspectRatio: `${ancho} / ${alto}` }"
                tabindex="0" role="application" aria-label="Vista previa del encuadre"
                @pointerdown="onPuntero" @pointermove="onPunteroMueve" @pointerup="arrastrando = false"
                @pointercancel="arrastrando = false" @keydown="onTecla"></canvas>
      </div>

      <label class="form-label mt-3" for="recorte-zoom">Tamaño de la imagen (zoom)</label>
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-zoom-out" aria-hidden="true"></i>
        <input id="recorte-zoom" v-model.number="zoom" type="range" class="form-range flex-grow-1" min="1" max="3" step="0.01" @input="dibujar">
        <i class="bi bi-zoom-in" aria-hidden="true"></i>
      </div>

      <p v-if="error" class="small text-danger mb-0" role="alert">{{ error }}</p>
      <div class="d-flex flex-wrap justify-content-end gap-2 mt-3">
        <button type="button" class="btn btn-secondary" :disabled="guardando" @click="$emit('cancelar')">Cancelar</button>
        <button type="button" class="btn btn-success" :disabled="guardando || !imagen" @click="aceptar">
          <i class="bi bi-check2 me-1" aria-hidden="true"></i>{{ guardando ? 'Guardando…' : textoAceptar }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'

// Editor de encuadre: recibe un File, lo recorta a ancho x alto (arrastre, zoom, teclado)
// y emite la imagen resultante como data URL JPEG. El guardado lo hace quien lo usa.
const props = defineProps({
  archivo: { type: Object, default: null },
  ancho: { type: Number, required: true },
  alto: { type: Number, required: true },
  circular: { type: Boolean, default: false },
  titulo: { type: String, default: 'Encuadrar imagen' },
  textoAceptar: { type: String, default: 'Aceptar' },
  guardando: { type: Boolean, default: false },
})
const emit = defineEmits(['aceptar', 'cancelar'])

const ZOOM_MIN = 1, ZOOM_MAX = 3
const limitar = (v, min, max) => Math.min(max, Math.max(min, v))

const lienzo = ref(null)
const imagen = ref(null)
const zoom = ref(ZOOM_MIN)
const error = ref('')
let panX = 0, panY = 0, ultimoX = 0, ultimoY = 0
const arrastrando = ref(false)
let urlObjeto = ''

function liberar() {
  if (urlObjeto) URL.revokeObjectURL(urlObjeto)
  urlObjeto = ''
}

watch(() => props.archivo, async (archivo) => {
  liberar()
  imagen.value = null
  error.value = ''
  if (!archivo) return
  urlObjeto = URL.createObjectURL(archivo)
  try {
    imagen.value = await new Promise((ok, ko) => {
      const img = new Image()
      img.onload = () => ok(img)
      img.onerror = () => ko(new Error('imagen ilegible'))
      img.src = urlObjeto
    })
    zoom.value = ZOOM_MIN; panX = 0; panY = 0
    await nextTick()
    dibujar()
    lienzo.value?.focus()
  } catch {
    error.value = 'No se pudo abrir la imagen. Probá con otro archivo.'
  }
}, { immediate: true })

onBeforeUnmount(liberar)

// Dibuja en cuanto existen a la vez el lienzo y la imagen. Antes sólo se dibujaba al cargar la
// imagen: si el lienzo todavía no estaba montado, quedaba el fondo negro hasta mover el zoom.
watch([lienzo, imagen], () => dibujar(), { flush: 'post' })

const escala = () => Math.max(props.ancho / imagen.value.width, props.alto / imagen.value.height) * zoom.value

function dibujar() {
  const img = imagen.value
  if (!lienzo.value || !img) return
  const dw = img.width * escala(), dh = img.height * escala()
  // La imagen siempre cubre todo el recorte (sin huecos)
  panX = limitar(panX, -Math.max(0, (dw - props.ancho) / 2), Math.max(0, (dw - props.ancho) / 2))
  panY = limitar(panY, -Math.max(0, (dh - props.alto) / 2), Math.max(0, (dh - props.alto) / 2))
  const ctx = lienzo.value.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, props.ancho, props.alto)
  ctx.drawImage(img, (props.ancho - dw) / 2 + panX, (props.alto - dh) / 2 + panY, dw, dh)
}

function onPuntero(e) {
  arrastrando.value = true
  ultimoX = e.clientX; ultimoY = e.clientY
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onPunteroMueve(e) {
  if (!arrastrando.value) return
  const factor = props.ancho / (e.currentTarget.getBoundingClientRect().width || props.ancho)
  panX += (e.clientX - ultimoX) * factor
  panY += (e.clientY - ultimoY) * factor
  ultimoX = e.clientX; ultimoY = e.clientY
  dibujar()
}
function onTecla(e) {
  const paso = e.shiftKey ? 50 : 10
  const mov = { ArrowLeft: [paso, 0], ArrowRight: [-paso, 0], ArrowUp: [0, paso], ArrowDown: [0, -paso] }[e.key]
  if (mov) { panX += mov[0]; panY += mov[1] }
  else if (e.key === '+' || e.key === '=') zoom.value = limitar(zoom.value + 0.1, ZOOM_MIN, ZOOM_MAX)
  else if (e.key === '-' || e.key === '_') zoom.value = limitar(zoom.value - 0.1, ZOOM_MIN, ZOOM_MAX)
  else return
  e.preventDefault()
  dibujar()
}

function aceptar() {
  if (!imagen.value) return
  emit('aceptar', lienzo.value.toDataURL('image/jpeg', 0.9))
}
</script>

<style scoped>
.recorte-backdrop { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,.55); display: grid; place-items: center; padding: 1rem; overflow: auto; }
.recorte-dialog { background: var(--gb-surface, #fff); border-radius: var(--gb-radius, .75rem); padding: 1.25rem; width: min(640px, 100%); max-height: 100%; overflow: auto; }
.recorte-lienzo { display: block; width: 100%; height: auto; border-radius: .5rem; border: 1px solid var(--bs-border-color, #ccc); background: #000; cursor: grab; touch-action: none; user-select: none; }
.recorte-lienzo:active { cursor: grabbing; }
.recorte-lienzo-circular { border-radius: 50%; }
.recorte-marco-circular { margin-inline: auto; }
.recorte-lienzo:focus-visible { outline: 3px solid #0b3d91; outline-offset: 2px; }
</style>
