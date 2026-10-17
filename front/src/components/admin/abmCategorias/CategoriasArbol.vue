<template>
  <div class="categorias-arbol">
    <div v-if="cargando" class="text-muted small p-2">Cargando categorías...</div>
    <div v-else-if="raices.length === 0" class="text-muted small p-2">No hay categorías</div>
    <ul v-else class="arbol-raiz">
      <NodoArbolCategoria
        v-for="raiz in raices"
        :key="raiz.id"
        :nodo="raiz"
        :seleccionado="seleccionado"
        @seleccionar="onSeleccionar" />
    </ul>
  </div>
</template>

<script setup>
  import { ref, onMounted } from 'vue'
  import { arbol } from '@/api/admin/categorias'
  import NodoArbolCategoria from './NodoArbolCategoria.vue'

  const emit = defineEmits(['rowSelected'])

  const raices = ref([])
  const cargando = ref(true)
  const seleccionado = ref(null)

  function onSeleccionar(nodo) {
    seleccionado.value = nodo
    emit('rowSelected', nodo)
  }

  async function cargar() {
    cargando.value = true
    try {
      const res = await arbol({})
      raices.value = (res && res.stat && res.data?.rows) || []
    } finally {
      cargando.value = false
    }
  }

  defineExpose({ refresh: cargar })

  onMounted(cargar)
</script>

<style scoped>
  .categorias-arbol {
    border: 1px solid var(--bs-border-color, #dee2e6);
    border-radius: 0.375rem;
    padding: 0.5rem;
    max-height: 480px;
    overflow-y: auto;
  }

  .arbol-raiz {
    list-style: none;
    margin: 0;
    padding-left: 0;
  }
</style>
