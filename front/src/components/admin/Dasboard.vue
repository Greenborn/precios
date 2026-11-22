<template>
  <div class="admin-dashboard">
    <PageHeader
      :title="'Hola, ' + (storeApp.userInfo?.name || 'Usuario')"
      subtitle="Resumen del catálogo y de la actividad reciente de la comunidad."
      icon="bi-speedometer2">
      <template #actions>
        <Button label="Actualizar" icon="bi-arrow-clockwise" variant="outline-secondary" :loading="cargando" @click="cargar" />
      </template>
    </PageHeader>

    <section class="dash-stats" aria-label="Indicadores">
      <StatCard v-for="s in stats" :key="s.key"
        :label="s.label"
        :value="s.value === null ? '—' : formatNum(s.value)"
        :icon="s.icon"
        :tone="s.tone"
        :hint="s.value === null && !cargando ? 'Sin acceso o sin datos' : ''"
        :loading="cargando" />
    </section>

    <div class="dash-grid">
      <Card title="Precios cargados por la comunidad" subtitle="Últimos registros, agrupados por día" icon="bi-graph-up" class="dash-grid__wide">
        <Skeleton v-if="cargando" shape="rect" height="260px" />
        <EmptyState v-else-if="!serieDias.labels.length" size="sm" icon="bi-graph-up"
          title="Sin precios recientes" description="Cuando la comunidad cargue precios vas a ver la evolución acá." />
        <Chart v-else type="bar" :data="chartDias" :options="opcionesBarras" height="260px" />
      </Card>

      <Card title="Categorías principales" subtitle="Productos por categoría raíz" icon="bi-diagram-3">
        <Skeleton v-if="cargando" shape="rect" height="260px" />
        <EmptyState v-else-if="!categoriasTop.length" size="sm" icon="bi-diagram-3"
          title="Sin categorías" />
        <Chart v-else type="doughnut" :data="chartCategorias" :options="opcionesDona" height="260px" />
      </Card>

      <Card title="Actividad reciente" subtitle="Últimos precios cargados por usuarios" icon="bi-clock-history" flush class="dash-grid__full">
        <div v-if="cargando" class="p-3"><Skeleton :lines="5" /></div>
        <EmptyState v-else-if="!recientes.length" size="sm" icon="bi-inbox" title="Sin actividad reciente" />
        <ul v-else class="dash-activity">
          <li v-for="p in recientes" :key="p.id" class="dash-activity__item">
            <span class="dash-activity__icon" aria-hidden="true"><Icon name="bi-tag" /></span>
            <div class="dash-activity__body">
              <div class="dash-activity__title gb-truncate">{{ p.product_name || 'Producto' }}</div>
              <div class="dash-activity__meta gb-truncate">
                {{ p.empresa_name || 'Comercio s/d' }} · {{ quien(p) }}
              </div>
            </div>
            <div class="dash-activity__side">
              <div class="dash-activity__price gb-num">{{ formatPrecio(p.price) }}</div>
              <div class="dash-activity__date">{{ formatFecha(p.date_time) }}</div>
            </div>
          </li>
        </ul>
      </Card>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue'
  import { AppStore } from "../../stores/app";
  import { get_all as get_usuarios } from '@/api/admin/gestionUsuarios'
  import { get_all as get_categorias, arbol } from '@/api/admin/categorias'
  import { get_all as get_alias_categorias } from '@/api/admin/aliasCategorias'
  import { get_all as get_alias_productos } from '@/api/admin/aliasProductos'
  import { get_all as get_indices } from '@/api/admin/indicesPrecios'
  import { get_all as get_precios } from '@/api/admin/preciosComunitarios'

  const storeApp = AppStore()

  const cargando = ref(true)
  const stats = ref([
    { key: 'precios',    label: 'Precios comunitarios', icon: 'bi-cash-coin',     tone: 'primary', value: null, api: get_precios },
    { key: 'categorias', label: 'Categorías',           icon: 'bi-diagram-3',     tone: 'accent',  value: null, api: get_categorias },
    { key: 'aliasProd',  label: 'Alias de productos',   icon: 'bi-tags',          tone: 'info',    value: null, api: get_alias_productos },
    { key: 'aliasCat',   label: 'Alias de categorías',  icon: 'bi-bookmarks',     tone: 'warning', value: null, api: get_alias_categorias },
    { key: 'indices',    label: 'Índices de precios',   icon: 'bi-bar-chart-line',tone: 'success', value: null, api: get_indices },
    { key: 'usuarios',   label: 'Usuarios',             icon: 'bi-people',        tone: 'danger',  value: null, api: get_usuarios },
  ])
  const precios = ref([])
  const categoriasTop = ref([])

  function total_de(res) {
    if (!res || res.stat === false || !res.data) return null
    const d = res.data
    const t = d.total ?? d.totalRecords
    return t === undefined || t === null ? (Array.isArray(d.rows) ? d.rows.length : null) : Number(t)
  }

  async function seguro(p) {
    try { return await p } catch (e) { return null }
  }

  async function cargar() {
    cargando.value = true
    const [totales, resPrecios, resArbol] = await Promise.all([
      Promise.all(stats.value.map(s => seguro(s.api({ page: 1, pageSize: 1 })))),
      seguro(get_precios({ page: 1, pageSize: 100, sortField: 'date_time', sortOrder: 'desc' })),
      seguro(arbol({ parent_id: '', search: '' })),
    ])
    totales.forEach((r, i) => { stats.value[i].value = total_de(r) })
    precios.value = (resPrecios && resPrecios.stat && resPrecios.data?.rows) || []
    const raices = (resArbol && resArbol.stat && resArbol.data?.rows) || []
    categoriasTop.value = [...raices]
      .filter(c => Number(c.cant_productos) > 0)
      .sort((a, b) => Number(b.cant_productos) - Number(a.cant_productos))
      .slice(0, 6)
    cargando.value = false
  }

  const recientes = computed(() => precios.value.slice(0, 8))

  const serieDias = computed(() => {
    const porDia = new Map()
    for (const p of precios.value) {
      const d = p.date_time ? new Date(p.date_time) : null
      if (!d || isNaN(d)) continue
      const k = d.toISOString().slice(0, 10)
      porDia.set(k, (porDia.get(k) || 0) + 1)
    }
    const keys = [...porDia.keys()].sort().slice(-14)
    return {
      labels: keys.map(k => new Date(k + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })),
      values: keys.map(k => porDia.get(k)),
    }
  })

  const chartDias = computed(() => ({
    labels: serieDias.value.labels,
    datasets: [{ label: 'Precios cargados', data: serieDias.value.values, borderRadius: 6, maxBarThickness: 36 }],
  }))
  const chartCategorias = computed(() => ({
    labels: categoriasTop.value.map(c => c.name),
    datasets: [{ label: 'Productos', data: categoriasTop.value.map(c => Number(c.cant_productos)) }],
  }))

  const opcionesBarras = {
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  }
  const opcionesDona = {
    cutout: '62%',
    plugins: { legend: { position: 'bottom' } },
  }

  function formatNum(n) { return Number(n).toLocaleString('es-AR') }
  function formatPrecio(v) {
    const n = Number(v)
    return isNaN(n) ? (v ?? '') : n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
  }
  function formatFecha(v) {
    const d = v ? new Date(v) : null
    return d && !isNaN(d) ? d.toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
  }
  function quien(p) {
    return p.cargado_por || [p.u_nombre || p.user_nombre, p.u_apellido || p.user_apellido].filter(Boolean).join(' ') || p.user_email || 'Usuario'
  }

  onMounted(cargar)
