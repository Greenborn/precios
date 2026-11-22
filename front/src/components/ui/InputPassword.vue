<template>
  <FormField :label="label" :help="help" :error="error" :required="required" :input-id="fid">
    <div class="position-relative" v-bind="$attrs">
      <input
        :id="fid"
        :type="show ? 'text' : 'password'"
        class="form-control w-100"
        :class="{ 'pe-5': toggleMask, 'is-invalid': !!error }"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autocomplete || null"
        :aria-invalid="error ? 'true' : null"
        :aria-describedby="describedBy"
        @input="onInput"
      />
      <button
        v-if="toggleMask"
        type="button"
        class="btn-eye-toggle"
        :aria-label="show ? 'Ocultar contraseña' : 'Mostrar contraseña'"
        @click="show = !show"
      >
        <Icon :name="show ? 'pi-eye-slash' : 'pi-eye'" />
      </button>
    </div>
  </FormField>
</template>

<script setup>
import { ref } from 'vue'
import Icon from './Icon.vue'
import FormField from './FormField.vue'
import { fieldProps, useFieldId } from './useField'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { default: '' },
  id: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  toggleMask: { type: Boolean, default: false },
  autocomplete: { type: String, default: '' },
  ...fieldProps
})

const emit = defineEmits(['update:modelValue'])
const show = ref(false)
const { fid, describedBy } = useFieldId(props)

function onInput(e) {
  emit('update:modelValue', e.target.value)
}
</script>

<style scoped>
.btn-eye-toggle {
  position: absolute;
  top: 50%;
  right: 0.5rem;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  border-radius: var(--gb-radius-sm);
  color: var(--gb-text-muted);
  padding: 0.25rem;
  display: flex;
  align-items: center;
  transition: color var(--gb-transition-fast);
}
.btn-eye-toggle:hover { color: var(--gb-primary); }
.btn-eye-toggle:focus-visible { outline: none; box-shadow: var(--gb-focus-ring); }
</style>
