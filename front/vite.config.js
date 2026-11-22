import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
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
