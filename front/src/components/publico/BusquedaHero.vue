<template>
  <section class="pub-hero" aria-labelledby="hero-title">
    <span class="pub-hero__eyebrow"><Icon name="bi-people-fill" /> Precios comunitarios de Tandil</span>
    <h1 id="hero-title" class="pub-hero__title">Encontrá el mejor precio<br class="d-none d-sm-inline"> antes de salir a comprar</h1>
    <p class="pub-hero__lead">Compará precios de comercios locales, cargados por la comunidad y actualizados todos los días.</p>

    <form class="pub-search" role="search" @submit.prevent="enviar">
      <Icon name="bi-search" class="pub-search__icon" />
      <label for="busqueda-principal" class="visually-hidden">Nombre del producto</label>
      <input id="busqueda-principal" class="pub-search__input" type="search" autocomplete="off"
             role="combobox" aria-autocomplete="list" aria-controls="busqueda-sugerencias"
             :aria-expanded="abierto ? 'true' : 'false'"
             :value="modelValue" @input="on_input"
             @keydown.down.prevent="mover(1)" @keydown.up.prevent="mover(-1)"
             @keydown.esc="cerrar" @blur="cerrar"
             placeholder="¿Qué estás buscando? Ej: yerba, arroz, leche">
      <ul v-if="abierto && items.length" id="busqueda-sugerencias" class="pub-search__sugs" role="listbox">
        <li v-for="(s, i) in items" :key="s" role="option" :aria-selected="i === idx ? 'true' : 'false'"
            :class="{ active: i === idx }" @mousedown.prevent="elegir(s)" @mousemove="idx = i">{{ s }}</li>
      </ul>
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
import { ref, onBeforeUnmount } from 'vue'
import { sugerencias_busqueda } from '../../api/public/publicEndpoints'
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

const items = ref([])
const abierto = ref(false)
const idx = ref(-1)
let timer = null
let req_id = 0

function cerrar(){ abierto.value = false; idx.value = -1 }

function on_input(e){
  const v = e.target.value
  emit('update:modelValue', v)
  clearTimeout(timer)
  if (v.trim().length < 3) { req_id++; items.value = []; cerrar(); return }
  timer = setTimeout(async () => {
    const id = ++req_id
    const res = await sugerencias_busqueda(v.trim()).catch(() => null)
    if (id !== req_id) return   // respuesta vieja
    items.value = res?.items || []
    idx.value = -1
    abierto.value = items.value.length > 0
  }, 250)
}

function mover(d){
  if (!abierto.value || !items.value.length) return
  const n = items.value.length
  idx.value = (idx.value + 1 + d + n + 1) % (n + 1) - 1   // -1 = sin selección
}

function enviar(){
  if (abierto.value && idx.value >= 0) return elegir(items.value[idx.value])
  req_id++; clearTimeout(timer); cerrar()
  emit('buscar')
}

onBeforeUnmount(() => clearTimeout(timer))

function elegir(s){
  req_id++; clearTimeout(timer); cerrar()
  emit('update:modelValue', s)
  emit('buscar')
}
</script>
