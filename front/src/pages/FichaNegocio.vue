<template>
  <PublicTopBar />

  <main class="pub-main" id="ficha-negocio-cnt">
    <div class="pub-container pub-container--md">
      <PageHeader :title="perfil?.nombre_comercial || 'Negocio'" icon="bi-shop"
                  subtitle="Perfil, locales y precios cargados por el negocio."
                  :breadcrumbs="[{ label: 'Inicio', to: '/' }, { label: 'Negocio' }]" />

      <EmptyState v-if="noEncontrado" icon="bi-shop" title="Negocio no encontrado"
                  description="El enlace no corresponde a un negocio publicado." />

      <EmptyState v-else-if="errorPerfil" icon="bi-exclamation-triangle" title="No se pudo cargar el negocio"
                  description="Ocurrió un error al cargar la ficha. Probá de nuevo en unos minutos." />

      <template v-else>
        <CabeceraNegocio v-if="perfilId" :perfil-id="perfilId" :nombre="perfil?.nombre_comercial || 'Negocio'" class="mb-4" />
        <!-- 1. Perfil -->
        <Card title="Perfil" icon="bi-person-vcard" class="mb-4">
          <EmptyState v-if="cargandoPerfil" size="sm" icon="bi-hourglass-split" title="Cargando perfil" />
          <dl v-else-if="campos_visibles.length" class="row mb-0">
            <template v-for="c in campos_visibles" :key="c.nombre">
              <dt class="col-sm-4 col-md-3 text-muted fw-semibold">{{ c.etiqueta }}</dt>
              <dd class="col-sm-8 col-md-9">{{ perfil[c.nombre] }}</dd>
            </template>
          </dl>
          <EmptyState v-else size="sm" icon="bi-person-vcard" title="Sin datos publicados" />
        </Card>

        <!-- 2. Locales -->
        <Card title="Locales" icon="bi-geo-alt" class="mb-4">
          <EmptyState v-if="!cargandoLocales && !locales.length" size="sm" icon="bi-geo-alt" title="Sin locales publicados" />
          <ul v-else class="list-unstyled mb-3">
            <li v-for="l in locales" :key="l.id" class="py-2 border-bottom">
              <b>{{ l.nombre || 'Sin nombre' }}</b>
              <span class="gb-text-muted small"> · {{ [l.calle, l.ciudad].filter(Boolean).join(', ') || 'Sin dirección' }}</span>
            </li>
          </ul>
          <LocalesMapa v-if="locales.length" :locales="locales" :terminos="TERMINOS_LOCAL" />
        </Card>

        <!-- 3. Productos -->
        <Card title="Productos y precios" icon="bi-basket" class="mb-4">
          <p class="gb-text-muted small mb-3" v-if="productos.total">
            {{ productos.total }} {{ productos.total === 1 ? 'precio cargado' : 'precios cargados' }} por este negocio.
          </p>
          <EmptyState v-if="!cargandoProductos && !productos.items.length" size="sm" icon="bi-basket" title="Sin productos"
                      description="Todavía no se cargaron precios para este negocio." />

          <ul v-else class="list-unstyled mb-0">
            <li v-for="p in productos.items" :key="p.producto_id + '|' + p.local_id"
                class="d-flex align-items-center gap-3 py-2 border-bottom">
              <img v-if="p.foto_url" :src="url_foto(p.foto_url)" :alt="p.producto" class="ficha-foto" loading="lazy">
              <span v-else class="ficha-foto ficha-foto--vacia" aria-hidden="true"><Icon name="bi-image" /></span>
              <div class="flex-grow-1 min-w-0">
                <div class="fw-semibold text-truncate">{{ p.producto }}</div>
                <div class="gb-text-muted small">
                  {{ p.local || 'Local' }} · {{ formatear_fecha(p.fecha) }}<span v-if="p.hora"> {{ p.hora }}</span>
                  <span v-if="p.es_oferta" class="badge text-bg-warning ms-1">Oferta</span>
                </div>
              </div>
              <div class="gb-num fw-semibold text-nowrap">{{ formatear_precio(p.precio) }}</div>
            </li>
          </ul>

          <div v-if="productos.items.length < productos.total" class="d-flex justify-content-center mt-3">
            <Button variant="outline" icon="bi-arrow-down-circle" label="Cargar más" :loading="cargandoProductos"
                    @click="cargar_productos()" />
          </div>
        </Card>
      </template>
    </div>
  </main>
  <PublicFooter />
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import CabeceraNegocio from '../components/publico/CabeceraNegocio.vue'
import PublicTopBar from '../components/publico/PublicTopBar.vue'
import PublicFooter from '../components/publico/PublicFooter.vue'
import { LocalesMapa } from '@greenborn/vue-greenborn-locales-mapa'
import '@greenborn/vue-greenborn-map-viewer/style.css'
import {
  obtener_perfil_publico,
  listar_locales_publicos_negocio,
  listar_productos_publicos_negocio,
  url_absoluta_backend,
} from '../api/negocio'

