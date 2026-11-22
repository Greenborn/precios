<template>
  <div class="datatable-local" :class="{ 'dt-compact': compact, 'dt-sticky': stickyHeader, 'dt-hover': hoverable, 'dt-card': card }">
    <div v-if="$slots.header" class="datatable-header">
      <slot name="header"></slot>
    </div>

    <div class="table-wrap">
      <table class="table table-sm mb-0" :class="{ 'table-striped': striped, 'table-bordered': gridLines }" :aria-busy="loading ? 'true' : null">
        <thead>
          <tr>
            <th v-if="selectionMode" class="dt-col-select"><span class="visually-hidden">Selección</span></th>
            <th
              v-for="col in columns"
              :key="col.field"
              :style="col.headerStyle"
              class="dthead"
              :aria-sort="sort.field === col.field ? (sort.direction === 'asc' ? 'ascending' : 'descending') : null"
            >
              <span
                :class="{ 'sort-click': col.sortable !== false }"
                :tabindex="col.sortable !== false ? 0 : null"
                @click="sortToggle(col)"
                @keydown.enter.prevent="sortToggle(col)"
              >
                {{ col.header }}
              </span>
              <Icon
                v-if="sort.field === col.field"
                :name="sort.direction === 'asc' ? 'pi-chevron-up' : 'pi-chevron-down'"
                class="ms-1 dt-sort-icon"
              />
            </th>
          </tr>
          <tr v-if="showFilterRow">
            <th v-if="selectionMode"></th>
            <th v-for="col in columns" :key="'f-' + col.key">
              <input
                v-if="filters[col.field]"
                class="form-control form-control-sm desc-filter"
                :aria-label="'Filtrar ' + (col.header || col.field)"
                :value="filters[col.field].value"
                placeholder=""
                @input="onFilterInput(col.field, $event.target.value)"
              />
            </th>
          </tr>
        </thead>

        <tbody v-if="loading">
          <tr v-for="n in skeletonRows" :key="'sk-' + n" class="dt-skeleton-row">
            <td v-if="selectionMode"></td>
            <td v-for="col in columns" :key="col.key || col.field"><Skeleton :width="(50 + (n * 13) % 45) + '%'" /></td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr
            v-for="(row, i) in pagedRows"
            :key="rowKey(row, i)"
            @click="onRowClick(row)"
            @dblclick="onRowDblClick(row)"
            :class="{ 'row-selected': isSelected(row) }"
          >
            <td v-if="selectionMode" class="text-center">
              <input
                class="form-check-input"
                :type="selectionMode === 'multiple' ? 'checkbox' : 'radio'"
                aria-label="Seleccionar fila"
                :checked="isSelected(row)"
                @click.stop
              />
            </td>
            <td v-for="col in columns" :key="col.key">{{ row[col.field] }}</td>
          </tr>
          <tr v-if="pagedRows.length === 0" class="dt-empty-row">
            <td :colspan="colspanCount">
              <slot name="empty">
                <EmptyState :title="emptyMessage" icon="bi-inbox" size="sm" />
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="paginator && !loading" class="datatable-pager">
      <div class="dtext gb-num">{{ pageReport }}</div>
      <div class="controls">
        <input
          v-if="rowsPerPageOptions.length"
          type="number"
          class="form-control form-control-sm rows-input"
          :value="rows"
          aria-label="Filas por página"
          @change="changeRows($event)"
        />
        <button type="button" class="dt-page" :disabled="page <= 1" aria-label="Primera página" @click="goTo(1)"><Icon name="bi-chevron-double-left" /></button>
        <button type="button" class="dt-page" :disabled="page <= 1" aria-label="Página anterior" @click="goTo(page - 1)"><Icon name="bi-chevron-left" /></button>
        <button
          v-for="p in pageList"
          :key="p"
          type="button"
          class="dt-page gb-num"
          :class="{ 'is-active': p === page }"
          :aria-current="p === page ? 'page' : null"
          @click="goTo(p)"
        >{{ p }}</button>
        <button type="button" class="dt-page" :disabled="page >= pageCount" aria-label="Página siguiente" @click="goTo(page + 1)"><Icon name="bi-chevron-right" /></button>
        <button type="button" class="dt-page" :disabled="page >= pageCount" aria-label="Última página" @click="goTo(pageCount)"><Icon name="bi-chevron-double-right" /></button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Icon from './Icon.vue'
