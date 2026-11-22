<template>
  <section class="pub-hero" aria-labelledby="hero-title">
    <span class="pub-hero__eyebrow"><Icon name="bi-people-fill" /> Precios comunitarios de Tandil</span>
    <h1 id="hero-title" class="pub-hero__title">Encontrá el mejor precio<br class="d-none d-sm-inline"> antes de salir a comprar</h1>
    <p class="pub-hero__lead">Compará precios de comercios locales, cargados por la comunidad y actualizados todos los días.</p>

    <form class="pub-search" role="search" @submit.prevent="$emit('buscar')">
      <Icon name="bi-search" class="pub-search__icon" />
      <label for="busqueda-principal" class="visually-hidden">Nombre del producto</label>
      <input id="busqueda-principal" class="pub-search__input" type="search" autocomplete="off"
             :value="modelValue" @input="$emit('update:modelValue', $event.target.value)"
             placeholder="¿Qué estás buscando? Ej: yerba, arroz, leche">
      <button type="submit" class="btn btn-primary" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
        <span class="d-none d-sm-inline" :class="{ 'ms-1': loading }">Buscar</span>
        <Icon v-if="!loading" name="bi-arrow-right" class="d-sm-none" label="Buscar" />
      </button>
    </form>

    <div class="pub-hero__hints">
      <span>Probá con:</span>
      <button v-for="s in sugerencias" :key="s" type="button" @click="elegir(s)">{{ s }}</button>
    </div>

    <div class="pub-hero__stats" v-if="estadisticas?.length">
      <div class="pub-hero__stat" v-for="e in estadisticas.slice(0, 4)" :key="e.description">
        <span class="pub-hero__stat-value gb-num">{{ formatear(e.value) }}</span>
        <span class="pub-hero__stat-label">{{ e.description }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  estadisticas: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue', 'buscar'])
const sugerencias = ['Yerba', 'Leche', 'Arroz', 'Aceite', 'Harina']
function formatear(v){
  const n = Number(v)
  if (v === null || v === '' || !Number.isFinite(n)) return v
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}
function elegir(s){
  emit('update:modelValue', s)
  emit('buscar')
}
</script>
