<template>
  <div v-if="archivo" class="recorte-backdrop" role="dialog" aria-modal="true" :aria-label="titulo" @keydown.esc="$emit('cancelar')">
    <div class="recorte-dialog">
      <h2 class="h5 mb-1">{{ titulo }}</h2>
      <p class="form-text mt-0">Arrastrá la imagen para encuadrarla (en el celular, pellizcá con dos dedos para acercar o alejar). También podés usar las flechas del teclado y + / − para el zoom.</p>

      <div :class="{ 'recorte-marco-circular': circular }" :style="{ maxWidth: circular ? '20rem' : '100%' }">
        <canvas ref="lienzo" class="recorte-lienzo" :class="{ 'recorte-lienzo-circular': circular }"
                :width="ancho" :height="alto" :style="{ aspectRatio: `${ancho} / ${alto}` }"
                tabindex="0" role="application" aria-label="Vista previa del encuadre"
                @pointerdown="onPuntero" @pointermove="onPunteroMueve" @pointerup="onPunteroFin"
                @pointercancel="onPunteroFin" @keydown="onTecla"></canvas>
      </div>

      <label class="form-label mt-3" for="recorte-zoom">Tamaño de la imagen (zoom)</label>
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-zoom-out" aria-hidden="true"></i>
        <input id="recorte-zoom" v-model.number="zoom" type="range" class="form-range flex-grow-1" min="1" max="3" step="0.01" @input="dibujar">
        <i class="bi bi-zoom-in" aria-hidden="true"></i>
      </div>

      <p v-if="error" class="small text-danger mb-0" role="alert">{{ error }}</p>
      <div class="d-flex flex-wrap justify-content-end gap-2 mt-3">
        <button type="button" class="btn btn-outline-secondary me-auto" :disabled="guardando" @click="$emit('cambiar')">
          <i class="bi bi-camera me-1" aria-hidden="true"></i>Cambiar foto
        </button>
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
const emit = defineEmits(['aceptar', 'cancelar', 'cambiar'])

const ZOOM_MIN = 1, ZOOM_MAX = 3
const limitar = (v, min, max) => Math.min(max, Math.max(min, v))

const lienzo = ref(null)
const imagen = ref(null)
const zoom = ref(ZOOM_MIN)
const error = ref('')
let panX = 0, panY = 0
// Punteros activos (pointerId -> posición actual). Con uno: arrastre. Con dos: pinch zoom.
const punteros = new Map()
let distanciaInicial = 0, zoomInicial = ZOOM_MIN
let observador = null
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
    programarDibujo()
    lienzo.value?.focus()
  } catch {
    error.value = 'No se pudo abrir la imagen. Probá con otro archivo.'
  }
}, { immediate: true })

// Dibujar después del primer frame: si se hace antes del layout, el lienzo puede quedar negro.
function programarDibujo() {
  nextTick(() => requestAnimationFrame(dibujar))
}

// Redibuja cuando la imagen está lista y cada vez que cambia el tamaño del lienzo.
watch(imagen, (img) => { if (img) programarDibujo() }, { flush: 'post' })
watch(lienzo, (el) => {
  observador?.disconnect()
  observador = null
  if (!el) return
  if (typeof ResizeObserver !== 'undefined') {
    observador = new ResizeObserver(() => dibujar())
    observador.observe(el)
  }
  programarDibujo()
}, { flush: 'post' })

onBeforeUnmount(() => {
  liberar()
  observador?.disconnect()
})

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

const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

function onPuntero(e) {
  punteros.set(e.pointerId, { x: e.clientX, y: e.clientY })
  e.currentTarget.setPointerCapture?.(e.pointerId)
  if (punteros.size === 2) {
    // Empieza el pinch: se toma la distancia y el zoom de partida
    const [a, b] = punteros.values()
    distanciaInicial = distancia(a, b)
    zoomInicial = zoom.value
  }
}
function onPunteroMueve(e) {
  const previo = punteros.get(e.pointerId)
  if (!previo) return
  const actual = { x: e.clientX, y: e.clientY }
  const factor = props.ancho / (e.currentTarget.getBoundingClientRect().width || props.ancho)
  if (punteros.size >= 2) {
    // Pinch zoom: la relación entre la distancia actual y la inicial define el zoom
    punteros.set(e.pointerId, actual)
    const [a, b] = punteros.values()
    const d = distancia(a, b)
    if (distanciaInicial > 0) zoom.value = limitar(zoomInicial * d / distanciaInicial, ZOOM_MIN, ZOOM_MAX)
  } else {
    // Arrastre con un dedo (o con el mouse)
    panX += (actual.x - previo.x) * factor
    panY += (actual.y - previo.y) * factor
    punteros.set(e.pointerId, actual)
  }
  dibujar()
}
// Si queda un dedo tras un pinch, el arrastre continúa desde su posición actual (ya registrada).
function onPunteroFin(e) {
  punteros.delete(e.pointerId)
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
