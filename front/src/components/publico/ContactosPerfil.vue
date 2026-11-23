<template>
  <div v-if="items.length" class="d-flex flex-wrap gap-2 align-items-center">
    <a
      v-for="item in items"
      :key="`${item.tipo}-${item.valor}`"
      :href="item.href"
      target="_blank"
      rel="noopener noreferrer"
      class="contacto-icono"
      :class="{ 'con-etiqueta': conEtiqueta }"
      :style="item.estilo"
      :title="`${item.label}: ${item.valor}`"
      :aria-label="`${item.nombre} (se abre en una pestaña nueva)`"
    >
      <i :class="['bi', item.icono]" aria-hidden="true"></i>
      <span v-if="conEtiqueta" class="contacto-etiqueta">{{ item.repetido ? item.valor : item.label }}</span>
    </a>
  </div>
  <p v-else class="text-muted mb-0 small">Sin datos de contacto publicados.</p>
</template>

<script>
import { definicionContacto, urlSegura } from '../../data/contactos'

export default {
  name: 'ContactosPerfil',
  props: {
    // [{ tipo, label, valor, url, visible }] tal como los devuelve el backend
    contactos: { type: Array, default: () => [] },
    conEtiqueta: { type: Boolean, default: false },
  },
  computed: {
    items() {
      const visibles = this.contactos.filter((c) => c.visible !== false)
      // Varios datos del mismo tipo (por ejemplo dos teléfonos o dos emails de una ficha
      // precargada): se distinguen mostrando el valor en vez de repetir la etiqueta.
      const porTipo = {}
      for (const c of visibles) porTipo[c.tipo] = (porTipo[c.tipo] || 0) + 1
      return visibles
        .map((c) => {
          const def = definicionContacto(c.tipo)
          const href = urlSegura(c.url)
          if (!def || !href) return null
          const label = c.label || def.label
          const repetido = porTipo[c.tipo] > 1
          return {
            tipo: c.tipo,
            label,
            repetido,
            // Nombre accesible: con datos repetidos incluye el valor para diferenciarlos
            nombre: repetido ? `${label}: ${c.valor}` : label,
            valor: c.valor,
            icono: def.icono,
            href,
            estilo: def.degradado ? { background: def.degradado } : { backgroundColor: def.color },
          }
        })
        .filter(Boolean)
    },
  },
}
</script>

<style scoped>
.contacto-icono {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 1.25rem;
  color: #fff;
  font-size: 1.1rem;
  line-height: 1;
  text-decoration: none;
  justify-content: center;
  transition: transform 0.15s ease, filter 0.15s ease;
}
.contacto-icono.con-etiqueta {
  width: auto;
  max-width: 100%;
  height: auto;
  min-height: 2.5rem;
  padding: 0 0.9rem;
}
.contacto-icono:hover,
.contacto-icono:focus-visible {
  color: #fff;
  transform: translateY(-2px);
  filter: brightness(1.08);
}
.contacto-etiqueta {
  font-size: 0.875rem;
  font-weight: 500;
  overflow-wrap: anywhere;
}
</style>
