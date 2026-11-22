<template>
  <FormField :label="label" :help="help" :error="error" :required="required" :input-id="fid">
  <div class="position-relative multiselect-local" :style="style" v-bind="$attrs" ref="root" @keydown.esc="open = false">
    <button
      :id="fid"
      type="button"
      class="form-control ms-trigger text-start d-flex justify-content-between align-items-center gap-2"
      :class="{ 'is-invalid': !!error, 'ms-open': open }"
      :disabled="disabled"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-describedby="describedBy"
      @click="open = !open"
    >
      <span class="gb-truncate" :class="{ 'ms-placeholder': selectedDisplay.length === 0 }">{{ selectedDisplay.length ? selectedDisplay.join(', ') : placeholder }}</span>
      <Icon :name="open ? 'pi-chevron-up' : 'pi-chevron-down'" />
    </button>

    <div v-if="open" class="ms-dropdown" role="listbox" aria-multiselectable="true">
      <label class="form-check ms-option" v-for="opt in options" :key="optionKey(opt)">
        <input class="form-check-input" type="checkbox" :checked="isSelected(opt)" @change="onToggle(opt)" />
        <span class="form-check-label">{{ optionLabel(opt) }}</span>
      </label>
      <div v-if="!options.length" class="ms-empty">Sin opciones</div>
    </div>
  </div>
  </FormField>
</template>

<script setup>
import FormField from './FormField.vue'
import { fieldProps, useFieldId } from './useField'

defineOptions({ inheritAttrs: false })

import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  options: { type: Array, default: () => [] },
  optionLabel: { type: String, default: 'label' },
  optionValue: { type: String, default: 'value' },
  placeholder: { type: String, default: '' },
  style: { type: [String, Object], default: '' },
  id: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  ...fieldProps
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const root = ref(null)
const { fid, describedBy } = useFieldId(props)

// Cerrar al hacer click fuera
function onDocClick(e) {
  if (open.value && root.value && !root.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))

function optionLabel(opt) {
  return opt && typeof opt === 'object' ? opt[props.optionLabel] : opt
}
function optionValue(opt) {
  return opt && typeof opt === 'object' ? opt[props.optionValue] : opt
}
function optionKey(opt) {
  return optionValue(opt)
}
function isSelected(opt) {
  return props.modelValue.some(v => v == optionValue(opt))
}
function onToggle(opt) {
  const val = optionValue(opt)
  const next = isSelected(opt) ? props.modelValue.filter(v => v != val) : [...props.modelValue, val]
  emit('update:modelValue', next)
}
const selectedDisplay = computed(() =>
  props.options.filter(opt => props.modelValue.some(v => String(v) === String(optionValue(opt)))).map(opt => optionLabel(opt))
)
</script>

<style scoped>
.ms-trigger { cursor: pointer; }
.ms-trigger.ms-open { border-color: var(--bs-focus-ring-color, var(--gb-primary)); box-shadow: var(--gb-focus-ring); }
.ms-placeholder { color: var(--gb-text-muted); }
.ms-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 1050;
  background: var(--gb-surface);
  border: 1px solid var(--gb-border);
  border-radius: var(--gb-radius-sm);
  box-shadow: var(--gb-shadow);
  max-height: 260px;
  overflow-y: auto;
  padding: 0.25rem;
  animation: gb-ms-in var(--gb-transition-fast);
}
.ms-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem 0.4rem 2rem;
  margin: 0;
  border-radius: 6px;
  cursor: pointer;
}
.ms-option:hover { background: var(--gb-primary-soft); }
.ms-empty { padding: 0.5rem 0.75rem; color: var(--gb-text-muted); font-size: 0.85rem; }
@keyframes gb-ms-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
</style>