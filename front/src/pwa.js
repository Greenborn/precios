/**
 * Registro del service worker (vite-plugin-pwa, registerType: 'prompt').
 *
 * - Se busca una versión nueva al cargar y cada hora.
 * - Cuando hay build nueva, `needRefresh` pasa a true (PwaUpdatePrompt.vue ofrece actualizar).
 * - Si el usuario no actualiza, se aplica sola al ocultarse la pestaña (nunca a mitad de un formulario).
 */
import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

export const needRefresh = ref(false)
export const offlineReady = ref(false)

const CADA_HORA_MS = 60 * 60 * 1000

let updateSW = () => {}

export function applyUpdate() {
  updateSW(true)
}

function aplicarAlOcultarse() {
  const aplicar = () => {
    if (document.visibilityState === 'hidden' && needRefresh.value) {
      document.removeEventListener('visibilitychange', aplicar)
      applyUpdate()
    }
  }
  document.addEventListener('visibilitychange', aplicar)
}

export function initPwa() {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh.value = true
      aplicarAlOcultarse()
    },
    onRegisteredSW(_url, registro) {
      if (registro) setInterval(() => registro.update().catch(() => {}), CADA_HORA_MS)
    },
    onOfflineReady() {
      offlineReady.value = true
    },
  })
}
