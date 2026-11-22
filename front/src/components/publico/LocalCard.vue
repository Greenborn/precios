<template>
  <div class="card h-100">
    <div class="card-body">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
        <h3 class="h6 card-title mb-0">{{ nuevo ? 'Nuevo local' : (local.nombre || 'Local sin nombre') }}</h3>
        <span v-if="!nuevo" class="badge" :class="form.publicado ? 'text-bg-success' : 'text-bg-secondary'">
          {{ form.publicado ? 'Visible en el mapa' : 'Oculto' }}
        </span>
      </div>
      <p v-if="!nuevo" class="small text-muted mb-3">Código: <code>{{ local.codigo || '—' }}</code></p>
      <p v-else class="small text-muted mb-3">Cada local nuevo recibe un código identificador. No se permiten locales duplicados (mismo nombre, dirección y ciudad).</p>

      <div class="row g-3">
        <div class="col-12">
          <label class="form-label" :for="id('nombre')">Nombre del local <span class="text-danger" aria-hidden="true">*</span></label>
          <input :id="id('nombre')" v-model="form.nombre" class="form-control" maxlength="120" autocomplete="off" required>
        </div>
        <div class="col-12 col-sm-8">
          <label class="form-label" :for="id('calle')">Calle</label>
          <input :id="id('calle')" v-model="form.calle" class="form-control" maxlength="120" placeholder="Av. Rivadavia" autocomplete="off">
        </div>
        <div class="col-12 col-sm-4">
          <label class="form-label" :for="id('numero')">Número</label>
          <input :id="id('numero')" v-model="form.numero" class="form-control" maxlength="10" placeholder="1234" autocomplete="off">
        </div>
        <div class="col-12">
          <label class="form-label" :for="id('ciudad')">Ciudad</label>
          <input :id="id('ciudad')" v-model="form.ciudad" class="form-control" maxlength="80" autocomplete="off">
        </div>
      </div>

      <div class="mt-4">
        <label class="form-label fw-semibold">Ubicación en el mapa</label>
        <p class="form-text mt-0">Usá tu ubicación actual (GPS) o marcá el punto en el mapa.</p>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-info btn-sm" :disabled="gpsCargando" @click="usarGps">
            <i class="bi bi-geo-alt me-1" aria-hidden="true"></i>{{ gpsCargando ? 'Obteniendo ubicación…' : 'Usar mi ubicación (GPS)' }}
          </button>
          <button type="button" class="btn btn-secondary btn-sm" @click="elegirEnMapa">
            <i class="bi bi-map me-1" aria-hidden="true"></i>Elegir en el mapa
          </button>
          <button v-if="tieneCoordenadas" type="button" class="btn btn-danger btn-sm" @click="quitarUbicacion">
            <i class="bi bi-x-circle me-1" aria-hidden="true"></i>Quitar ubicación
          </button>
        </div>
        <p v-if="tieneCoordenadas" class="small mt-2 mb-0">
          <i class="bi bi-pin-map me-1" aria-hidden="true"></i>Lat {{ Number(form.latitud).toFixed(5) }}, Lng {{ Number(form.longitud).toFixed(5) }}
        </p>
        <p v-else class="small text-muted mt-2 mb-0">Sin ubicación marcada.</p>
        <div v-if="gpsError" class="alert alert-warning py-2 mt-2 mb-0">{{ gpsError }}</div>
      </div>

      <div class="card bg-light border-0 mt-4">
        <div class="card-body py-2">
          <div class="form-check form-switch">
            <input :id="id('publicado')" v-model="form.publicado" class="form-check-input" type="checkbox" role="switch">
            <label class="form-check-label fw-semibold" :for="id('publicado')">Mostrar este local en el mapa público</label>
          </div>
          <p class="small text-muted mb-0 mt-1">Si está apagado, el local no aparece en tu ficha pública ni en el mapa.</p>
        </div>
      </div>

      <div class="d-flex flex-wrap justify-content-between gap-2 mt-3">
        <button v-if="!nuevo" type="button" class="btn btn-outline-danger btn-sm" :disabled="guardando" @click="$emit('eliminar')">
          <i class="bi bi-trash me-1" aria-hidden="true"></i>Eliminar
        </button>
        <span v-else></span>
        <button type="button" class="btn btn-primary btn-sm" :disabled="guardando || (!nuevo && !hayCambios)" @click="guardar">
          <span v-if="guardando" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          {{ nuevo ? 'Crear local' : 'Guardar cambios' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useMapSelector } from '@greenborn/vue-greenborn-map-selector'

// Tarjeta de un local (nuevo o existente). El guardado lo hace quien la usa:
// emite `guardar(datos)` con la forma que espera la API de locales.
const props = defineProps({
  local: { type: Object, default: null },
  guardando: { type: Boolean, default: false },
  // Centro del mapa cuando el local todavía no tiene coordenadas (Tandil)
  centro: { type: Object, default: () => ({ lat: -37.3217, lng: -59.1332 }) },
})
const emit = defineEmits(['guardar', 'eliminar'])

const nuevo = computed(() => !props.local)
const uid = props.local?.id ?? 'nuevo'
const id = (c) => `local-${uid}-${c}`

const vacio = () => ({ nombre: '', calle: '', numero: '', ciudad: '', latitud: '', longitud: '', publicado: false })
const desde = (l) => l ? {
  nombre: l.nombre || '', calle: l.calle || '', numero: l.numero || '', ciudad: l.ciudad || '',
  latitud: l.latitud ?? '', longitud: l.longitud ?? '', publicado: !!l.publicado,
} : vacio()

const form = ref(desde(props.local))
watch(() => props.local, (l) => { form.value = desde(l) })

const hayCambios = computed(() => JSON.stringify(form.value) !== JSON.stringify(desde(props.local)))
const tieneCoordenadas = computed(() => form.value.latitud !== '' && form.value.longitud !== '' && form.value.latitud !== null)

const gpsCargando = ref(false)
const gpsError = ref('')
const MENSAJES_GPS = {
  1: 'Diste permiso denegado para ver tu ubicación. Podés marcarla en el mapa.',
  2: 'No pudimos determinar tu ubicación. Probá de nuevo o marcala en el mapa.',
  3: 'Se agotó el tiempo para obtener tu ubicación. Probá de nuevo o marcala en el mapa.',
}

function usarGps() {
  gpsError.value = ''
  if (!navigator.geolocation) { gpsError.value = 'Tu navegador no permite obtener la ubicación. Marcala en el mapa.'; return }
  gpsCargando.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      form.value.latitud = pos.coords.latitude.toFixed(7)
      form.value.longitud = pos.coords.longitude.toFixed(7)
      gpsCargando.value = false
    },
    (err) => { gpsError.value = MENSAJES_GPS[err.code] || 'No se pudo obtener tu ubicación.'; gpsCargando.value = false },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  )
}

function elegirEnMapa() {
  const { abrir } = useMapSelector()
  abrir({
    titulo: 'Ubicación del local',
    initialLat: tieneCoordenadas.value ? form.value.latitud : props.centro.lat,
    initialLng: tieneCoordenadas.value ? form.value.longitud : props.centro.lng,
    onSelect: ({ lat, lng }) => { form.value.latitud = String(lat); form.value.longitud = String(lng) },
  })
}

function quitarUbicacion() { form.value.latitud = ''; form.value.longitud = '' }

const coord = (v) => { const s = String(v ?? '').trim().replace(',', '.'); return s === '' ? null : Number(s) }

function guardar() {
  const f = form.value
  emit('guardar', {
    nombre: f.nombre.trim(),
    calle: f.calle.trim() || null,
    numero: f.numero.trim() || null,
    ciudad: f.ciudad.trim() || null,
    latitud: coord(f.latitud),
    longitud: coord(f.longitud),
    publicado: f.publicado,
  }, () => { if (nuevo.value) form.value = vacio() })
}
</script>