import Skeleton from './Skeleton.vue'
import EmptyState from './EmptyState.vue'

const props = defineProps({
  value: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  striped: { type: Boolean, default: false },
  gridLines: { type: Boolean, default: false },
  showFilterRow: { type: Boolean, default: false },
  filters: { type: Object, default: () => ({}) },
  globalFilterFields: { type: Array, default: () => [] },
  paginator: { type: Boolean, default: false },
  rows: { type: Number, default: 10 },
  rowsPerPageOptions: { type: Array, default: () => [] },
  pageReportTemplate: { type: String, default: 'Mostrando {first} a {last} de {totalRecords}' },
  selection: { type: Array, default: () => [] },
  selectionMode: { type: String, default: 'single' },
  emptyMessage: { type: String, default: 'Sin registros' },
  // Nuevos (opcionales)
  loading: { type: Boolean, default: false },
  skeletonRows: { type: Number, default: 5 },
  compact: { type: Boolean, default: false },
  hoverable: { type: Boolean, default: true },
  stickyHeader: { type: Boolean, default: true },
  card: { type: Boolean, default: false }
})

const emit = defineEmits(['update:selection', 'row-select', 'row-unselect', 'row-dblclick', 'row-click', 'update:rows'])

const sort = ref({ field: null, direction: null })
const page = ref(1)

const globalQuery = computed(() => (props.filters['global'] && props.filters['global'].value) || '')

const filtered = computed(() => {
  let rows = [...props.value]
  const gq = String(globalQuery.value).toLowerCase().trim()
  if (gq) {
    const gf = props.globalFilterFields.length ? props.globalFilterFields : props.columns.map(c => c.field)
    rows = rows.filter(r => gf.some(f => r[f] != null && String(r[f]).toLowerCase().includes(gq)))
  }
  for (const col of props.columns) {
    const f = props.filters[col.field]
    if (f && f.value != null && String(f.value) !== '') {
      const q = String(f.value).toLowerCase()
      rows = rows.filter(r => r[col.field] != null && String(r[col.field]).toLowerCase().includes(q))
    }
  }
  if (sort.value.field) {
    const dir = sort.value.direction === 'asc' ? 1 : -1
    const field = sort.value.field
    rows = rows.slice().sort((a, b) => {
      const av = a[field], bv = b[field]
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return -dir
      if (av > bv) return dir
      return 0
    })
  }
  return rows
})

const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / props.rows)))
const offset = computed(() => (page.value - 1) * props.rows)
const first = computed(() => Math.min(offset.value + 1, filtered.value.length))
const last = computed(() => Math.min(offset.value + props.rows, filtered.value.length))
const pagedRows = computed(() => filtered.value.slice(offset.value, last.value))
const totalCount = computed(() => filtered.value.length)
const colspanCount = computed(() => props.columns.length + (props.selectionMode ? 1 : 0))

const pageList = computed(() => {
  const arr = []
  const total = pageCount.value
  const max = Math.min(total, 7)
  const start = Math.max(1, page.value - Math.floor(max / 2))
  for (let p = start; p < start + max && p <= total; p++) arr.push(p)
  return arr.length ? arr : [1]
})

const pageReport = computed(() => {
  if (filtered.value.length === 0) return 'Sin registros'
  return props.pageReportTemplate
    .replace('{first}', first.value)
    .replace('{last}', last.value)
    .replace('{totalRecords}', totalCount.value)
})

watch(() => filtered.value.length, () => {
  if (page.value > pageCount.value) page.value = pageCount.value
})

