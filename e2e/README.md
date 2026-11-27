# Tests end-to-end (Playwright)

Requisitos: front (Vite, `:3000`) y back (`:3044`) levantados, p. ej. con `./dev.sh` desde la raíz.

```bash
cd e2e
npm install            # primera vez
npx playwright install chromium   # primera vez
npm run test:e2e       # ejecuta la suite
npm run test:e2e:ui    # modo interactivo
npm run test:e2e:report
```

Variables opcionales:
- `E2E_BASE_URL` (default `http://localhost:3000`): URL del front.
- `E2E_API_URL` (default `http://localhost:3044`): URL del back.

Estado: suite mínima (smoke). Falta cubrir flujos reales (login, ABM, búsqueda de precios).
