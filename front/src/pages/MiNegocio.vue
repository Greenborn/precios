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

      <div v-if="no_es_negocio" class="alert alert-warning d-flex align-items-center gap-2" role="status">
        <Icon name="bi-info-circle" />
        <span class="flex-grow-1">Tu cuenta no está configurada como negocio. Activalo en <router-link to="/mi-configuracion">Mi configuración</router-link> para usar esta sección.</span>
      </div>

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
        <hr class="my-4">
        <ContactosForm />
      </Card>

      <!-- 2. Locales -->
      <Card id="seccion-locales" title="Mis locales" icon="bi-geo-alt" class="mb-4">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <p class="gb-text-muted small mb-0">
            Cada local nuevo recibe un código identificador. No se permiten locales duplicados (mismo nombre, dirección y ciudad).
          </p>
          <Button variant="outline" icon="bi-plus-lg" label="Agregar local" @click="abrir_formulario_local()" />
        </div>

        <div class="row g-3 mb-4">
          <div v-for="l in locales" :key="l.id" class="col-12 col-xl-6">
            <LocalResumen :local="l" @editar="abrir_formulario_local(l)" @eliminar="eliminar_local(l)" />
          </div>
        </div>
        <EmptyState v-if="!cargando && !locales.length" size="sm" icon="bi-geo-alt" title="Sin locales"
                    description="Agregá tu primer local para poder cargar precios." />

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
              <select id="precio_local" class="form-select" v-model="local_precios"
                      :class="{ 'is-invalid': err('local') }" :aria-invalid="err('local') ? 'true' : 'false'"
                      :aria-describedby="err('local') ? 'err_local' : null"
                      @change="tocar('local')" @blur="tocar('local')">
                <option :value="null" disabled>Elegí un local</option>
                <option v-for="l in locales" :key="l.id" :value="l.id">{{ l.nombre || 'Sin nombre' }}</option>
                <option :value="SIN_LOCAL">Sin local</option>
              </select>
              <div v-if="err('local')" id="err_local" class="invalid-feedback d-block">{{ err('local') }}</div>
              <small v-else class="form-text gb-text-muted">
                «Sin local» guarda los precios en un local propio que se crea la primera vez.
              </small>
            </div>
            <div class="col-12 col-md-5">
              <label for="precio_fecha" class="form-label fw-semibold">Fecha</label>
              <input id="precio_fecha" type="date" class="form-control" v-model="fecha_precios" :max="dia_desde_hoy(1)"
                     :class="{ 'is-invalid': err('fecha') }" :aria-invalid="err('fecha') ? 'true' : 'false'"
                     :aria-describedby="err('fecha') ? 'err_fecha' : null"
                     @input="tocar('fecha')" @blur="tocar('fecha')">
              <div v-if="err('fecha')" id="err_fecha" class="invalid-feedback d-block">{{ err('fecha') }}</div>
            </div>
          </div>

          <div v-for="(fila, index) in filas" :key="index" class="producto-row">
            <span class="producto-row__num gb-num" aria-hidden="true">{{ index + 1 }}</span>
            <div class="row g-2 flex-grow-1">
              <div class="col-12 col-sm-6 col-lg-3">
                <label :for="'p_nombre' + index" class="form-label small mb-1">Artículo <span class="text-danger" aria-hidden="true">*</span></label>
                <input :id="'p_nombre' + index" type="text" class="form-control" v-model="fila.nombre" placeholder="Arroz" maxlength="200"
                       :class="{ 'is-invalid': err(clave(index, 'nombre')) }" :aria-invalid="err(clave(index, 'nombre')) ? 'true' : 'false'"
                       :aria-describedby="err(clave(index, 'nombre')) ? 'err_nombre_' + index : null"
                       @input="tocar(clave(index, 'nombre'))" @blur="tocar(clave(index, 'nombre'))">
                <div v-if="err(clave(index, 'nombre'))" :id="'err_nombre_' + index" class="invalid-feedback d-block">{{ err(clave(index, 'nombre')) }}</div>
              </div>
              <div class="col-12 col-sm-6 col-lg-2">
                <label :for="'p_marca' + index" class="form-label small mb-1">Marca</label>
                <input :id="'p_marca' + index" type="text" class="form-control" v-model="fila.marca" placeholder="Marolio" maxlength="100"
                       :class="{ 'is-invalid': err(clave(index, 'marca')) }" :aria-invalid="err(clave(index, 'marca')) ? 'true' : 'false'"
                       :aria-describedby="err(clave(index, 'marca')) ? 'err_marca_' + index : null"
                       @input="tocar(clave(index, 'marca'))" @blur="tocar(clave(index, 'marca'))">
                <div v-if="err(clave(index, 'marca'))" :id="'err_marca_' + index" class="invalid-feedback d-block">{{ err(clave(index, 'marca')) }}</div>
              </div>
              <div class="col-12 col-sm-6 col-lg-2">
                <label :for="'p_pres' + index" class="form-label small mb-1">Presentación</label>
                <input :id="'p_pres' + index" type="text" class="form-control" v-model="fila.presentacion" placeholder="1Kg" maxlength="100"
                       :class="{ 'is-invalid': err(clave(index, 'presentacion')) }" :aria-invalid="err(clave(index, 'presentacion')) ? 'true' : 'false'"
                       :aria-describedby="err(clave(index, 'presentacion')) ? 'err_pres_' + index : null"
                       @input="tocar(clave(index, 'presentacion'))" @blur="tocar(clave(index, 'presentacion'))">
                <div v-if="err(clave(index, 'presentacion'))" :id="'err_pres_' + index" class="invalid-feedback d-block">{{ err(clave(index, 'presentacion')) }}</div>
              </div>
              <div class="col-12 col-sm-6 col-lg-2">
                <label :for="'p_precio' + index" class="form-label small mb-1">Precio <span class="text-danger" aria-hidden="true">*</span></label>
                <div class="input-group">
                  <span class="input-group-text">$</span>
                  <input :id="'p_precio' + index" type="text" inputmode="decimal" class="form-control gb-num" v-model="fila.precio" placeholder="1000"
                         :class="{ 'is-invalid': err(clave(index, 'precio')) }" :aria-invalid="err(clave(index, 'precio')) ? 'true' : 'false'"
                         :aria-describedby="err(clave(index, 'precio')) ? 'err_precio_' + index : null"
                         @input="tocar(clave(index, 'precio'))" @blur="tocar(clave(index, 'precio'))">
                </div>
                <div v-if="err(clave(index, 'precio'))" :id="'err_precio_' + index" class="invalid-feedback d-block">{{ err(clave(index, 'precio')) }}</div>
              </div>
              <div class="col-12 col-sm-6 col-lg-3">
                <label :for="'p_foto' + index" class="form-label small mb-1">Foto (opcional, una por artículo)</label>
                <input :id="'p_foto' + index" type="file" class="form-control form-control-sm" accept="image/jpeg,image/png,image/webp"
                       :class="{ 'is-invalid': err(clave(index, 'foto')) }" :aria-invalid="err(clave(index, 'foto')) ? 'true' : 'false'"
                       :aria-describedby="err(clave(index, 'foto')) ? 'err_foto_' + index : null"
                       @change="tocar(clave(index, 'foto')); elegir_foto(fila, $event)">
                <div v-if="err(clave(index, 'foto'))" :id="'err_foto_' + index" class="invalid-feedback d-block">{{ err(clave(index, 'foto')) }}</div>
                <div v-if="fila.foto" class="d-flex align-items-center gap-2 mt-1">
                  <img :src="fila.foto.dataUrl" alt="Foto encuadrada" class="rounded" width="48" height="48" style="object-fit:cover">
                  <small class="form-text gb-text-muted m-0">Se reemplaza la foto previa del artículo</small>
                  <button type="button" class="btn btn-link btn-sm p-0" @click="fila.foto = null">Quitar</button>
                </div>
              </div>
            </div>
            <Button variant="ghost" severity="danger" icon="bi-trash" :ariaLabel="'Quitar artículo ' + (index + 1)" @click="quitar_fila(index)" />
          </div>

          <div v-if="err('productos')" id="err_productos" class="invalid-feedback d-block mt-2">{{ err('productos') }}</div>
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
                <thead class="table-light"><tr><th>Artículo</th><th class="text-end">Precio</th><th class="text-end">Actualizado</th><th class="text-end">Acciones</th></tr></thead>
                <tbody>
                  <tr v-for="p in g.items" :key="p.id">
                    <td>{{ p.producto }}</td>
                    <td class="text-end fw-semibold gb-num">
                      <input v-if="edicion.id === p.id" v-model="edicion.valor" type="text" inputmode="decimal"
                             class="form-control form-control-sm text-end ms-auto" style="max-width: 8rem"
                             :aria-label="`Nuevo precio de ${p.producto}`"
                             @keyup.enter="guardar_edicion(p)" @keyup.esc="cancelar_edicion">
                      <span v-else>{{ formato_moneda(p.precio) }}</span>
                    </td>
                    <td class="text-end small gb-text-muted">{{ formato_fecha(p.fecha) }}</td>
                    <td class="text-end text-nowrap">
                      <template v-if="edicion.id === p.id">
                        <button type="button" class="btn btn-sm btn-primary me-1" :disabled="editando" @click="guardar_edicion(p)">Guardar</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" @click="cancelar_edicion">Cancelar</button>
                      </template>
                      <template v-else>
                        <button type="button" class="btn btn-sm btn-outline-primary me-1" :aria-label="`Editar precio de ${p.producto}`" @click="iniciar_edicion(p)">
                          <i class="bi bi-pencil" aria-hidden="true"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger" :aria-label="`Eliminar precio de ${p.producto}`" @click="eliminar_precio_propio(p)">
                          <i class="bi bi-trash" aria-hidden="true"></i>
                        </button>
                      </template>
                    </td>
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

  <input ref="input_cambio_foto" type="file" class="d-none" accept="image/jpeg,image/png,image/webp" aria-hidden="true" tabindex="-1"
         @change="cambiar_foto_pendiente($event)">
  <RecorteModal :archivo="foto_pendiente.archivo" :ancho="800" :alto="800" titulo="Encuadrar foto del artículo"
                texto-aceptar="Usar esta foto" @aceptar="aceptar_recorte" @cancelar="foto_pendiente = { fila: null, archivo: null }"
                @cambiar="abrir_selector_cambio" />
  <PublicFooter />
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CabeceraNegocio from '../components/publico/CabeceraNegocio.vue'
import LocalResumen from '../components/publico/LocalResumen.vue'
import FormularioLocalModal from '../components/publico/FormularioLocalModal.vue'
import RecorteModal from '../components/publico/RecorteModal.vue'
import PublicTopBar from '../components/publico/PublicTopBar.vue'
import PublicFooter from '../components/publico/PublicFooter.vue'
import ContactosForm from '../components/publico/ContactosForm.vue'
import PerfilNegocioForm from '../components/publico/PerfilNegocioForm.vue'
import { LocalesMapa, useLocales } from '@greenborn/vue-greenborn-locales-mapa'
import '@greenborn/vue-greenborn-map-viewer/style.css'
import { http, guardar_foto_articulo, obtener_mi_perfil, listar_mis_precios, editar_mi_precio, eliminar_mi_precio } from '../api/negocio'
import { validar_precio } from '../utils/precio'
import { dia_desde_hoy, es_fecha_futura, MENSAJE_FECHA_FUTURA } from '../utils/fecha'
import { AppStore } from '../stores/app'

