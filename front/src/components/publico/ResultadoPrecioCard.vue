<template>
  <article class="pub-price-card">
    <div class="pub-price-card__top">
      <div>
        <p class="pub-price-card__price gb-num" v-if="resultado?.price != -1">
          {{ resultado?.tipo == "ALQUILER" ? resultado.moneda : "$" }} {{ formatMoney(resultado?.price) }}
        </p>
        <p class="pub-price-card__price" v-if="resultado?.caracteristicas?.promo_cnt && resultado?.price == -1">
          {{ resultado?.caracteristicas?.promo_cnt }}
        </p>
      </div>
      <div class="d-flex flex-column align-items-end gap-1">
        <Badge v-if="resultado?.tipo == 'PROMO'" tone="warning" size="sm" icon="bi-lightning-charge-fill" label="Promo" />
        <Badge v-else-if="resultado?.tipo == 'ALQUILER'" tone="info" size="sm" icon="bi-house" label="Alquiler" />
        <VariacionPrecio :value="variacion" />
      </div>
    </div>

    <h3 class="pub-price-card__name fs-6" v-html="nombreResaltado"></h3>

    <p class="pub-price-card__note mb-0"
       v-if="(resultado?.notas != '' && resultado?.notas != null) || resultado?.caracteristicas?.desde || resultado?.caracteristicas?.hasta">
      {{ resultado?.notas }}
      <span v-if="resultado?.caracteristicas?.desde">Desde: {{ resultado?.caracteristicas?.desde }}</span>
      <span v-if="resultado?.caracteristicas?.hasta"> - Hasta: {{ resultado?.caracteristicas?.hasta }}</span>
    </p>

    <div class="pub-price-card__meta">
      <span v-if="resultado?.tipo != 'ALQUILER'">
        <Icon name="bi-shop" />
        <span><b>{{ resultado?.empresa?.name }}</b>
          <template v-for="comercio in resultado?.locales" :key="comercio?.address_road + comercio?.address_number">
            · {{ comercio?.address_road }} {{ comercio?.address_number }}
          </template>
        </span>
      </span>
      <span v-else>
        <Icon name="bi-person" />
        <span><b>{{ resultado?.empresa?.name }}</b>
          <template v-for="_data in especificaciones" :key="_data.name"> · {{ _data?.name }} {{ _data?.value }}</template>
        </span>
      </span>
      <span v-if="resultado?.tipo != 'PROMO'"><Icon name="bi-clock" /> {{ fecha }}</span>
      <span v-if="resultado?.user_nombre || resultado?.user_apellido">
        <Icon name="bi-person-check" />
        Cargado por {{ [resultado?.user_nombre, resultado?.user_apellido].filter(Boolean).join(' ') }}
      </span>
    </div>

    <div class="pub-price-card__actions" v-if="resultado?.url || esCorregible">
      <Button v-if="esCorregible" size="sm" variant="primary" icon="bi-graph-up" label="Evolución"
              @click="$emit('estadisticas', resultado)" />
      <Button v-if="esCorregible" size="sm" variant="ghost" icon="bi-pencil" label="Corregir"
              @click="$emit('corregir', resultado)" />
      <a v-if="resultado?.url" :href="resultado?.url" target="_blank" rel="noopener" class="btn btn-sm btn-link ms-auto">
        Ver web <Icon name="bi-box-arrow-up-right" />
      </a>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { formatMoney } from '../../helpers/formatter'
import VariacionPrecio from './VariacionPrecio.vue'

const props = defineProps({
  resultado: { type: Object, required: true },
  termino: { type: String, default: '' },
  fecha: { type: String, default: '' },
  especificaciones: { type: Array, default: () => [] }
})
defineEmits(['estadisticas', 'corregir'])

const esCorregible = computed(() => props.resultado?.tipo != 'ALQUILER' && props.resultado?.tipo != 'PROMO')
// Solo se muestra si la API lo envía (no todos los endpoints lo incluyen)
const variacion = computed(() => props.resultado?.porcentaje_aumento ?? props.resultado?.variacion ?? null)

function escapeRegex(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
const nombreResaltado = computed(() => {
  const texto = props.resultado?.name
  if (!props.termino || typeof texto !== 'string') return texto
  return texto.replace(new RegExp(`(${escapeRegex(props.termino)})`, 'ig'), '<mark>$1</mark>')
})
</script>
