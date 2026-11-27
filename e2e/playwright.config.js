// Configuración de Playwright para los tests end-to-end.
// Requiere front (vite :3000) y back levantados. Usar ./dev.sh desde la raíz,
// o definir E2E_BASE_URL para apuntar a otro entorno.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
