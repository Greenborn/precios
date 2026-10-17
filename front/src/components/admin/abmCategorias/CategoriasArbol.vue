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
  const filtro = ref('')

  // nodoPadre es null para el nivel raiz. Se anota el padre en cada hijo
  // (conocido por contexto) para poder precargar el selector "Categoría
  // padre" al editar desde el arbol. El filtro por nombre solo se aplica al
  // nivel raiz: el backend ignora la jerarquia y busca en todas las
  // categorias, mostrando como "raiz" cualquier coincidencia (se puede
  // seguir expandiendo para ver sus hijos reales).
  async function cargarNodos(nodoPadre) {
    const res = await arbol({ parent_id: nodoPadre ? nodoPadre.id : '', search: nodoPadre ? '' : filtro.value })
    const rows = (res && res.stat && res.data?.rows) || []
    if (!nodoPadre) return rows
    return rows.map(r => ({ ...r, root_category_id: nodoPadre.id, root_category_name: nodoPadre.name }))
  }

  function onSeleccionar(nodo) {
    emit('rowSelected', nodo)
  }

  function filtrar(texto) {
    filtro.value = texto || ''
    arbol_ref.value?.refrescar()
  }

  defineExpose({ refresh: () => arbol_ref.value?.refrescar(), filtrar })
</script>

<style scoped>
  .categorias-arbol {
    border: 1px solid var(--bs-border-color, #dee2e6);
    border-radius: 0.375rem;
    padding: 0.5rem;
    max-height: 480px;
    overflow-y: auto;
    width: 100%;
  }

  .nodo-nombre {
    flex: 1;
  }
</style>
