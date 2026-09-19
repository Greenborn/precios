<template>
  <div class="fluid-container login-container">
    <div class="row h-100 py-5">

      <div class="form-cont col col-sm-10 offset-sm-1 col-md-8 offset-md-2 col-xl-6 offset-xl-3 col-xxl-4 offset-xxl-4 text-center">
        <div class="row">
          <div class="col">
            <h3 class="title">
              <i class="bi bi-google me-2"></i>Ingresando con Google
            </h3>
          </div>
        </div>

        <div class="row">
          <div class="col my-4">
            <div v-if="!error_text" class="spinner-border text-success mb-3" role="status"></div>
            <p v-if="error_text" class="text-danger mb-2">{{ error_text }}</p>
            <p v-else class="text-muted mb-2">Validando sesión, aguardá un momento…</p>
          </div>
        </div>
      </div>

    </div>
  </div>
  <Spinner :loading="storeApp.loading"></Spinner>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Spinner   from '../components/layout/Spinner.vue'

import { AppStore } from "../stores/app"
import { ssoLogin } from '../api/admin/userAdmin'
import { setUserInfo } from '../utils/auth'
import { getUniqueId, canjear_token_temporal, getRedirectAfterLogin, limpiarRedirectAfterLogin } from '../utils/sso'

const route = useRoute()
const router = useRouter()
const storeApp = AppStore()

const error_text = ref('')

onMounted(procesar_callback)

async function procesar_callback() {
  storeApp.loading = true

  const token = route.query.token
  const unique_id = route.query.unique_id

  if (!token || !unique_id) return fallo('No se recibieron credenciales del SSO')
  if (getUniqueId() !== unique_id) return fallo('La sesión del navegador no coincide con la del SSO')

  try {
    const sso_data = await canjear_token_temporal(token)

    const login_req = await ssoLogin({ token: sso_data.bearer_token, unique_id })
    if (login_req.stat) {
      setUserInfo('admin', storeApp, login_req.data.u_data, router, login_req.data.token)
      storeApp.loading = false
      // Volver a la ruta original (p.ej. /carga_precio) si se guardó antes del SSO
      const destino = route.query.redirect || getRedirectAfterLogin() || '/admin/dashboard'
      limpiarRedirectAfterLogin()
      router.replace(destino)
      return
    }
    fallo(login_req.text || 'No se pudo iniciar sesión')
  } catch (error) {
    fallo(error?.message || 'Error al validar la sesión SSO')
  }
}

function fallo(texto) {
  storeApp.loading = false
  error_text.value = texto
  setTimeout(() => router.replace('/admin/login'), 3000)
}
</script>

<style scoped>
.title {
  font-weight: 700;
  color: #1f2937;
}
</style>
