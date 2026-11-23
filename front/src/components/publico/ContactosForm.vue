<template>
  <div class="contactos-fb">
    <h5 class="mb-2">Datos de contacto y redes</h5>
    <p class="text-muted">
      Todos los datos son opcionales. Dejá vacío el que no quieras cargar y apagá
      <em>Mostrar en mi perfil</em> para guardarlo sin publicarlo. Podés cargar más de un
      dato de cada tipo (por ejemplo dos teléfonos o dos emails).
    </p>

    <!-- Una card por tipo de contacto: 1 columna en móvil, 2 en tablet y 3 en desktop -->
    <div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
      <div v-for="tipo in tipos" :key="tipo.tipo" class="col">
        <div class="card h-100 contacto-card" role="group" :aria-label="tipo.label">
          <div class="card-body">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="contacto-marca" :style="estiloMarca(tipo)">
              <i :class="['bi', tipo.icono]" aria-hidden="true"></i>
            </span>
            <span class="fw-semibold">{{ tipo.label }}</span>
          </div>

          <div v-for="(fila, indice) in valores[tipo.tipo]" :key="indice" class="contacto-dato mb-3">
            <label class="form-label small mb-1" :for="`contacto-${tipo.tipo}-${indice}`">
              {{ valores[tipo.tipo].length > 1 ? `${tipo.label} ${indice + 1}` : tipo.label }}
            </label>
            <div class="d-flex gap-2">
              <input
                :id="`contacto-${tipo.tipo}-${indice}`"
                v-model="fila.valor"
                class="form-control"
                :placeholder="tipo.placeholder"
                :type="tipo.tipo === 'telefono' || tipo.tipo === 'whatsapp' ? 'tel' : tipo.tipo === 'email' ? 'email' : 'text'"
                maxlength="255"
                autocomplete="off"
                :aria-describedby="`contacto-ayuda-${tipo.tipo}`"
              />
              <button
                v-if="valores[tipo.tipo].length > 1"
                type="button"
                class="btn btn-danger"
                :aria-label="`Quitar ${tipo.label} ${indice + 1}`"
                :title="`Quitar ${tipo.label} ${indice + 1}`"
                @click="quitar(tipo.tipo, indice)"
              >
                <i class="bi bi-trash" aria-hidden="true"></i>
              </button>
            </div>
            <div class="form-check form-switch mt-2">
              <input
                :id="`contacto-visible-${tipo.tipo}-${indice}`"
                v-model="fila.visible"
                class="form-check-input"
                type="checkbox"
                :disabled="!fila.valor"
              />
              <label class="form-check-label" :for="`contacto-visible-${tipo.tipo}-${indice}`">
                Mostrar en mi perfil
              </label>
            </div>
          </div>

          <div :id="`contacto-ayuda-${tipo.tipo}`" class="form-text mb-2">{{ tipo.ayuda }}</div>
          <button
            v-if="valores[tipo.tipo].length < maxPorTipo"
            type="button"
            class="btn btn-success btn-sm"
            @click="agregar(tipo.tipo)"
          >
            <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Agregar otro {{ tipo.label }}
          </button>
          </div>
        </div>
      </div>
    </div>

    <p class="form-text mb-0 mt-3" role="status">{{ guardando ? 'Guardando…' : mensaje }}</p>

    <div class="card contacto-card mt-4">
      <div class="card-body">
        <h6>Así se ven en tu perfil</h6>
        <p class="text-muted small">
          Los vecinos ven sólo los datos que marcaste como visibles. Cada icono abre el
          sitio correspondiente en una pestaña nueva. La vista previa se actualiza al guardar.
        </p>
        <ContactosPerfil :contactos="contactosVisibles" con-etiqueta />
      </div>
    </div>
  </div>
</template>

<script>
import { AppStore } from '../../stores/app'
import { obtener_mis_contactos, guardar_mis_contactos } from '../../api/negocio'
import { TIPOS_CONTACTO } from '../../data/contactos'
import ContactosPerfil from './ContactosPerfil.vue'

const DEBOUNCE_GUARDADO_MS = 800
// Mismo tope que valida el backend (MAX_POR_TIPO en utils/contactos.js)
const MAX_POR_TIPO = 10
const filaVacia = () => ({ valor: '', visible: true })