// Mismos campos que config/negocio.js del back (CAMPOS_PERFIL)
const CAMPOS_PERFIL = [
  { nombre: 'nombre_comercial', publicable: true, etiqueta: 'Nombre comercial' },
  { nombre: 'sitio_web', publicable: true, etiqueta: 'Sitio web' },
  { nombre: 'descripcion', tipo: 'texto_largo', publicable: true, etiqueta: 'Descripción' },
]
const TERMINOS_NEGOCIO = { singular: 'negocio', plural: 'negocios' }
const TERMINOS_LOCAL = { singular: 'local', plural: 'locales' }
const FOTO_MAX_BYTES = 2 * 1024 * 1024
const FOTO_TIPOS = ['image/jpeg', 'image/png', 'image/webp']
// Valor del select de local para cargar precios sin un local elegido (el back crea/reutiliza el local propio)
const SIN_LOCAL = 'sin_local'

const storeApp = AppStore()
const { locales, cargando, cargar, crear, actualizar, eliminar } = useLocales({ api: http, base: '/api' })

const mensajeExito = ref('')

const enviandoPrecios = ref(false)
const local_precios = ref(null)
const fecha_precios = ref(dia_desde_hoy())
const filas_vacia = () => ({ nombre: '', marca: '', presentacion: '', precio: '', foto: null, error_foto: '' })
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

