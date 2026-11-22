<template>
  <div class="admin-login">
    <aside class="admin-login__brand" aria-hidden="true">
      <div class="admin-login__brand-inner">
        <div class="admin-login__logo"><Icon name="bi-tags-fill" size="1.5rem" /></div>
        <h2 class="admin-login__brand-title">Precios <span>Admin</span></h2>
        <p class="admin-login__brand-text">Gestioná el catálogo, las categorías, los alias y los precios que carga la comunidad desde un solo lugar.</p>
        <ul class="admin-login__features">
          <li><Icon name="bi-diagram-3" /> Catálogo y categorías</li>
          <li><Icon name="bi-people" /> Precios comunitarios</li>
          <li><Icon name="bi-shield-lock" /> Accesos por roles y permisos</li>
        </ul>
      </div>
    </aside>

    <main class="admin-login__panel">
      <form class="admin-login__form" novalidate @submit.prevent="do_login()">
        <div class="admin-login__logo admin-login__logo--mobile d-md-none" aria-hidden="true"><Icon name="bi-tags-fill" size="1.5rem" /></div>
        <h1 class="title mb-1">Ingreso al sistema</h1>
        <p class="subtitle mb-4">Administración de precios</p>

        <div v-if="error_login" class="alert alert-danger d-flex align-items-start gap-2 py-2 mb-4" role="alert">
          <Icon name="bi-exclamation-triangle-fill" class="mt-1" />
          <span>{{ error_login }}</span>
        </div>

        <div class="mb-3">
          <label for="email1" class="form-label mb-1">Email</label>
          <div class="input-icon-wrap">
            <Icon name="bi-envelope" class="field-icon" />
            <InputText id="email1" v-model="login_data.email" type="email" autocomplete="username"
              class="el-input w-100" :class="{ 'is-invalid': errores.email }" placeholder="usuario@usuario.com"
              :aria-invalid="errores.email ? 'true' : 'false'" aria-describedby="email1-error"
              @input="errores.email = ''" />
          </div>
          <div v-if="errores.email" id="email1-error" class="gb-field__error">{{ errores.email }}</div>
        </div>

        <div class="mb-4">
          <label for="password1" class="form-label mb-1">Contraseña</label>
          <div class="input-icon-wrap" :class="{ 'is-invalid-wrap': errores.password }">
            <Icon name="bi-lock" class="field-icon" />
            <InputPassword id="password1" v-model="login_data.password" placeholder="contraseña" :toggleMask="true"
                class="el-input w-100" inputClass="w-100" :feedback="false" autocomplete="current-password"
                @update:modelValue="errores.password = ''"></InputPassword>
          </div>
          <div v-if="errores.password" class="gb-field__error">{{ errores.password }}</div>
        </div>

        <Button type="submit" label="Ingresar" class="w-100 mb-4" size="lg" :loading="storeApp.loading" />

        <div class="divider mb-4">
          <span>o</span>
        </div>

        <button type="button" class="btn btn-google w-100" v-on:click="iniciar_sso_destino()">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
          Ingresar con Google
        </button>
      </form>
    </main>
  </div>
  <Spinner :loading="storeApp.loading"></Spinner>
</template>

<script setup >
import useVuelidate from '@vuelidate/core'
import { useRouter, useRoute } from 'vue-router'
import { required, email } from '@vuelidate/validators'
import { ref } from 'vue';
import Spinner   from '../components/layout/Spinner.vue'

import { AppStore } from "../stores/app";
import { login } from '../api/admin/userAdmin'
import { setUserInfo } from '../utils/auth'
import { iniciar_sso, setRedirectAfterLogin } from '../utils/sso'

const storeApp = AppStore();

const login_data = ref({
  'email': '',
  'password': '',
  'remember': false
})

const error_login = ref('')
const errores = ref({ email: '', password: '' })

// Validacion inline (solo UX, antes de llamar a la API)
function validar(){
  const e = (login_data.value.email || '').trim()
  errores.value.email = !e ? 'Ingresá tu email' : (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? 'El email no tiene un formato válido' : '')
  errores.value.password = !login_data.value.password ? 'Ingresá tu contraseña' : ''
  return !errores.value.email && !errores.value.password
}

const router = useRouter()
const route = useRoute()

// Destino post-login: la ruta original (query redirect) o el panel por defecto
function destino_post_login(){
  return route.query.redirect || '/admin/dashboard'
}

// El flujo SSO pierde la query al volver del SSO central,
// por eso el destino se guarda en localStorage antes de redirigir
function iniciar_sso_destino(){
  setRedirectAfterLogin(route.query.redirect)
  iniciar_sso()
}