export default {
  name: 'ContactosForm',
  components: { ContactosPerfil },
  props: {
    // Contactos ya cargados por la vista (evita una segunda llamada al API)
    contactos: { type: Array, default: null },
  },
  emits: ['guardado'],
  data() {
    return {
      tipos: TIPOS_CONTACTO,
      maxPorTipo: MAX_POR_TIPO,
      // { [tipo]: [{ valor, visible }] } — cada tipo admite varios datos
      valores: Object.fromEntries(TIPOS_CONTACTO.map((t) => [t.tipo, [filaVacia()]])),
      // Última versión guardada, con la URL que armó el backend: es lo que se
      // previsualiza (y lo que realmente ve el cliente)
      guardados: [],
      guardando: false,
      mensaje: '',
      // Se activa recién cuando terminó de aplicar los contactos cargados, para no
      // autoguardar por la asignación inicial de los campos.
      listoParaAutoguardar: false,
      temporizadorGuardado: null,
    }
  },
  computed: {
    // Previsualización: lo mismo que verá el cliente en el perfil público
    contactosVisibles() {
      return this.guardados.filter((c) => c.visible !== false)
    },
  },
  async created() {
    if (!Array.isArray(this.contactos)) await this.cargar()
  },
  beforeUnmount() {
    clearTimeout(this.temporizadorGuardado)
  },
  watch: {
    contactos: {
      immediate: true,
      handler(nuevos) {
        if (Array.isArray(nuevos)) {
          this.aplicar(nuevos)
          this.$nextTick(() => {
            this.listoParaAutoguardar = true
          })
        }
      },
    },
    valores: {
      deep: true,
      handler() {
        this.programarGuardado()
      },
    },
  },
  methods: {
    estiloMarca(tipo) {
      return tipo.degradado ? { background: tipo.degradado } : { backgroundColor: tipo.color }
    },
    agregar(tipo) {
      if (this.valores[tipo].length < MAX_POR_TIPO) this.valores[tipo].push(filaVacia())
    },
    quitar(tipo, indice) {
      this.valores[tipo].splice(indice, 1)
      if (this.valores[tipo].length === 0) this.valores[tipo].push(filaVacia())
    },
    aplicar(contactos) {
      this.guardados = contactos
      for (const t of this.tipos) {
        const filas = contactos
          .filter((c) => c.tipo === t.tipo)
          .map((c) => ({ valor: c.valor || '', visible: c.visible === true }))
        // Si había un campo vacío recién agregado (todavía sin completar) se conserva,
        // para que el autoguardado de otro campo no lo haga desaparecer.
        const previas = this.valores[t.tipo] || []
        const habiaVacio = previas.length > 1 && previas.some((f) => !f.valor.trim())
        if (filas.length === 0 || (habiaVacio && filas.length < MAX_POR_TIPO)) filas.push(filaVacia())
        this.valores[t.tipo] = filas
      }
    },
    async cargar() {
      try {
        const body = await obtener_mis_contactos()
        this.aplicar(body.contactos || [])
      } catch {
        AppStore().mostrar_alerta('No se pudieron cargar los datos de contacto')
      } finally {
        this.$nextTick(() => {
          this.listoParaAutoguardar = true
        })
      }
    },
    // Autoguardado con debounce: espera a que el usuario deje de tipear antes de guardar.
    programarGuardado() {
      if (!this.listoParaAutoguardar) return
      clearTimeout(this.temporizadorGuardado)
      this.temporizadorGuardado = setTimeout(this.guardar, DEBOUNCE_GUARDADO_MS)
    },
    async guardar() {
      this.mensaje = ''
      this.guardando = true
      try {
        const payload = {
          // Formulario completo: cada tipo va con todos sus datos (un tipo que viaja
          // sólo con valores vacíos se borra)
          contactos: this.tipos.flatMap((t) =>
            this.valores[t.tipo].map((f) => ({ tipo: t.tipo, valor: f.valor.trim(), visible: f.visible }))
          ),
        }
        const body = await guardar_mis_contactos(payload.contactos)
        // El backend devuelve los valores normalizados y la URL de cada enlace
        this.listoParaAutoguardar = false
        this.aplicar(body.contactos || [])
        this.$nextTick(() => {
          this.listoParaAutoguardar = true
        })
        this.mensaje = body.message || 'Datos de contacto guardados'
        this.$emit('guardado', body.contactos || [])
      } catch (err) {
        AppStore().mostrar_alerta(err.response?.data?.error || 'No se pudieron guardar los datos de contacto')
      } finally {
        this.guardando = false
      }
    },
  },
}
</script>

<style scoped>
.contacto-card {
  border-radius: 0.75rem;
  border: 1px solid var(--bs-border-color);
  background-color: var(--bs-body-bg);
  color: var(--bs-body-color);
}
.contacto-marca {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.5rem;
  color: #fff;
  font-size: 0.95rem;
}
</style>
