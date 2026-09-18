<template>
  <div class="fluid-container login-container">
    <div class="row h-100 py-5">

      <div class="form-cont col col-sm-10 offset-sm-1 col-md-8 offset-md-2 col-xl-6 offset-xl-3 col-xxl-4 offset-xxl-4">
        <div class="row">
          <div class="col text-center">
            <h3 class="title mb-1">Ingreso al sistema</h3>
            <p class="subtitle mb-4">Administración de precios</p>
          </div>
        </div>

        <div v-if="error_login" class="row">
          <div class="col">
            <div class="alert alert-danger py-2 mb-4" role="alert">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ error_login }}
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <label for="email1" class="mb-1">Email</label>
            <div class="input-icon-wrap mb-3">
              <i class="bi bi-envelope field-icon"></i>
              <InputText id="email1" v-model="login_data.email" type="text" class="el-input w-100" placeholder="usuario@usuario.com"/>
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <label for="password1" class="mb-1">Contraseña</label>
            <div class="input-icon-wrap mb-4">
              <i class="bi bi-lock field-icon"></i>
              <InputPassword id="password1" v-model="login_data.password" placeholder="contraseña" :toggleMask="true"
                  class="el-input w-100" inputClass="w-100" :feedback="false"></InputPassword>
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col mb-4">
            <Button label="Login" class="w-100 btn-login-green" v-on:click="do_login()"></Button>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <div class="divider mb-4">
              <span>o</span>
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <button type="button" class="btn btn-google w-100" v-on:click="iniciar_sso()">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Ingresar con Google
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
  <Spinner :loading="storeApp.loading"></Spinner>
</template>

<script setup >
import useVuelidate from '@vuelidate/core'
import { useRouter } from 'vue-router'
import { required, email } from '@vuelidate/validators'
import { ref } from 'vue';
import Spinner   from '../components/layout/Spinner.vue'

import { AppStore } from "../stores/app";
import { login } from '../api/admin/userAdmin'
import { setUserInfo } from '../utils/auth'
import { iniciar_sso } from '../utils/sso'

const storeApp = AppStore();

const login_data = ref({
  'email': '',
  'password': '',
  'remember': false
})

const error_login = ref('')

const router = useRouter()

async function do_login() {
  storeApp.loading = true
  error_login.value = ''
  let login_req = await login(login_data.value)
  if (login_req.stat) {
    storeApp.loading = false
    setUserInfo( 'admin', storeApp, login_req.data.u_data, router, login_req.data.token)
    router.replace('/admin/dashboard')
  } else {
    storeApp.loading = false
    error_login.value = login_req?.text || login_req?.msg || 'Email o contraseña incorrectos'
    console.log('login fallido', {
      stat: login_req?.stat,
      texto: login_req?.text,
      error: login_req?.error,
      msg: login_req?.msg,
      origin: window.location.origin,
      email: login_data.value.email,
    })
  }
}
</script>

<style scoped>
.title {
  font-weight: 700;
  color: #1f2937;
}

.subtitle {
  font-size: 0.9rem;
  color: #6b7280;
}

label {
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
}

.input-icon-wrap {
  position: relative;
}

.field-icon {
  position: absolute;
  top: 50%;
  left: 0.9rem;
  transform: translateY(-50%);
  color: #6b7280;
  pointer-events: none;
  z-index: 5;
}

.input-icon-wrap :deep(input.form-control) {
  padding-left: 2.5rem;
  border-radius: 10px;
}

.input-icon-wrap :deep(input.form-control):focus {
  border-color: #20c997;
  box-shadow: 0 0 0 0.2rem rgba(32, 201, 151, 0.25);
}

.btn.btn-login-green,
.btn.btn-login-green:focus {
  background-color: #20c997;
  border-color: #20c997;
  color: #fff;
  font-weight: 600;
  border-radius: 10px;
  padding: 0.65rem 1rem;
}

.btn.btn-login-green:hover {
  background-color: #1aa87f;
  border-color: #1aa87f;
  color: #fff;
}

.divider {
  display: flex;
  align-items: center;
  color: #6b7280;
  font-size: 0.85rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #d1d5db;
}

.divider span {
  padding: 0 1rem;
}

.btn-google {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  background: #fff;
  border: 1px solid #dadce0;
  border-radius: 10px;
  color: #3c4043;
  font-weight: 600;
  padding: 0.65rem 1rem;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}

.btn-google:hover {
  background: #f8f9fa;
  box-shadow: 0 1px 4px rgba(60, 64, 67, 0.3);
  color: #3c4043;
}
</style>
