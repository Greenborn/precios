<template>
  <FormField :label="label" :help="help" :error="error" :required="required" :input-id="fid">
    <input
      v-bind="$attrs"
      :id="fid"
      type="date"
      class="form-control"
      :class="{ 'is-invalid': !!error }"
      :value="valueISO"
      :disabled="disabled"
      :aria-invalid="error ? 'true' : null"
      :aria-describedby="describedBy"
      @change="onChange"
    />
  </FormField>
</template>

<script setup>
import { computed } from 'vue'
import FormField from './FormField.vue'
import { fieldProps, useFieldId } from './useField'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { default: null },
  dateFormat: { type: String, default: 'dd.mm.yy' },
  id: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  ...fieldProps
})

const emit = defineEmits(['update:modelValue'])
const { fid, describedBy } = useFieldId(props)

const valueISO = computed(() => {
  if (!props.modelValue) return ''
  const d = new Date(props.modelValue)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
})

function onChange(e) {
  const v = e.target.value // yyyy-mm-dd
  if (!v) {
    emit('update:modelValue', null)
    return
  }
  emit('update:modelValue', new Date(v + 'T00:00:00'))
}
</script>