function rowKey(row, i) {
  return row && row.id != null ? row.id : i
}
function sortToggle(col) {
  if (sort.value.field === col.field) {
    sort.value.direction = sort.value.direction === 'asc' ? 'desc' : 'asc'
  } else {
    sort.value.field = col.field
    sort.value.direction = 'asc'
  }
}
function isSelected(row) {
  return props.selection.some(s => s === row || (row.id != null && s != null && String(s.id) === String(row.id)))
}
function onRowClick(row) {
  if (!props.selectionMode) return
  const isSel = isSelected(row)
  if (props.selectionMode === 'multiple') {
    const next = isSel ? props.selection.filter(s => s !== row) : [...props.selection, row]
    emit('update:selection', next)
    emit(isSel ? 'row-unselect' : 'row-select', { data: row })
  } else {
    const next = isSel && props.selection.length === 1 ? [] : [row]
    emit('update:selection', next)
    emit('row-select', { data: row })
  }
}
function onRowDblClick(row) {
  emit('row-dblclick', { data: row })
}
function onFilterInput(field, val) {
  const f = props.filters[field]
  if (f) f.value = val
}
function goTo(p) { page.value = Math.min(Math.max(1, p), pageCount.value) }
function changeRows(e) {
  emit('update:rows', Number(e.target.value))
}
</script>

<style scoped>
.dt-col-select { width: 3em; }
.datatable-header { margin-bottom: .75rem; }
.table-wrap {
  overflow: auto;
  max-height: 80vh;
  border: 1px solid var(--gb-border);
  border-radius: var(--gb-radius-sm);
  background: var(--gb-surface);
}
.dt-card .table-wrap { border-radius: var(--gb-radius); box-shadow: var(--gb-shadow-sm); }
.table-wrap :deep(.table) { --bs-table-bg: transparent; }
.dthead {
  white-space: nowrap;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--gb-text-muted);
  background: var(--gb-surface-2) !important;
  border-bottom: 1px solid var(--gb-border);
  padding: 0.6rem 0.75rem;
}
.dt-sticky thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--gb-surface-2);
}
.dt-sticky thead tr:nth-child(2) th { top: 2.3rem; }
td { padding: 0.55rem 0.75rem; vertical-align: middle; border-color: var(--gb-border); }
.dt-compact td, .dt-compact .dthead { padding: 0.3rem 0.5rem; }
.dt-hover tbody tr:not(.dt-empty-row):not(.dt-skeleton-row) { transition: background-color var(--gb-transition-fast); }
.dt-hover tbody tr:not(.dt-empty-row):not(.dt-skeleton-row):hover > td { background: var(--gb-primary-soft); }
tbody tr:last-child td { border-bottom: 0; }
.dt-empty-row td { padding: 0; border-bottom: 0; }
.sort-click { cursor: pointer; user-select: none; border-radius: 4px; }
.sort-click:hover { color: var(--gb-heading); }
.sort-click:focus-visible { outline: none; box-shadow: var(--gb-focus-ring); }
.dt-sort-icon { color: var(--gb-primary); font-size: 0.7rem; }
.desc-filter { padding: 0.2rem 0.4rem; min-height: 0 !important; }
.row-selected > td { background: var(--gb-primary-soft-2) !important; }
.datatable-pager {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  margin-top: .75rem;
  flex-wrap: wrap;
}
.controls { display: flex; gap: .25rem; align-items: center; flex-wrap: wrap; }
.rows-input { width: 4rem; text-align: center; min-height: 0 !important; }
.dtext { color: var(--gb-text-muted); font-size: .85rem; }
.dt-page {
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--gb-radius-sm);
  background: transparent;
  color: var(--gb-text);
  font-size: 0.85rem;
  transition: background-color var(--gb-transition-fast), color var(--gb-transition-fast);
}
.dt-page:hover:not(:disabled):not(.is-active) { background: var(--gb-surface-2); }
.dt-page:focus-visible { outline: none; box-shadow: var(--gb-focus-ring); }
.dt-page:disabled { color: var(--gb-text-muted); opacity: 0.5; }
.dt-page.is-active { background: var(--gb-primary); color: var(--gb-on-primary); font-weight: 600; }
</style>