</script>

<style scoped>
.admin-dashboard { display: flex; flex-direction: column; gap: var(--gb-space-5); }
.admin-dashboard :deep(.gb-page-header) { margin-bottom: 0; }

.dash-stats {
  display: grid;
  gap: var(--gb-space-4);
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.dash-grid {
  display: grid;
  gap: var(--gb-space-4);
  grid-template-columns: 1fr;
}
@media (min-width: 992px) {
  .dash-grid { grid-template-columns: 2fr 1fr; }
  .dash-grid__full { grid-column: 1 / -1; }
}

.dash-activity { list-style: none; margin: 0; padding: 0; }
.dash-activity__item {
  display: flex; align-items: center; gap: var(--gb-space-3);
  padding: var(--gb-space-3) var(--gb-space-4);
  border-bottom: 1px solid var(--gb-border);
}
.dash-activity__item:last-child { border-bottom: 0; }
.dash-activity__item:hover { background: var(--gb-surface-2); }
.dash-activity__icon {
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--gb-primary-soft); color: var(--gb-primary);
}
.dash-activity__body { flex: 1; min-width: 0; }
.dash-activity__title { font-weight: 600; color: var(--gb-heading); }
.dash-activity__meta, .dash-activity__date { font-size: 0.8125rem; color: var(--gb-text-muted); }
.dash-activity__side { text-align: right; flex-shrink: 0; }
.dash-activity__price { font-weight: 600; }
</style>