async function do_login() {
  if (!validar()) return
  storeApp.loading = true
  error_login.value = ''
  let login_req = await login(login_data.value)
  if (login_req.stat) {
    storeApp.loading = false
    setUserInfo( 'admin', storeApp, login_req.data.u_data, router, login_req.data.token)
    router.replace(destino_post_login())
  } else {
    storeApp.loading = false
    error_login.value = login_req?.text || login_req?.msg || 'Email o contraseña incorrectos'
  }
}
</script>

<style scoped>
.admin-login {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 1fr;
  background: var(--gb-bg);
}
@media (min-width: 768px) {
  .admin-login { grid-template-columns: minmax(320px, 5fr) 7fr; }
}

.admin-login__brand {
  display: none;
  position: relative;
  overflow: hidden;
  color: var(--gb-on-primary);
  background:
    radial-gradient(circle at 15% 20%, rgba(22, 163, 74, 0.35), transparent 50%),
    radial-gradient(circle at 85% 85%, rgba(15, 118, 110, 0.35), transparent 45%),
    var(--gb-sidebar-bg);
}
@media (min-width: 768px) {
  .admin-login__brand { display: flex; align-items: center; justify-content: center; padding: var(--gb-space-7); }
}
.admin-login__brand-inner { max-width: 380px; }
.admin-login__logo {
  display: inline-flex; align-items: center; justify-content: center;
  width: 52px; height: 52px; border-radius: var(--gb-radius);
  background: var(--gb-primary); color: var(--gb-on-primary);
  box-shadow: var(--gb-shadow);
  margin-bottom: var(--gb-space-5);
}
.admin-login__logo--mobile { margin-bottom: var(--gb-space-4); }
.admin-login__brand-title { color: var(--gb-on-primary); font-size: 2rem; font-weight: 700; margin-bottom: var(--gb-space-3); }
.admin-login__brand-title span { color: var(--gb-brand-accent-light); }
.admin-login__brand-text { color: rgba(226, 232, 240, 0.8); line-height: 1.6; margin-bottom: var(--gb-space-6); }
.admin-login__features { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--gb-space-3); color: rgba(226, 232, 240, 0.9); }
.admin-login__features li { display: flex; align-items: center; gap: var(--gb-space-3); }
.admin-login__features :deep(.bi) {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: var(--gb-radius-sm);
  background: rgba(255, 255, 255, 0.08); color: var(--gb-brand-accent-light);
}

.admin-login__panel {
  display: flex; align-items: center; justify-content: center;
  padding: var(--gb-space-6) var(--gb-space-4);
}
.admin-login__form {
  width: 100%;
  max-width: 400px;
  background: var(--gb-surface);
  border: 1px solid var(--gb-border);
  border-radius: var(--gb-radius-lg);
  box-shadow: var(--gb-shadow);
  padding: var(--gb-space-6) var(--gb-space-5);
}
@media (min-width: 768px) {
  .admin-login__form { border: 0; box-shadow: none; background: transparent; padding: 0; }
}

.title { font-size: 1.625rem; font-weight: 700; color: var(--gb-heading); }
.subtitle { font-size: 0.9375rem; color: var(--gb-text-muted); }

.form-label { font-weight: 600; color: var(--gb-text); font-size: 0.875rem; }

.input-icon-wrap { position: relative; }
.field-icon {
  position: absolute;
  top: 50%;
  left: 0.9rem;
  transform: translateY(-50%);
  color: var(--gb-text-muted);
  pointer-events: none;
  z-index: 5;
}
.input-icon-wrap :deep(input.form-control) {
  padding-left: 2.5rem;
  height: 2.75rem;
}
.is-invalid-wrap :deep(input.form-control) { border-color: var(--gb-danger); }

.divider {
  display: flex;
  align-items: center;
  color: var(--gb-text-muted);
  font-size: 0.85rem;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--gb-border);
}
.divider span { padding: 0 1rem; }

/* Colores oficiales de Google en el boton (no son tokens de marca) */
.btn-google {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  height: 2.75rem;
  background: var(--gb-surface);
  border: 1px solid var(--gb-border-strong);
  border-radius: var(--gb-radius-sm);
  color: var(--gb-text);
  font-weight: 600;
  transition: background-color var(--gb-transition-fast), box-shadow var(--gb-transition-fast);
}
.btn-google:hover { background: var(--gb-surface-2); box-shadow: var(--gb-shadow-sm); color: var(--gb-text); }
.btn-google:focus-visible { outline: none; box-shadow: var(--gb-focus-ring); }
</style>
