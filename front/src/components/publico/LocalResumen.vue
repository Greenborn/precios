<template>
  <div class="card h-100 local-resumen">
    <div class="card-body d-flex flex-column">
      <h3 class="h6 card-title mb-1">{{ local.nombre || 'Local sin nombre' }}</h3>
      <p class="small text-muted mb-3">Código: <code>{{ local.codigo || '—' }}</code></p>

      <dl class="row small mb-3 gy-1">
        <dt class="col-4 text-muted fw-normal">Dirección</dt>
        <dd class="col-8 mb-0">{{ direccion || 'Sin dirección' }}</dd>
        <dt class="col-4 text-muted fw-normal">Ciudad</dt>
        <dd class="col-8 mb-0">{{ local.ciudad || 'Tandil' }}</dd>
        <dt class="col-4 text-muted fw-normal">Ubicación</dt>
        <dd class="col-8 mb-0">
          <span v-if="tieneCoordenadas" class="gb-num">
            <i class="bi bi-pin-map me-1" aria-hidden="true"></i>{{ Number(local.latitud).toFixed(5) }}, {{ Number(local.longitud).toFixed(5) }}
          </span>
          <span v-else class="text-muted">Sin ubicación marcada</span>
        </dd>
      </dl>

      <div class="d-flex flex-wrap justify-content-end gap-2 mt-auto">
        <button type="button" class="btn btn-outline-primary btn-sm" @click="$emit('editar')">
          <i class="bi bi-pencil me-1" aria-hidden="true"></i>Editar
        </button>
        <button type="button" class="btn btn-outline-danger btn-sm" @click="$emit('eliminar')">
          <i class="bi bi-trash me-1" aria-hidden="true"></i>Eliminar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Tarjeta de lectura de un local con sus datos y las operaciones (editar / eliminar).
// La edición se hace en un modal (ver FormularioLocalModal.vue).
const props = defineProps({
  local: { type: Object, required: true },
})
defineEmits(['editar', 'eliminar'])

const direccion = computed(() => [props.local.calle, props.local.numero].filter(Boolean).join(' '))
const tieneCoordenadas = computed(() => props.local.latitud !== null && props.local.latitud !== undefined && props.local.latitud !== '' &&
  props.local.longitud !== null && props.local.longitud !== undefined && props.local.longitud !== '')
</script>