// Mismos esquemas que config/negocio.js del back
const CAMPOS_PERFIL = [
  { nombre: 'nombre_comercial', publicable: true, etiqueta: 'Nombre comercial' },
  { nombre: 'telefono', publicable: true, etiqueta: 'Teléfono' },
  { nombre: 'sitio_web', publicable: true, etiqueta: 'Sitio web' },
  { nombre: 'descripcion', tipo: 'texto_largo', publicable: true, etiqueta: 'Descripción' },
]
const TERMINOS_NEGOCIO = { singular: 'negocio', plural: 'negocios' }
const TERMINOS_LOCAL = { singular: 'local', plural: 'locales' }
const PAGINA = 50

const route = useRoute()
const campos_visibles = computed(() =>
  CAMPOS_PERFIL.filter((c) => perfil.value && perfil.value[c.nombre] != null && perfil.value[c.nombre] !== ''))
const perfilId = ref(null)
const perfil = ref(null)
const locales = ref([])
const productos = ref({ total: 0, items: [] })
const noEncontrado = ref(false)
const errorPerfil = ref(false)
const cargandoPerfil = ref(false)
const cargandoLocales = ref(false)
const cargandoProductos = ref(false)

const url_foto = url_absoluta_backend

function formatear_precio(valor) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(valor))
}

function formatear_fecha(valor) {
  const d = new Date(String(valor || '').replace(' ', 'T'))
  return isNaN(d.getTime()) ? String(valor || '') : d.toLocaleDateString('es-AR')
}

async function cargar_productos() {
  const id = perfilId.value
  cargandoProductos.value = true
  try {
    const res = await listar_productos_publicos_negocio(id, { limit: PAGINA, offset: productos.value.items.length })
    if (id !== perfilId.value) return // llegó tarde: se navegó a otro negocio
    productos.value = { total: res.total, items: [...productos.value.items, ...res.items] }
  } catch {
    // Si falla, se mantiene lo ya cargado y el botón "Cargar más" sigue disponible
  } finally {
    cargandoProductos.value = false
  }
}

async function cargar_ficha(id) {
  perfilId.value = id
  noEncontrado.value = false
  errorPerfil.value = false
  perfil.value = null
  locales.value = []
  productos.value = { total: 0, items: [] }
  cargandoPerfil.value = true
  let datos
  try {
    datos = await obtener_perfil_publico(id)
  } catch (err) {
    if (id !== perfilId.value) return
    if (err?.response?.status === 404) noEncontrado.value = true
    else errorPerfil.value = true
    cargandoPerfil.value = false
    return
  }
  if (id !== perfilId.value) return
  perfil.value = datos
  cargandoPerfil.value = false

  cargandoLocales.value = true
  listar_locales_publicos_negocio(id)
    .then((l) => { if (id === perfilId.value) locales.value = l })
    .catch(() => {})
    .finally(() => { if (id === perfilId.value) cargandoLocales.value = false })
  await cargar_productos()
}

onMounted(() => cargar_ficha(route.params.id))
watch(() => route.params.id, (id) => { if (id) cargar_ficha(id) })
</script>

<style scoped>
.ficha-foto {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: var(--gb-radius, 8px);
  flex-shrink: 0;
}
.ficha-foto--vacia {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--gb-surface-2, #f1f3f5);
  color: var(--gb-text-muted, #6c757d);
}
.min-w-0 { min-width: 0; }
</style>
