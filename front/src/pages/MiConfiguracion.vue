<template>
  <PublicTopBar />

  <main class="pub-main" id="mi-configuracion-cnt">
    <div class="pub-container pub-container--md">
      <PageHeader title="Mi configuración" icon="bi-gear"
                  subtitle="Administrá los datos de tu cuenta y si representás a un negocio."
                  :breadcrumbs="[{ label: 'Inicio', to: '/' }, { label: 'Mi configuración' }]" />

      <Card id="seccion-cuenta" title="Datos de la cuenta" icon="bi-person-gear" class="mb-4">
        <div class="cuenta-form">
          <div class="row g-3">
            <div class="col-12 col-md-6">
              <label for="cuenta_nombre" class="form-label fw-semibold">Nombre</label>
              <input id="cuenta_nombre" v-model="cuenta.name" type="text" class="form-control" maxlength="64" autocomplete="given-name"
                     :class="{ 'is-invalid': errores_cuenta.name }" @blur="flush_guardado">
              <div v-if="errores_cuenta.name" class="invalid-feedback">{{ errores_cuenta.name }}</div>
            </div>
            <div class="col-12 col-md-6">
              <label for="cuenta_apellido" class="form-label fw-semibold">Apellido</label>
              <input id="cuenta_apellido" v-model="cuenta.apellido" type="text" class="form-control" maxlength="128" autocomplete="family-name"
                     :class="{ 'is-invalid': errores_cuenta.apellido }" @blur="flush_guardado">
              <div v-if="errores_cuenta.apellido" class="invalid-feedback">{{ errores_cuenta.apellido }}</div>
            </div>
            <div class="col-12">
              <label for="cuenta_email" class="form-label fw-semibold">Email</label>
              <input id="cuenta_email" v-model="cuenta.email" type="email" class="form-control" maxlength="255" autocomplete="email"
                     :class="{ 'is-invalid': errores_cuenta.email }" @blur="flush_guardado">
              <div v-if="errores_cuenta.email" class="invalid-feedback">{{ errores_cuenta.email }}</div>
            </div>
          </div>
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
            <small class="gb-text-muted" role="status" aria-live="polite">
              <span v-if="estado_guardado === 'pendiente' || estado_guardado === 'guardando'"><i class="bi bi-arrow-repeat me-1" aria-hidden="true"></i>Guardando…</span>
              <span v-else-if="estado_guardado === 'guardado'" class="text-success"><i class="bi bi-check2-circle me-1" aria-hidden="true"></i>Cambios guardados</span>
              <span v-else-if="estado_guardado === 'error'" class="text-danger">{{ mensaje_guardado }}</span>
              <span v-else>Los cambios se guardan automáticamente.</span>
            </small>
            <button type="button" class="btn btn-outline-primary btn-sm" @click="abrir_modal_pass">
              <i class="bi bi-key me-1" aria-hidden="true"></i>Cambiar contraseña
            </button>
          </div>
        </div>
      </Card>

      <Card id="seccion-negocio" title="Represento a un negocio" icon="bi-shop" class="mb-4">
        <div class="form-check form-switch mb-3">
          <input id="switch_negocio" class="form-check-input" type="checkbox" role="switch"
                 :checked="es_negocio" :disabled="guardando_negocio" @change="cambiar_negocio($event.target.checked)">
          <label class="form-check-label fw-semibold" for="switch_negocio">Soy un negocio</label>
        </div>
        <p class="gb-text-muted small mb-0">
          Al activarlo podés configurar el perfil de tu negocio, tus locales y cargar los precios de tus productos.
        </p>

        <div v-if="es_negocio" class="row g-3 mt-2">
          <div class="col-12 col-md-6">
            <router-link to="/mi-negocio?seccion=negocio" class="card h-100 text-decoration-none p-3">
              <span class="fw-semibold"><Icon name="bi-person-vcard" class="me-1" />Perfil y locales</span>
              <small class="gb-text-muted">Datos del negocio, contactos y locales.</small>
            </router-link>
          </div>
          <div class="col-12 col-md-6">
            <router-link to="/mi-negocio?seccion=precios" class="card h-100 text-decoration-none p-3">
              <span class="fw-semibold"><Icon name="bi-basket" class="me-1" />Mis precios</span>
              <small class="gb-text-muted">Cargá los precios de tus productos por local.</small>
            </router-link>
          </div>
        </div>
      </Card>

      <Card id="seccion-zona-peligro" title="Eliminar los datos de mi cuenta" icon="bi-exclamation-triangle" class="mb-4">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <small class="gb-text-muted">Elimina tu perfil, locales, fotos y todos los precios que cargaste. Tu cuenta de acceso se conserva, pero se cerrará la sesión al terminar. No se puede deshacer.</small>
          <button type="button" class="btn btn-outline-danger btn-sm" :disabled="eliminando" @click="eliminar_cuenta">
            <i class="bi bi-trash me-1" aria-hidden="true"></i>Eliminar los datos de mi cuenta
          </button>
        </div>
      </Card>
    </div>
  </main>

  <!-- Modal de cambio de contraseña: sólo se abre con el botón; nunca se autoguarda -->
  <div v-if="modal_pass" class="modal d-block" tabindex="-1" role="dialog" aria-modal="true"
       aria-labelledby="titulo_modal_pass" style="background: rgba(0, 0, 0, 0.5)" @keydown.esc="cerrar_modal_pass">
    <div class="modal-dialog modal-dialog-centered">
      <form class="modal-content" novalidate @submit.prevent="guardar_pass">
        <div class="modal-header">
          <h2 id="titulo_modal_pass" class="modal-title h5">Cambiar contraseña</h2>
          <button type="button" class="btn-close" aria-label="Cerrar" @click="cerrar_modal_pass"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label for="pass_nueva" class="form-label fw-semibold">Contraseña nueva</label>
            <input id="pass_nueva" v-model="pass_form.pass" type="password" class="form-control" autocomplete="new-password" maxlength="128" required>
          </div>
          <div class="mb-3">
            <label for="pass_repetir" class="form-label fw-semibold">Repetir contraseña</label>
            <input id="pass_repetir" v-model="pass_form.pass_repeat" type="password" class="form-control" autocomplete="new-password" maxlength="128" required>
          </div>
          <p class="small gb-text-muted mb-2">Mínimo 8 caracteres, con al menos una letra y un número. No puede ser igual a tu email ni a tu nombre.</p>
          <div v-if="pass_error" class="alert alert-danger py-2 small mb-0" role="alert">{{ pass_error }}</div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" @click="cerrar_modal_pass">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="guardando_pass">Guardar</button>
        </div>
      </form>
    </div>
  </div>

  <PublicFooter />
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, watch } from 'vue'
import PublicTopBar from '../components/publico/PublicTopBar.vue'
import PublicFooter from '../components/publico/PublicFooter.vue'
import { guardarConfig, cambiarPassword } from '@/api/admin/userAdmin'
import { eliminar_datos_cuenta } from '@/api/negocio'
import { logout } from '@/utils/auth'
import { validar_password } from '@/utils/password'
import { AppStore } from '@/stores/app'

