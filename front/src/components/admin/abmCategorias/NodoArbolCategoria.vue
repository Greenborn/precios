<template>
  <li class="nodo-arbol">
    <div class="nodo-fila" :class="{ seleccionado: esSeleccionado }" @click="seleccionar">
      <span class="nodo-toggle" @click.stop="toggle">
        <i v-if="nodo.tiene_hijos" :class="abierto ? 'bi bi-dash-square' : 'bi bi-plus-square'"></i>
        <i v-else class="bi bi-dot"></i>
      </span>
      <span class="nodo-nombre">{{ nodo.name }}</span>
      <span class="badge bg-secondary ms-2">{{ nodo.cant_productos }} prod.</span>
    </div>

    <ul v-if="abierto" class="nodo-hijos">
      <li v-if="cargando" class="text-muted small ps-4">Cargando...</li>
      <li v-else-if="hijos.length === 0" class="text-muted small ps-4">Sin subcategorías</li>
      <NodoArbolCategoria
        v-for="hijo in hijos"
        :key="hijo.id"
        :nodo="hijo"
        :seleccionado="seleccionado"
        @seleccionar="$emit('seleccionar', $event)" />
    </ul>
  </li>
</template>

<script setup>
  import { ref, computed } from 'vue'
  import { arbol } from '@/api/admin/categorias'

  const props = defineProps({
    nodo: { type: Object, required: true },
    seleccionado: { type: Object, default: null },
  })
  const emit = defineEmits(['seleccionar'])

  const abierto = ref(false)
  const cargando = ref(false)
  const hijos = ref([])
  const cargado = ref(false)

  const esSeleccionado = computed(() => props.seleccionado && props.seleccionado.id === props.nodo.id)

  function seleccionar() {
    emit('seleccionar', props.nodo)
  }

  async function toggle() {
    if (!props.nodo.tiene_hijos) return
    abierto.value = !abierto.value
    if (abierto.value && !cargado.value) await cargarHijos()
  }

  async function cargarHijos() {
    cargando.value = true
    try {
      const res = await arbol({ parent_id: props.nodo.id })
      const rows = (res && res.stat && res.data?.rows) || []
      // se anota el padre en cada hijo (conocido por contexto) para poder
      // precargar el selector "Categoría padre" al editar desde el arbol
      hijos.value = rows.map(r => ({ ...r, root_category_id: props.nodo.id, root_category_name: props.nodo.name }))
      cargado.value = true
    } finally {
      cargando.value = false
    }
  }
</script>

<style scoped>
  .nodo-arbol {
    list-style: none;
  }

  .nodo-hijos {
    list-style: none;
    margin: 0;
    padding-left: 1.25rem;
  }

  .nodo-fila {
    display: flex;
    align-items: center;
    padding: 0.2rem 0.35rem;
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .nodo-fila:hover {
    background-color: var(--bs-light, #f1f3f5);
  }

  .nodo-fila.seleccionado {
    background-color: var(--bs-primary-bg-subtle, #cfe2ff);
  }

  .nodo-toggle {
    width: 1.25rem;
    display: inline-flex;
    justify-content: center;
    color: #6c757d;
  }

  .nodo-nombre {
    flex: 1;
  }
</style>
