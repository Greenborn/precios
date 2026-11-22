<template>
  <FormField :label="label" :help="help" :error="error" :required="required" :input-id="fid">
    <input
      v-bind="$attrs"
      :id="fid"
      :type="type"
      class="form-control"
      :class="{ 'is-invalid': !!error, 'form-control-sm': size === 'sm', 'form-control-lg': size === 'lg' }"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required || null"
      :aria-invalid="error ? 'true' : null"
      :aria-describedby="describedBy"
      @input="onInput"
    />
  </FormField>
</template>

<script setup>
import FormField from './FormField.vue'
import { fieldProps, useFieldId } from './useField'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { default: '' },
  type: { type: String, default: 'text' },
  id: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: '' },
  ...fieldProps
})

const emit = defineEmits(['update:modelValue'])
const { fid, describedBy } = useFieldId(props)

function onInput(e) {
  emit('update:modelValue', e.target.value)
}
</script>