// Edición y borrado de precios propios (el back valida que sean del usuario logueado)
const edicion = reactive({ id: null, valor: '' })
const editando = ref(false)

function iniciar_edicion(p) {
  edicion.id = p.id
  edicion.valor = String(p.precio).replace('.', ',')
}

function cancelar_edicion() {
  edicion.id = null
  edicion.valor = ''
}

async function guardar_edicion(p) {
  const validacion = validar_precio(edicion.valor)
  if (!validacion.ok) {
    storeApp.mostrar_alerta(validacion.mensaje)
    return
  }
  editando.value = true
  try {
    await editar_mi_precio(p.id, validacion.precio)
    p.precio = validacion.precio
    cancelar_edicion()
    storeApp.mostrar_alerta('Precio actualizado')
  } catch (err) {
    storeApp.mostrar_alerta(mensaje_error(err, 'No se pudo editar el precio'))
  } finally {
    editando.value = false
  }
}

function eliminar_precio_propio(p) {
  storeApp.mostrar_confirm({
    title: 'Eliminar precio',
    text: `Se eliminará el precio de ${p.producto} en ${p.local || 'el local'}, también de la búsqueda pública. ¿Continuar?`,
    severity_confirmar: 'danger',
    confirmar_accion: async () => {
      try {
        await eliminar_mi_precio(p.id)
        mis_precios.value = mis_precios.value.filter((x) => x.id !== p.id)
        total_precios.value = Math.max(0, total_precios.value - 1)
        storeApp.mostrar_alerta('Precio eliminado')
      } catch (err) {
        storeApp.mostrar_alerta(mensaje_error(err, 'No se pudo eliminar el precio'))
      }
    },
  })
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

const no_es_negocio = computed(() => storeApp.userInfo?.es_negocio === false)

const perfil_id = ref(null)
onMounted(async () => {
  cargar_mis_precios(true)
  cargar()
  obtener_mi_perfil().then((p) => { perfil_id.value = p?.id ?? null }).catch(() => {})
})

// Alta y edición de locales se hacen en un modal. El callback devuelve true si se guardó (el modal se cierra).
function abrir_formulario_local(local = null) {
  const titulo = local ? `Editar local - ${local.nombre || 'sin nombre'}` : 'Nuevo local'
  const modal_form = storeApp.mostrar_modal(FormularioLocalModal, titulo, {
    local,
    _callback_guardar: (datos) => (local ? guardar_local(local, datos) : agregar_local(datos)),
    _cerrar: () => storeApp.ocultar_modal(modal_form.code),
  })
}

async function agregar_local(datos) {
  if (!datos.nombre) {
    storeApp.mostrar_alerta('Debe indicar el nombre del local')
    return false
  }
  try {
    const creado = await crear(datos)
    if (!local_precios.value) local_precios.value = creado.id
    mensajeExito.value = `Local creado. Código: ${creado.codigo || '—'}`
    return true
  } catch (err) {
    storeApp.mostrar_alerta(mensaje_error(err, 'No se pudo crear el local'))
    return false
  }
}

async function guardar_local(local, datos) {
  if (!datos.nombre) {
    storeApp.mostrar_alerta('Debe indicar el nombre del local')
    return false
  }
  try {
    await actualizar(local.id, datos)
    mensajeExito.value = 'Local actualizado'
    return true
  } catch (err) {
    storeApp.mostrar_alerta(mensaje_error(err, 'No se pudo guardar el local'))
    return false
  }
}

function eliminar_local(local) {
  storeApp.mostrar_confirm({
    title: 'Eliminar local',
    text: `Se eliminará "${local.nombre || 'el local'}", sus fotos de artículos y todos sus precios, incluido el histórico, de forma permanente. Esta acción no se puede deshacer. ¿Continuar?`,
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
  // Las claves por posición dejan de corresponder: se descartan los estados de las filas
  for (const k of Object.keys(tocados)) if (k.startsWith('fila-')) delete tocados[k]
  errores_servidor.value = {}
}

// Foto del artículo en curso de encuadre (el archivo se recorta a 800x800 antes de adjuntarse)
const foto_pendiente = ref({ fila: null, archivo: null })

function aceptar_recorte(dataUrl) {
  if (foto_pendiente.value.fila) {
    foto_pendiente.value.fila.foto = { dataUrl }
    foto_pendiente.value.fila.error_foto = ''
  }
  foto_pendiente.value = { fila: null, archivo: null }
}

// Validación compartida de la foto (elegida o tomada con cámara): tipo y tamaño.
// Devuelve el mensaje de error, o null si el archivo es válido.
function validar_foto(archivo) {
  if (!FOTO_TIPOS.includes(archivo.type)) return 'La foto debe ser JPG, PNG o WEBP'
  if (archivo.size > FOTO_MAX_BYTES) return 'La foto supera el máximo de 2 MB'
  return null
}

// Pone un archivo de foto en el recorte para la fila indicada. Devuelve false si no pasó la validación.
function encuadrar_foto(fila, archivo) {
  const error = validar_foto(archivo)
  if (error) {
    fila.error_foto = error
    return false
  }
  fila.error_foto = ''
  foto_pendiente.value = { fila, archivo }
  return true
}

function elegir_foto(fila, evento) {
  fila.error_foto = ''
  const archivo = evento.target.files?.[0] || null
  evento.target.value = ''
  if (!archivo) {
    fila.foto = null
    return
  }
  fila.foto = null
  encuadrar_foto(fila, archivo)
}

// Botón "Cambiar foto" del recorte: abre el selector (cámara sólo en móvil, D7) para la misma fila
const input_cambio_foto = ref(null)
const es_movil = () => window.matchMedia('(max-width: 575.98px)').matches

function abrir_selector_cambio() {
  const input = input_cambio_foto.value
  if (!input) return
  if (es_movil()) input.setAttribute('capture', 'environment')
  else input.removeAttribute('capture')
  input.click()
}

function cambiar_foto_pendiente(evento) {
  const archivo = evento.target.files?.[0] || null
  evento.target.value = ''
  if (!archivo || !foto_pendiente.value.fila) return
  encuadrar_foto(foto_pendiente.value.fila, archivo)
}

// ---- Validación de la carga de precios (mismas reglas que el back, ver validar_carga_precios_negocio)
const LIMITE_NOMBRE = 200
const LIMITE_MARCA = 100
const LIMITE_PRESENTACION = 100

const fila_vacia = (f) => !String(f.nombre || '').trim() && !String(f.marca || '').trim()
  && !String(f.presentacion || '').trim() && String(f.precio ?? '').trim() === '' && !f.foto

// "YYYY-MM-DD" que existe en el calendario (rechaza p. ej. 2026-02-31)
function fecha_valida(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto)
  if (!m) return false
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])
}
const clave = (index, campo) => `fila-${index}-${campo}`

