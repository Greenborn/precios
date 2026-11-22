<template>
  <FormField :label="label" :help="help" :error="error" :required="required" :input-id="fid">
  <div class="position-relative select-local w-100" v-bind="$attrs">
    <select
      :id="fid"
      class="form-select"
      :class="{ 'is-invalid': !!error, 'form-select-sm': size === 'sm' }"
      :aria-invalid="error ? 'true' : null"
      :aria-describedby="describedBy"
      :value="modelValue"
      :disabled="disabled"
      @change="onChange"
    >
      <option v-if="placeholder" value="" disabled :selected="modelValue == null || modelValue === ''">
        {{ placeholder }}
      </option>
      <option
        v-for="opt in options"
        :key="optionKey(opt)"
        :value="optionValue(opt)"
      >
        {{ optionLabel(opt) }}
      </option>
    </select>
  </div>
  </FormField>
</template>

<script setup>
import FormField from './FormField.vue'
import { fieldProps, useFieldId } from './useField'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { default: null },
  options: { type: Array, default: () => [] },
  optionLabel: { type: String, default: 'label' },
  optionValue: { type: String, default: 'value' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  id: { type: String, default: '' },
  size: { type: String, default: '' },
  ...fieldProps
})

const emit = defineEmits(['update:modelValue'])
const { fid, describedBy } = useFieldId(props)

function optionLabel(opt) {
  return opt && typeof opt === 'object' ? opt[props.optionLabel] : opt
}
function optionValue(opt) {
  return opt && typeof opt === 'object' ? opt[props.optionValue] : opt
}
function optionKey(opt) {
  return optionValue(opt)
}
function onChange(e) {
  const raw = e.target.value
  const match = props.options.find(opt => String(optionValue(opt)) === String(raw))
  emit('update:modelValue', match !== undefined ? optionValue(match) : raw)
}
</script>