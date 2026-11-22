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
      <template #nodo="{ nodo, nivel, abierto }">
        <span class="nodo-icono" :class="'nodo-icono--n' + Math.min(nivel || 0, 3)" aria-hidden="true">
          <Icon :name="icono_nodo(nodo, nivel, abierto)" />
        </span>
        <span class="nodo-nombre">{{ nodo.name }}</span>
        <Badge class="nodo-badge" tone="neutral" size="sm" pill>
          <span class="gb-num">{{ nodo.cant_productos }}</span> prod.
        </Badge>
        <span v-if="acciones" class="nodo-acciones">
          <Button icon="pi-pencil" text rounded size="sm" :ariaLabel="'Editar ' + nodo.name" title="Editar" @click.stop="emit('accion', { accion: 'editar', nodo })" />
          <Button icon="pi-list" text rounded size="sm" :ariaLabel="'Productos de ' + nodo.name" title="Productos" @click.stop="emit('accion', { accion: 'productos', nodo })" />
          <Button icon="pi-tag" text rounded size="sm" :ariaLabel="'Alias de ' + nodo.name" title="Alias" @click.stop="emit('accion', { accion: 'alias', nodo })" />
          <Button icon="pi-trash" severity="danger" text rounded size="sm" :ariaLabel="'Borrar ' + nodo.name" title="Borrar" @click.stop="emit('accion', { accion: 'borrar', nodo })" />
        </span>
      </template>
    </GbTreeView>
  </div>
</template>

<script setup>
  import { ref } from 'vue'
  import { GbTreeView } from '@greenborn/vue-greenborn-tree-view'
  import '@greenborn/vue-greenborn-tree-view/style.css'
  import { arbol } from '@/api/admin/categorias'

  const emit = defineEmits(['rowSelected', 'accion'])
  // acciones: muestra botones on-hover por nodo (emite 'accion'); opcional.
  defineProps({ acciones: { type: Boolean, default: false } })

  function icono_nodo(nodo, nivel, abierto) {
    if (!nivel) return abierto ? 'bi-folder2-open' : 'bi-folder-fill'
    if (nodo.tiene_hijos) return abierto ? 'bi-folder2-open' : 'bi-folder'
    return 'bi-tag'
  }

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
    padding: var(--gb-space-2);
    overflow-y: auto;
    width: 100%;
  }

  .categorias-arbol :deep(.gb-tree-view__fila) {
    border-radius: var(--gb-radius-sm);
    padding-block: 0.3rem;
    transition: background-color var(--gb-transition-fast);
  }
  .categorias-arbol :deep(.gb-tree-view__fila:hover) { background: var(--gb-surface-2); }
  .categorias-arbol :deep(.gb-tree-view__fila--seleccionado),
  .categorias-arbol :deep(.gb-tree-view__fila--seleccionado:hover) {
    background: var(--gb-primary-soft);
    box-shadow: inset 3px 0 0 var(--gb-primary);
  }
  .categorias-arbol :deep(.gb-tree-view__contenido) {
    display: flex; align-items: center; gap: var(--gb-space-2); flex: 1; min-width: 0;
  }

  .nodo-icono { display: inline-flex; font-size: 1rem; }
  .nodo-icono--n0 { color: var(--gb-primary); }
  .nodo-icono--n1 { color: var(--gb-accent); }
  .nodo-icono--n2 { color: var(--gb-info); }
  .nodo-icono--n3 { color: var(--gb-text-muted); }

  .nodo-nombre {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--gb-text);
  }

  .nodo-acciones {
    display: inline-flex;
    gap: 2px;
    opacity: 0;
    transition: opacity var(--gb-transition-fast);
  }
  .categorias-arbol :deep(.gb-tree-view__fila:hover) .nodo-acciones,
  .categorias-arbol :deep(.gb-tree-view__fila:focus-within) .nodo-acciones,
  .categorias-arbol :deep(.gb-tree-view__fila--seleccionado) .nodo-acciones { opacity: 1; }
  @media (hover: none) { .nodo-acciones { opacity: 1; } }
</style>