// Errores del formulario: clave -> mensaje. Claves: 'local', 'fecha', 'productos', 'fila-<i>-<campo>'
const errores_locales = computed(() => {
  const e = {}
  if (!local_precios.value) e.local = 'Elegí un local o «Sin local»'
  const f = String(fecha_precios.value || '')
  if (!f) e.fecha = 'Indicá la fecha de los precios'
  else if (!fecha_valida(f)) e.fecha = 'La fecha no es válida'
  else if (es_fecha_futura(f)) e.fecha = MENSAJE_FECHA_FUTURA

  let hay_datos = false
  filas.value.forEach((fila, i) => {
    if (fila.error_foto) e[clave(i, 'foto')] = fila.error_foto
    if (fila_vacia(fila)) return
    const nombre = String(fila.nombre || '').trim()
    const marca = String(fila.marca || '').trim()
    const presentacion = String(fila.presentacion || '').trim()
    const precio = String(fila.precio ?? '').trim()
    hay_datos = true
    if (!nombre) e[clave(i, 'nombre')] = 'El nombre del artículo es obligatorio'
    else if (nombre.length > LIMITE_NOMBRE) e[clave(i, 'nombre')] = `El nombre no puede superar los ${LIMITE_NOMBRE} caracteres`
    if (marca.length > LIMITE_MARCA) e[clave(i, 'marca')] = `La marca no puede superar los ${LIMITE_MARCA} caracteres`
    if (presentacion.length > LIMITE_PRESENTACION) e[clave(i, 'presentacion')] = `La presentación no puede superar los ${LIMITE_PRESENTACION} caracteres`
    const validacion = validar_precio(precio)
    if (!validacion.ok) e[clave(i, 'precio')] = validacion.mensaje
  })
  if (!hay_datos) e.productos = 'Cargá al menos un artículo con nombre y precio'
  return e
})