const storeApp = AppStore()

const es_negocio = ref(false)
const guardando_negocio = ref(false)
const eliminando = ref(false)

// Borra perfil, locales, fotos y precios. Si el borrado sale bien, cierra la sesión.
function eliminar_cuenta() {
  storeApp.mostrar_confirm({
    title: 'Eliminar los datos de la cuenta',
    text: 'Se borrarán tu perfil, tus locales, las fotos y todos los precios que cargaste, incluido el histórico. Al terminar se cerrará tu sesión. Esta acción no se puede deshacer. ¿Continuar?',
    severity_confirmar: 'danger',
    confirmar_accion: async () => {
      eliminando.value = true
      try {
        await eliminar_datos_cuenta()
      } catch (err) {
        eliminando.value = false
        storeApp.mostrar_alerta(err?.response?.data?.error || 'No se pudieron eliminar los datos de la cuenta')
        return
      }
      eliminando.value = false
      await logout(storeApp)
    },
  })
}

// ---------- Datos de la cuenta: autoguardado con debounce (sin botón) ----------
const DEBOUNCE_MS = 800
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const cuenta = reactive({ id: '', name: '', apellido: '', email: '' })
const errores_cuenta = reactive({ name: '', apellido: '', email: '' })
const estado_guardado = ref('')        // '', 'pendiente', 'guardando', 'guardado', 'error'
const mensaje_guardado = ref('')
let timer_debounce = null
let guardando_cuenta = false
let cambios_en_vuelo = false
let cargando_modelo = false

function validar_cuenta() {
  const nombre = cuenta.name.trim()
  const apellido = cuenta.apellido.trim()
  const email = cuenta.email.trim()
  errores_cuenta.name = nombre.length < 2 || nombre.length > 64 ? 'Entre 2 y 64 caracteres' : ''
  errores_cuenta.apellido = apellido.length > 128 ? 'Máximo 128 caracteres' : ''
  errores_cuenta.email = !EMAIL_RE.test(email) || email.length > 255 ? 'Ingresá un email válido' : ''
  return !errores_cuenta.name && !errores_cuenta.apellido && !errores_cuenta.email
}

// Cada cambio reinicia el temporizador: se guarda ~800 ms después del último cambio
function programar_guardado() {
  estado_guardado.value = 'pendiente'
  clearTimeout(timer_debounce)
  timer_debounce = setTimeout(guardar_cuenta, DEBOUNCE_MS)
}

