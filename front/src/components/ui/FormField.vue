<template>
  <div v-if="wrapped" class="gb-field" :class="{ 'gb-field--invalid': !!error }">
    <label v-if="label" class="gb-field__label" :for="inputId">
      {{ label }}<span v-if="required" class="gb-field__required" aria-hidden="true">*</span>
    </label>
    <slot></slot>
    <div v-if="error" :id="inputId + '-error'" class="gb-field__error">{{ error }}</div>
    <div v-else-if="help" :id="inputId + '-help'" class="gb-field__help">{{ help }}</div>
  </div>
  <slot v-else></slot>
</template>

<script setup>
// Wrapper interno de campos: solo envuelve si hay label/help/error,
// así los usos existentes (sin esas props) quedan idénticos.
import { computed } from 'vue'
const props = defineProps({
  label: { type: String, default: '' },
  help: { type: String, default: '' },
  error: { type: [String, Boolean], default: '' },
  required: { type: Boolean, default: false },
  inputId: { type: String, default: '' }
})
const wrapped = computed(() => !!(props.label || props.help || props.error))
</script>
