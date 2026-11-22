import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { VitePWA } from 'vite-plugin-pwa'

const { version: appVersion } = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    // Versión del frontend (package.json), bumpeada por deploy-update.sh
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    vue(),
    VitePWA({
      // 'prompt': el SW nuevo no reemplaza al activo hasta que el usuario confirma
      // (ver src/pwa.js + PwaUpdatePrompt.vue).
      registerType: 'prompt',
      injectRegister: null,
      // El manifest sigue en public/manifest.json (linkeado desde index.html).
      manifest: false,
      workbox: {
        // Las /api nunca se cachean (datos de sesión/precios).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,ico,png,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/images/'),
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  base: "",
  build: {
    //target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rolldownOptions: {
      output: {
        // Vendor estable en chunks propios (mejor cache entre deploys).
        // chart.js queda fuera: se carga diferido desde ui/Chart.vue.
        codeSplitting: {
          groups: [
            { name: 'vendor-vue', test: /node_modules[\\/](@vue|vue|vue-router|pinia)[\\/]/ },
            { name: 'vendor-bootstrap', test: /node_modules[\\/](bootstrap|@popperjs)[\\/]/ },
          ],
        },
      },
    },
  },

  publicDir: './public',

  css: {
    preprocessorOptions: {
      scss: {
        // Bootstrap 5.3 usa @import/funciones globales: silenciar ruido de Dart Sass
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },

  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
    alias: {
      "@": fileURLToPath(new URL('./src', import.meta.url)),
      '~bootstrap':  fileURLToPath(new URL('./node_modules/bootstrap', import.meta.url)),
    },
  },

  server: {
    host: true
  }
})