// Errores que llegan del back o de un envío fallido (se limpian al tocar el campo)
const errores_servidor = ref({})
// Campos tocados (escritos o desenfocados): sólo ellos muestran el error antes de enviar
const tocados = reactive({})
const intento_envio = ref(false)

function tocar(key) {
  tocados[key] = true
  if (errores_servidor.value[key]) delete errores_servidor.value[key]
}
function err(key) {
  if (!intento_envio.value && !tocados[key]) return ''
  return errores_servidor.value[key] || errores_locales.value[key] || ''
}
function limpiar_tocados() {
  for (const k of Object.keys(tocados)) delete tocados[k]
}
const ID_CAMPO = { local: 'precio_local', fecha: 'precio_fecha' }
const ID_CAMPO_FILA = { nombre: 'p_nombre', marca: 'p_marca', presentacion: 'p_pres', precio: 'p_precio', foto: 'p_foto' }
function enfocar(key) {
  const m = /^fila-(\d+)-(\w+)$/.exec(key || '')
  const id = m ? ID_CAMPO_FILA[m[2]] + m[1] : ID_CAMPO[key]
  if (id) nextTick(() => document.getElementById(id)?.focus())
}

// Envío de la carga. Se usa `http` (axios): el error llega como excepción con err.response.data,
// que es lo que leen mensaje_error y los errores por campo.
async function enviar_carga_precios(cuerpo) {
  const { data } = await http.put('/publico/productos/cargar_precios_negocio', cuerpo)
  return data
}

