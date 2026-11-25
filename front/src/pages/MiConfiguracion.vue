<template>
  <PublicTopBar />

  <main class="pub-main" id="mi-configuracion-cnt">
    <div class="pub-container pub-container--md">
      <PageHeader title="Mi configuración" icon="bi-gear"
                  subtitle="Administrá los datos de tu cuenta y si representás a un negocio."
                  :breadcrumbs="[{ label: 'Inicio', to: '/' }, { label: 'Mi configuración' }]" />

      <Card id="seccion-cuenta" title="Datos de la cuenta" icon="bi-person-gear" class="mb-4">
        <div class="cuenta-form">
          <FormularioGenerico ref="ref_formulario" :parametros="config_formulario"></FormularioGenerico>
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
    </div>
  </main>
  <PublicFooter />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import PublicTopBar from '../components/publico/PublicTopBar.vue'
import PublicFooter from '../components/publico/PublicFooter.vue'
import FormularioGenerico from '@/components/genericos/FormularioGenerico'
import { guardarConfig } from '@/api/admin/userAdmin'
import { getUserInfo } from '@/utils/auth'
import { AppStore } from '@/stores/app'

const storeApp = AppStore()

const es_negocio = ref(false)
const guardando_negocio = ref(false)

const formulario_config = ref({
  'id': '',
  'name': '',
  'apellido': '',
  'email': '',
  'pass': '********',
  'pass_repeat': '********',
})

const ref_formulario = ref(null)

const campos_form_config = ref([
  { field: 'id',          visible_form: false },
  { field: 'name',        headerName: 'Nombre', required: true, form_min_max: [2, 64]  },
  { field: 'apellido',    headerName: 'Apellido', form_min_max: [2, 128] },
  { field: "email",       headerName: "Email",  required: true, form_min_max: [2, 255] },
  { field: "pass",        headerName: "Contraseña", required: true,  form_min_max: [2, 128], form_type: 'password' },
  { field: "pass_repeat", headerName: 'Repetir contraseña', required: true, form_type: 'password'  },
])

const config_formulario = ref({
  "onSubmit": guardarConfig,
  "guardado": configuracion_guardada,
  "modelo": formulario_config.value,
  "campos": campos_form_config.value,
  "buttons": { 'cancel': { 'visible': false } },
})

async function configuracion_guardada(resp) {
  storeApp.mostrar_alerta(resp.text)
  await refrescar_usuario()
}

// Vuelve a leer la sesión para mantener sincronizados nombre, email y el switch de negocio
async function refrescar_usuario() {
  const user_info = await getUserInfo('admin')
  if (user_info) {
    storeApp.userInfo = user_info.data
    actualizar_modelo()
  }
}

function actualizar_modelo() {
  const u = storeApp.userInfo || {}
  formulario_config.value.name = u.name || ''
  formulario_config.value.apellido = u.apellido || ''
  formulario_config.value.email = u.email || ''
  formulario_config.value.id = u.id || ''
  es_negocio.value = Boolean(u.es_negocio)
  ref_formulario.value?.actualizar_modelo()
}

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
</script>

<style scoped>
.cuenta-form { max-width: 560px; }
</style>
