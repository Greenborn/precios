<template>
  <PublicTopBar />

  <main class="pub-main" id="mi-negocio-cnt">
    <div class="pub-container pub-container--md">
      <PageHeader title="Mi negocio" icon="bi-shop-window"
                  subtitle="Administrá los datos de tu negocio y los precios de tus artículos."
                  :breadcrumbs="[{ label: 'Inicio', to: '/' }, { label: 'Mi negocio' }]">
        <template #actions>
          <router-link v-if="perfil_id" class="btn btn-outline-primary btn-sm" :to="'/negocio/' + perfil_id">
            <Icon name="bi-eye" /> Ver ficha pública
          </router-link>
        </template>
      </PageHeader>

      <div v-if="mensajeExito" class="alert alert-success d-flex align-items-center gap-2" role="status">
        <Icon name="bi-check-circle-fill" /> <span class="flex-grow-1">{{ mensajeExito }}</span>
        <button type="button" class="btn-close" aria-label="Cerrar" @click="mensajeExito = ''"></button>
      </div>

      <ul class="nav nav-tabs mb-4" role="tablist" aria-label="Secciones">
        <li v-for="t in TABS" :key="t.id" class="nav-item" role="presentation">
          <button type="button" class="nav-link" :class="{ active: tab === t.id }" role="tab"
                  :aria-selected="String(tab === t.id)" @click="ir_tab(t.id)">
            <Icon :name="t.icon" class="me-1" />{{ t.label }}
          </button>
        </li>
      </ul>

      <!-- Negocio: perfil + locales -->
      <div v-show="tab === 'negocio'" role="tabpanel">
      <Card id="seccion-perfil" title="Perfil del negocio" icon="bi-person-vcard" class="mb-4">
        <CabeceraNegocio editable class="mb-4" />
        <PerfilNegocioForm :api="http" base="/api/perfil" :campos="CAMPOS_PERFIL" :terminos="TERMINOS_NEGOCIO" />
      </Card>

      <!-- 2. Locales -->
      <Card id="seccion-locales" title="Mis locales" icon="bi-geo-alt" class="mb-4">
        <p class="gb-text-muted small mb-3">
          Cada local nuevo recibe un código identificador. No se permiten locales duplicados (mismo nombre, dirección y ciudad).
        </p>

        <form class="row g-2 mb-3" @submit.prevent="agregar_local()" novalidate>
          <div class="col-12 col-md-4">
            <label for="local_nombre" class="form-label small mb-1">Nombre del local <span class="text-danger" aria-hidden="true">*</span></label>
            <input id="local_nombre" type="text" class="form-control" v-model="nuevo_local.nombre" required>
          </div>
          <div class="col-6 col-md-3">
            <label for="local_calle" class="form-label small mb-1">Calle</label>
            <input id="local_calle" type="text" class="form-control" v-model="nuevo_local.calle">
          </div>
          <div class="col-6 col-md-1">
            <label for="local_numero" class="form-label small mb-1">Nro.</label>
            <input id="local_numero" type="text" class="form-control" v-model="nuevo_local.numero">
          </div>
          <div class="col-6 col-md-2">
            <label for="local_ciudad" class="form-label small mb-1">Ciudad</label>
            <input id="local_ciudad" type="text" class="form-control" v-model="nuevo_local.ciudad">
          </div>
          <div class="col-6 col-md-1">
            <label for="local_lat" class="form-label small mb-1">Lat.</label>
            <input id="local_lat" type="text" inputmode="decimal" class="form-control" v-model="nuevo_local.latitud">
          </div>
          <div class="col-6 col-md-1">
            <label for="local_lng" class="form-label small mb-1">Lng.</label>
            <input id="local_lng" type="text" inputmode="decimal" class="form-control" v-model="nuevo_local.longitud">
          </div>
          <div class="col-12 d-flex justify-content-end">
            <Button type="submit" icon="bi-plus-lg" label="Agregar local" :loading="guardandoLocal" />
          </div>
        </form>

        <EmptyState v-if="!cargando && !locales.length" size="sm" icon="bi-geo-alt" title="Sin locales"
                    description="Agregá tu primer local para poder cargar precios." />

        <ul class="list-unstyled mb-3" v-if="locales.length">
          <li v-for="l in locales" :key="l.id" class="d-flex flex-wrap align-items-center justify-content-between gap-2 py-2 border-bottom">
            <div>
              <b>{{ l.nombre || 'Sin nombre' }}</b>
              <span class="gb-text-muted small"> · {{ [l.calle, l.numero, l.ciudad].filter(Boolean).join(' ') || 'Sin dirección' }}</span>
              <span class="gb-text-muted small d-block">Código: <code>{{ l.codigo || '—' }}</code></span>
            </div>
            <div class="d-flex gap-2">
              <Button size="sm" variant="outline" :label="l.publicado ? 'Ocultar del mapa' : 'Publicar en el mapa'"
                      @click="alternar_publicado(l)" />
              <Button size="sm" variant="ghost" severity="danger" icon="bi-trash" :ariaLabel="'Eliminar ' + (l.nombre || 'local')"
                      @click="eliminar_local(l)" />
            </div>
          </li>
        </ul>

        <LocalesMapa :locales="locales" :terminos="TERMINOS_LOCAL" />
      </Card>

      </div>

      <!-- Precios: carga + listado -->
      <div v-show="tab === 'precios'" role="tabpanel">
      <Card id="seccion-cargar" title="Cargar precios de mis artículos" icon="bi-basket" class="mb-4">
        <form @submit.prevent="enviar_precios()" novalidate>
          <div class="row g-3 mb-3">
            <div class="col-12 col-md-7">
              <label for="precio_local" class="form-label fw-semibold">Local <span class="text-danger" aria-hidden="true">*</span></label>
              <select id="precio_local" class="form-select" v-model="local_precios" required>
                <option :value="null" disabled>Elegí un local</option>
                <option v-for="l in locales" :key="l.id" :value="l.id">{{ l.nombre || 'Sin nombre' }}</option>
              </select>
              <small v-if="!locales.length" class="form-text gb-text-muted">Primero agregá un local en la pestaña «Mi negocio».</small>
            </div>
            <div class="col-12 col-md-5">
              <label for="precio_fecha" class="form-label fw-semibold">Fecha</label>
              <input id="precio_fecha" type="date" class="form-control" v-model="fecha_precios">
            </div>
          </div>

          <div v-for="(fila, index) in filas" :key="index" class="producto-row">
            <span class="producto-row__num gb-num" aria-hidden="true">{{ index + 1 }}</span>
            <div class="row g-2 flex-grow-1">
              <div class="col-12 col-sm-6 col-lg-3">
                <label :for="'p_nombre' + index" class="form-label small mb-1">Artículo</label>
                <input :id="'p_nombre' + index" type="text" class="form-control" v-model="fila.nombre" placeholder="Arroz">
              </div>
              <div class="col-6 col-lg-2">
                <label :for="'p_marca' + index" class="form-label small mb-1">Marca</label>
                <input :id="'p_marca' + index" type="text" class="form-control" v-model="fila.marca" placeholder="Marolio">
              </div>
              <div class="col-6 col-lg-2">
                <label :for="'p_pres' + index" class="form-label small mb-1">Presentación</label>
                <input :id="'p_pres' + index" type="text" class="form-control" v-model="fila.presentacion" placeholder="1Kg">
              </div>
              <div class="col-6 col-lg-2">
                <label :for="'p_precio' + index" class="form-label small mb-1">Precio</label>
                <div class="input-group">
                  <span class="input-group-text">$</span>
                  <input :id="'p_precio' + index" type="text" inputmode="decimal" class="form-control gb-num" v-model="fila.precio" placeholder="1000">
                </div>
              </div>
              <div class="col-6 col-lg-3">
                <label :for="'p_foto' + index" class="form-label small mb-1">Foto (opcional, una por artículo)</label>
                <input :id="'p_foto' + index" type="file" class="form-control form-control-sm" accept="image/jpeg,image/png,image/webp"
                       @change="elegir_foto(fila, $event)">
                <div v-if="fila.foto" class="d-flex align-items-center gap-2 mt-1">
                  <img :src="fila.foto.dataUrl" alt="Foto encuadrada" class="rounded" width="48" height="48" style="object-fit:cover">
                  <small class="form-text gb-text-muted m-0">Se reemplaza la foto previa del artículo</small>
                  <button type="button" class="btn btn-link btn-sm p-0" @click="fila.foto = null">Quitar</button>
                </div>
              </div>
            </div>
            <Button variant="ghost" severity="danger" icon="bi-trash" :ariaLabel="'Quitar artículo ' + (index + 1)" @click="quitar_fila(index)" />
          </div>

          <div class="d-flex flex-wrap justify-content-between gap-2 mt-3">
            <Button variant="outline" icon="bi-plus-lg" label="Agregar artículo" @click="agregar_fila()" />
            <Button type="submit" icon="bi-send" label="Enviar precios" :loading="enviandoPrecios" />
          </div>
        </form>
      </Card>

      <Card id="seccion-listado" title="Precios cargados" icon="bi-list-ul" class="mb-4">
        <EmptyState v-if="!cargandoPrecios && !mis_precios.length" size="sm" icon="bi-basket" title="Sin precios"
                    description="Todavía no cargaste precios." />
        <template v-else>
          <div class="row g-2 mb-3 align-items-end">
            <div class="col-12 col-md-6">
              <label for="filtro_precios" class="form-label small mb-1">Buscar artículo</label>
              <div class="input-group">
                <span class="input-group-text"><Icon name="bi-search" /></span>
                <input id="filtro_precios" type="search" class="form-control" v-model="filtro_precios" placeholder="Nombre del artículo">
              </div>
            </div>
            <div class="col-12 col-md-4">
              <label for="filtro_local" class="form-label small mb-1">Local</label>
              <select id="filtro_local" class="form-select" v-model="filtro_local">
                <option value="">Todos</option>
                <option v-for="l in locales_con_precios" :key="l.id" :value="String(l.id)">{{ l.nombre }}</option>
              </select>
            </div>
            <div class="col-12 col-md-2 text-md-end small gb-text-muted">{{ precios_filtrados.length }} de {{ total_precios }}</div>
          </div>

          <EmptyState v-if="!grupos_precios.length" size="sm" icon="bi-search" title="Sin coincidencias" />
          <section v-for="g in grupos_precios" :key="g.id" class="mb-4">
            <h3 class="h6 d-flex align-items-center gap-2 mb-2">
              <Icon name="bi-shop-window" /> {{ g.nombre }}
              <span class="badge text-bg-secondary rounded-pill">{{ g.items.length }}</span>
            </h3>
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead class="table-light"><tr><th>Artículo</th><th class="text-end">Precio</th><th class="text-end">Actualizado</th></tr></thead>
                <tbody>
                  <tr v-for="p in g.items" :key="p.producto_id">
                    <td>{{ p.producto }}</td>
                    <td class="text-end fw-semibold gb-num">{{ formato_moneda(p.precio) }}</td>
                    <td class="text-end small gb-text-muted">{{ formato_fecha(p.fecha) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
        <div v-if="mis_precios.length < total_precios" class="text-center">
          <Button variant="outline" label="Ver más" :loading="cargandoPrecios" @click="cargar_mis_precios()" />
        </div>
      </Card>
      </div>
    </div>
  </main>

  <RecorteModal :archivo="foto_pendiente.archivo" :ancho="800" :alto="800" titulo="Encuadrar foto del artículo"
                texto-aceptar="Usar esta foto" @aceptar="aceptar_recorte" @cancelar="foto_pendiente = { fila: null, archivo: null }" />
  <PublicFooter />
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CabeceraNegocio from '../components/publico/CabeceraNegocio.vue'
import RecorteModal from '../components/publico/RecorteModal.vue'
import PublicTopBar from '../components/publico/PublicTopBar.vue'
import PublicFooter from '../components/publico/PublicFooter.vue'
import PerfilNegocioForm from '../components/publico/PerfilNegocioForm.vue'
import { LocalesMapa, useLocales } from '@greenborn/vue-greenborn-locales-mapa'
import '@greenborn/vue-greenborn-map-viewer/style.css'
import { http, cargar_precios_negocio, guardar_foto_articulo, obtener_mi_perfil, listar_mis_precios } from '../api/negocio'
import { AppStore } from '../stores/app'

// Mismos campos que config/negocio.js del back (CAMPOS_PERFIL)
const CAMPOS_PERFIL = [
  { nombre: 'nombre_comercial', publicable: true, etiqueta: 'Nombre comercial' },
  { nombre: 'telefono', publicable: true, etiqueta: 'Teléfono' },
  { nombre: 'sitio_web', publicable: true, etiqueta: 'Sitio web' },
  { nombre: 'descripcion', tipo: 'texto_largo', publicable: true, etiqueta: 'Descripción' },
]
const TERMINOS_NEGOCIO = { singular: 'negocio', plural: 'negocios' }
const TERMINOS_LOCAL = { singular: 'local', plural: 'locales' }
const FOTO_MAX_BYTES = 2 * 1024 * 1024
const FOTO_TIPOS = ['image/jpeg', 'image/png', 'image/webp']

const storeApp = AppStore()
const { locales, cargando, cargar, crear, actualizar, eliminar } = useLocales({ api: http, base: '/api' })

const mensajeExito = ref('')
const guardandoLocal = ref(false)
const nuevo_local = ref({ nombre: '', calle: '', numero: '', ciudad: '', latitud: '', longitud: '' })

const enviandoPrecios = ref(false)
const local_precios = ref(null)
const fecha_precios = ref(new Date().toISOString().split('T')[0])
const filas_vacia = () => ({ nombre: '', marca: '', presentacion: '', precio: '', foto: null })
const filas = ref([filas_vacia()])

function mensaje_error(err, por_defecto = 'Ocurrió un error, reintente luego') {
  return err?.response?.data?.error || err?.response?.data?.message || por_defecto
}

const route = useRoute()
const router = useRouter()
const mis_precios = ref([])
const total_precios = ref(0)
const cargandoPrecios = ref(false)

async function cargar_mis_precios(reiniciar = false) {
  if (reiniciar) mis_precios.value = []
  cargandoPrecios.value = true
  try {
    const r = await listar_mis_precios({ offset: mis_precios.value.length })
    mis_precios.value.push(...(r.items || []))
    total_precios.value = r.total || 0
  } catch (err) {
    storeApp.mostrar_alerta(mensaje_error(err, 'No se pudieron obtener los precios'))
  } finally {
    cargandoPrecios.value = false
  }
}

const TABS = [
  { id: 'negocio', label: 'Mi negocio', icon: 'bi-shop-window' },
  { id: 'precios', label: 'Mis precios', icon: 'bi-basket' },
]
// Compatibilidad con enlaces anteriores (perfil / locales / listado)
const ALIAS_TAB = { perfil: 'negocio', locales: 'negocio', listado: 'precios', precios: 'precios', negocio: 'negocio' }
const tab = ref(ALIAS_TAB[route.query.seccion] || 'negocio')
watch(() => route.query.seccion, (v) => { if (ALIAS_TAB[v]) tab.value = ALIAS_TAB[v] })
function ir_tab(id) {
  tab.value = id
  router.replace({ path: route.path, query: { seccion: id } })
}

const filtro_precios = ref('')
const filtro_local = ref('')
const formato_moneda = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(v))
function formato_fecha(v) {
  const d = new Date(String(v || '').replace(' ', 'T'))
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR')
}
const precios_filtrados = computed(() => {
  const q = filtro_precios.value.trim().toLowerCase()
  return mis_precios.value.filter((p) =>
    (!q || String(p.producto || '').toLowerCase().includes(q)) &&
    (!filtro_local.value || String(p.local_id) === filtro_local.value))
})
const grupos_precios = computed(() => {
  const mapa = new Map()
  for (const p of precios_filtrados.value) {
    if (!mapa.has(p.local_id)) mapa.set(p.local_id, { id: p.local_id, nombre: p.local || 'Sin nombre', items: [] })
    mapa.get(p.local_id).items.push(p)
  }
  return [...mapa.values()]
})
const locales_con_precios = computed(() => {
  const m = new Map()
  for (const p of mis_precios.value) m.set(p.local_id, { id: p.local_id, nombre: p.local || 'Sin nombre' })
  return [...m.values()]
})

const perfil_id = ref(null)
onMounted(async () => {
  cargar_mis_precios(true)
  cargar()
  obtener_mi_perfil().then((p) => { perfil_id.value = p?.id ?? null }).catch(() => {})
})

function coordenada(valor) {
  const s = String(valor ?? '').trim().replace(',', '.')
  return s === '' ? null : Number(s)
}

async function agregar_local() {
  const datos = nuevo_local.value
  if (!String(datos.nombre || '').trim()) {
    storeApp.mostrar_alerta('Debe indicar el nombre del local')
    return
  }
  guardandoLocal.value = true
  try {
    const creado = await crear({
      nombre: datos.nombre.trim(),
      calle: datos.calle.trim() || null,
      numero: datos.numero.trim() || null,
      ciudad: datos.ciudad.trim() || null,
      latitud: coordenada(datos.latitud),
      longitud: coordenada(datos.longitud),
    })
    nuevo_local.value = { nombre: '', calle: '', numero: '', ciudad: '', latitud: '', longitud: '' }
    if (!local_precios.value) local_precios.value = creado.id
    mensajeExito.value = `Local creado. Código: ${creado.codigo || '—'}`
  } catch (err) {
    storeApp.mostrar_alerta(mensaje_error(err, 'No se pudo crear el local'))
  } finally {
    guardandoLocal.value = false
  }
}

async function alternar_publicado(local) {
  try {
    await actualizar(local.id, { publicado: !local.publicado })
  } catch (err) {
    storeApp.mostrar_alerta(mensaje_error(err, 'No se pudo cambiar la publicación'))
  }
}

function eliminar_local(local) {
  storeApp.mostrar_confirm({
    title: 'Eliminar local',
    text: `Se eliminará "${local.nombre || 'el local'}" y sus fotos de artículos. ¿Continuar?`,
    severity_confirmar: 'danger',
    confirmar_accion: async () => {
      try {
        await eliminar(local.id)
        if (local_precios.value === local.id) local_precios.value = null
      } catch (err) {
        storeApp.mostrar_alerta(mensaje_error(err, 'No se pudo eliminar el local'))
      }
    },
  })
}

function agregar_fila() {
  filas.value.push(filas_vacia())
}

function quitar_fila(index) {
  filas.value.splice(index, 1)
}

// Foto del artículo en curso de encuadre (el archivo se recorta a 800x800 antes de adjuntarse)
const foto_pendiente = ref({ fila: null, archivo: null })

function aceptar_recorte(dataUrl) {
  if (foto_pendiente.value.fila) foto_pendiente.value.fila.foto = { dataUrl }
  foto_pendiente.value = { fila: null, archivo: null }
}

function elegir_foto(fila, evento) {
  const archivo = evento.target.files?.[0] || null
  if (!archivo) {
    fila.foto = null
    return
  }
  if (!FOTO_TIPOS.includes(archivo.type)) {
    storeApp.mostrar_alerta('La foto debe ser JPG, PNG o WEBP')
    evento.target.value = ''
    fila.foto = null
    return
  }
  if (archivo.size > FOTO_MAX_BYTES) {
    storeApp.mostrar_alerta('La foto supera el máximo de 2 MB')
    evento.target.value = ''
    fila.foto = null
    return
  }
  fila.foto = null
  foto_pendiente.value = { fila, archivo }
  evento.target.value = ''
}

async function enviar_precios() {
  if (!local_precios.value) {
    storeApp.mostrar_alerta('Debe elegir un local')
    return
  }
  const validos = filas.value.filter((f) => f.nombre.trim() && Number(String(f.precio).replace(',', '.')) > 0)
  if (!validos.length) {
    storeApp.mostrar_alerta('Debe cargar al menos un artículo con nombre y precio')
    return
  }

  enviandoPrecios.value = true
  try {
    const res = await cargar_precios_negocio({
      branch_id: local_precios.value,
      fecha: fecha_precios.value,
      productos: validos.map((f) => ({
        nombre: f.nombre.trim(),
        marca: f.marca.trim(),
        presentacion: f.presentacion.trim(),
        precio: Number(String(f.precio).replace(',', '.')),
      })),
    })
    if (res?.error || !res?.items) {
      storeApp.mostrar_alerta(res?.error || res?.text || 'No se pudieron cargar los precios')
      return
    }

    // Una foto opcional por artículo: se adjunta al artículo ya registrado (product_id)
    let fotos_ok = 0
    let fotos_err = 0
    for (const d of res.items.detalle || []) {
      const archivo = validos[d.indice]?.foto
      if (!d.ok || !archivo) continue
      try {
        await guardar_foto_articulo(local_precios.value, d.product_id, archivo.dataUrl)
        fotos_ok++
      } catch {
        fotos_err++
      }
    }

    let texto = `Se cargaron ${res.items.cargados} precio(s)`
    if (res.items.con_error) texto += ` (${res.items.con_error} con error)`
    if (fotos_ok) texto += `. Fotos guardadas: ${fotos_ok}`
    if (fotos_err) texto += `. Fotos con error: ${fotos_err}`
    mensajeExito.value = texto
    filas.value = [filas_vacia()]
    cargar_mis_precios(true)
  } catch (err) {
    storeApp.mostrar_alerta(mensaje_error(err, 'Error al enviar los precios'))
  } finally {
    enviandoPrecios.value = false
  }
}
</script>

<style scoped>
.producto-row { display: flex; align-items: flex-start; gap: var(--gb-space-3); padding: var(--gb-space-3) 0; border-bottom: 1px solid var(--gb-border); }
.producto-row:last-child { border-bottom: 0; }
.producto-row__num { flex: none; width: 1.75rem; height: 1.75rem; border-radius: 50%; display: grid; place-items: center;
  background: var(--gb-surface-2); color: var(--gb-text-muted); font-size: .8125rem; font-weight: 600; margin-top: 1.4rem; }
@media (max-width: 575.98px) { .producto-row__num { display: none; } }
</style>