async function enviar_precios() {
  intento_envio.value = true
  errores_servidor.value = {}
  const claves = Object.keys(errores_locales.value)
  if (claves.length) {
    storeApp.mostrar_alerta('Revisá los campos marcados en rojo')
    enfocar(claves[0])
    return
  }

  // origen[k] = posición en el formulario de la fila k enviada
  const origen = filas.value.map((_, i) => i).filter((i) => !fila_vacia(filas.value[i]))
  const validos = origen.map((i) => filas.value[i])
  const cuerpo = {
    ...(local_precios.value === SIN_LOCAL ? { sin_local: true } : { branch_id: local_precios.value }),
    fecha: fecha_precios.value,
    productos: validos.map((f) => ({
      nombre: f.nombre.trim(),
      marca: f.marca.trim(),
      presentacion: f.presentacion.trim(),
      precio: validar_precio(f.precio).precio,
    })),
  }

  enviandoPrecios.value = true
  try {
    const res = await enviar_carga_precios(cuerpo)
    if (!res?.items) {
      storeApp.mostrar_alerta(res?.error || 'No se pudieron cargar los precios')
      return
    }
    const items = res.items
    const detalle = items.detalle || []
    // Filas rechazadas por el back: posición en el formulario y motivo
    const motivo_por_origen = new Map()
    for (const d of detalle) if (!d.ok) motivo_por_origen.set(origen[d.indice], d.error || 'no se pudo guardar')

    // Una foto opcional por artículo: se adjunta al artículo ya registrado (product_id) en el local usado
    const branch = items.branch_id ?? local_precios.value
    let fotos_ok = 0
    let fotos_err = 0
    for (const d of detalle) {
      const archivo = validos[d.indice]?.foto
      if (!d.ok || !archivo) continue
      try {
        await guardar_foto_articulo(branch, d.product_id, archivo.dataUrl)
        fotos_ok++
      } catch {
        fotos_err++
      }
    }

    let texto = `Se cargaron ${items.cargados} precio(s)`
    if (items.con_error) texto += ` (${items.con_error} con error)`
    if (fotos_ok) texto += `. Fotos guardadas: ${fotos_ok}`
    if (fotos_err) texto += `. Fotos con error: ${fotos_err}`
    mensajeExito.value = texto

    // Las filas que fallaron quedan en el formulario, con el motivo en el campo Artículo
    const pendientes = origen.filter((i) => motivo_por_origen.has(i))
    filas.value = pendientes.length ? pendientes.map((i) => filas.value[i]) : [filas_vacia()]
    pendientes.forEach((oi, j) => { errores_servidor.value[clave(j, 'nombre')] = motivo_por_origen.get(oi) })
    if (pendientes.length) storeApp.mostrar_alerta(`Algunas filas no se cargaron: ${pendientes.map((oi) => `Fila ${oi + 1}: ${motivo_por_origen.get(oi)}`).join('; ')}`)
    intento_envio.value = false
    limpiar_tocados()
    cargar_mis_precios(true)
  } catch (err) {
    const datos = err?.response?.data
    if (Array.isArray(datos?.errores) && datos.errores.length) {
      for (const e of datos.errores) {
        const key = e.fila ? clave(origen[e.fila - 1] ?? 0, e.campo) : e.campo
        errores_servidor.value[key] = e.mensaje
      }
      storeApp.mostrar_alerta('Revisá los campos marcados en rojo')
      enfocar(Object.keys(errores_servidor.value)[0])
    } else {
      storeApp.mostrar_alerta(mensaje_error(err, 'Error al enviar los precios'))
    }
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
