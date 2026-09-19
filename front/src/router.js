import { createRouter, createWebHashHistory } from "vue-router"
import { getToken } from './utils/auth'

import Layout from './components/layout/Layout.vue'

export const routes = [
  {
    path: "/",
    name: "dashboard",
    component: () => import("./pages/LandingGeneral.vue"),
  },
  {
    path: "/admin",
    name: "root",
    component: Layout,
    children: [],
  },
  {
    path: "/carga_precio",
    name: "carga_precio",
    component: () => import("./pages/CargaComunitaria.vue"),
    meta: { requiere_sesion: true },
  },
  {
    path: "/novedades",
    name: "novedades",
    component: () => import("./pages/Novedades.vue"),
  },
  {
    path: "/categorias",
    name: "categorias",
    component: () => import("./pages/NavegaCategorias.vue"),
  },
  {
    path: "/ofertas",
    name: "listado_ofertas",
    component: () => import("./pages/ListadoOfertas.vue"),
  },
  {
    path: "/estadisticas",
    name: "estadisticas",
    component: () => import("./pages/EstadisticasGenerales.vue"),
  },
  {
    path: "/calcula_trueque",
    name: "calcula_trueque",
    component: () => import("./pages/CalculadoraTrueque.vue"),
  },
  {
    path: "/admin/login",
    name: "login_admin",
    component: () => import("./pages/LoginAdmin.vue"),
  },
  {
    path: "/admin/login-redirect",
    name: "login_redirect",
    component: () => import("./pages/LoginRedirect.vue"),
  },
  {
    path: '/404',
    name: '404',
    component: () => import('./pages/NotFound.vue')
  },
  {
    path: '/error',
    name: 'error',
    component: () => import('./pages/Error.vue')
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
