// Smoke tests: el frontend carga y el backend responde con la respuesta esperada.
import { test, expect } from '@playwright/test'

const API_URL = process.env.E2E_API_URL || 'http://localhost:3044'

test('el frontend carga sin errores de página', async ({ page }) => {
  const errores = []
  page.on('pageerror', (e) => errores.push(e.message))
  const resp = await page.goto('/')
  expect(resp?.ok()).toBeTruthy()
  await expect(page.locator('#app')).not.toBeEmpty()
  expect(errores).toEqual([])
})

test('el backend exige sesión en rutas admin', async ({ request }) => {
  const res = await request.get(`${API_URL}/admin/user/info`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body).toMatchObject({ stat: false, code: 'DO_LOGIN' })
})