// Guarda de inmediato si hay un cambio esperando (al salir de un campo o de la página)
function flush_guardado() {
  if (!timer_debounce) return
  clearTimeout(timer_debounce)
  timer_debounce = null
  guardar_cuenta()
}

async function guardar_cuenta() {
  timer_debounce = null
  // Si ya hay un guardado en curso, se vuelve a guardar al terminar con el último valor
  if (guardando_cuenta) { cambios_en_vuelo = true; return }
  if (!validar_cuenta()) {
    estado_guardado.value = 'error'
    mensaje_guardado.value = 'Revisá los campos marcados'
    return
  }
  guardando_cuenta = true
  estado_guardado.value = 'guardando'
  const datos = { id: cuenta.id, name: cuenta.name.trim(), apellido: cuenta.apellido.trim(), email: cuenta.email.trim() }
  try {
    const resp = await guardarConfig(datos)
    if (resp?.stat === false || resp?.error) throw new Error(resp.text || resp.msg || 'No se pudo guardar')
    storeApp.userInfo = { ...storeApp.userInfo, name: datos.name, apellido: datos.apellido, email: datos.email }
    estado_guardado.value = 'guardado'
    mensaje_guardado.value = ''
  } catch (err) {
    estado_guardado.value = 'error'
    mensaje_guardado.value = err?.message || 'No se pudo guardar'
  } finally {
    guardando_cuenta = false
    if (cambios_en_vuelo) {
      cambios_en_vuelo = false
      programar_guardado()
    }
  }
}

function actualizar_modelo() {
  const u = storeApp.userInfo || {}
  cargando_modelo = true
  cuenta.id = u.id || ''
  cuenta.name = u.name || ''
  cuenta.apellido = u.apellido || ''
  cuenta.email = u.email || ''
  es_negocio.value = Boolean(u.es_negocio)
  // Se libera en el siguiente tick para que el watch no tome la carga inicial como cambio
  setTimeout(() => { cargando_modelo = false }, 0)
}

watch(() => [cuenta.name, cuenta.apellido, cuenta.email], () => {
  if (!cargando_modelo) programar_guardado()
})

// ---------- Cambio de contraseña (modal) ----------
const modal_pass = ref(false)
const pass_form = reactive({ pass: '', pass_repeat: '' })
const pass_error = ref('')
const guardando_pass = ref(false)

function abrir_modal_pass() {
  pass_form.pass = ''
  pass_form.pass_repeat = ''
  pass_error.value = ''
  modal_pass.value = true
}

function cerrar_modal_pass() {
  modal_pass.value = false
  pass_form.pass = ''
  pass_form.pass_repeat = ''
}

async function guardar_pass() {
  pass_error.value = ''
  if (pass_form.pass !== pass_form.pass_repeat) {
    pass_error.value = 'Las contraseñas no coinciden'
    return
  }
  const regla = validar_password(pass_form.pass, { email: cuenta.email.trim(), name: cuenta.name.trim() })
  if (regla) {
    pass_error.value = regla
    return
  }
  guardando_pass.value = true
  try {
    const resp = await cambiarPassword({ pass: pass_form.pass, pass_repeat: pass_form.pass_repeat })
    if (resp?.stat === false || resp?.error) {
      pass_error.value = resp.text || resp.msg || 'No se pudo cambiar la contraseña'
      return
    }
    cerrar_modal_pass()
    storeApp.mostrar_alerta('Contraseña actualizada')
  } catch {
    pass_error.value = 'No se pudo cambiar la contraseña'
  } finally {
    guardando_pass.value = false
    pass_form.pass = ''
    pass_form.pass_repeat = ''
  }
}

// ---------- Negocio ----------
async function cambiar_negocio(valor) {
  guardando_negocio.value = true
  try {
    const resp = await guardarConfig({ es_negocio: valor })
    if (resp?.stat === false) {
      storeApp.mostrar_alerta(resp.text || 'No se pudo guardar la configuración')
    } else {
      storeApp.mostrar_alerta(valor ? 'Tu cuenta quedó configurada como negocio' : 'Tu cuenta ya no está configurada como negocio')
      storeApp.userInfo = { ...storeApp.userInfo, es_negocio: valor }
    }
  } catch {
    storeApp.mostrar_alerta('No se pudo guardar la configuración')
  } finally {
    es_negocio.value = Boolean(storeApp.userInfo?.es_negocio)
    guardando_negocio.value = false
  }
}

onMounted(() => {
  actualizar_modelo()
})

// Si el usuario sale de la página con un cambio pendiente, se guarda antes de desmontar
onBeforeUnmount(() => {
  flush_guardado()
})
</script>

<style scoped>
.cuenta-form { max-width: 560px; }
</style>
