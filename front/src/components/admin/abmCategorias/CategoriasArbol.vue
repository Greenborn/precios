<template>
  <div class="categorias-arbol">
    <GbTreeView
      ref="arbol_ref"
      :cargar-nodos="cargarNodos"
      campo-tiene-hijos="tiene_hijos"
      texto-cargando="Cargando categorías..."
      texto-vacio="No hay categorías"
      texto-sin-hijos="Sin subcategorías"
      @seleccionar="onSeleccionar">
      <template #nodo="{ nodo }">
        <span class="nodo-nombre">{{ nodo.name }}</span>
        <span class="badge bg-secondary ms-2">{{ nodo.cant_productos }} prod.</span>
      </template>
    </GbTreeView>
  </div>
</template>

<script setup>
  import { ref } from 'vue'
  import { GbTreeView } from 'vue-greenborn-tree-view'
  import 'vue-greenborn-tree-view/style.css'
  import { arbol } from '@/api/admin/categorias'

  const emit = defineEmits(['rowSelected'])

  const arbol_ref = ref()

  // nodoPadre es null para el nivel raiz. Se anota el padre en cada hijo
  // (conocido por contexto) para poder precargar el selector "Categoría
  // padre" al editar desde el arbol.
  async function cargarNodos(nodoPadre) {
    const res = await arbol({ parent_id: nodoPadre ? nodoPadre.id : '' })
    const rows = (res && res.stat && res.data?.rows) || []
    if (!nodoPadre) return rows
    return rows.map(r => ({ ...r, root_category_id: nodoPadre.id, root_category_name: nodoPadre.name }))
  }

  function onSeleccionar(nodo) {
    emit('rowSelected', nodo)
  }

  defineExpose({ refresh: () => arbol_ref.value?.refrescar() })
</script>

<style scoped>
  .categorias-arbol {
    border: 1px solid var(--bs-border-color, #dee2e6);
    border-radius: 0.375rem;
    padding: 0.5rem;
    max-height: 480px;
    overflow-y: auto;
  }

  .nodo-nombre {
    flex: 1;
  }
</style>
