<template>
  <FormField :label="label" :help="help" :error="error" :required="required" :input-id="fid">
  <div class="position-relative w-100 gb-ac" ref="cont" v-bind="$attrs">
    <input
      :id="fid"
      type="text"
      class="form-control"
      :class="{ 'is-invalid': !!error, 'pe-5': buscando }"
      role="combobox"
      :aria-expanded="abierto ? 'true' : 'false'"
      :aria-invalid="error ? 'true' : null"
      :aria-describedby="describedBy"
      :disabled="disabled"
      v-model="texto"
      :placeholder="placeholder"
      autocomplete="off"
      @input="on_input"
      @focus="on_focus"
      @blur="on_blur"
      @keydown.esc="abierto = false"
      @keydown.down="mover_sel(1)"
      @keydown.up="mover_sel(-1)"
      @keydown.enter="enter_sel"
    />
    <span v-if="buscando" class="spinner-border spinner-border-sm gb-ac__spin" aria-hidden="true"></span>
    <ul v-if="abierto && sugerencias.length" class="list-group autocomplete-dropdown">
      <li
        v-for="(opt, i) in sugerencias"
        :key="optionKey(opt)"
        class="list-group-item list-group-item-action"
        :class="{ active: i === idx_sel }"
        @mousedown.prevent="seleccionar(opt)"
        @mousemove="idx_sel = i"
      >
        {{ optionLabel(opt) }}
      </li>
    </ul>
  </div>
  </FormField>
</template>

<script setup>
  import { ref, watch } from 'vue'
  import FormField from './FormField.vue'
  import { fieldProps, useFieldId } from './useField'

  defineOptions({ inheritAttrs: false })

  const props = defineProps({
    modelValue: { default: null },
    displayValue: { type: String, default: '' },
    search: { type: Function, default: null },
    optionLabel: { type: String, default: 'label' },
    optionValue: { type: String, default: 'value' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    minChars: { type: Number, default: 2 },
    debounce: { type: Number, default: 300 },
    id: { type: String, default: '' },
    ...fieldProps,
  })

  const emit = defineEmits(['update:modelValue'])

  const { fid, describedBy } = useFieldId(props)
  const texto = ref('')
  const abierto = ref(false)
  const sugerencias = ref([])
  const idx_sel = ref(-1)
  const buscando = ref(false)
  const texto_seleccionado = ref(false)
  let timer = null

  watch(
    () => [props.modelValue, props.displayValue],
    () => {
      texto_seleccionado.value = true
      texto.value = props.displayValue || ''
    },
    { immediate: true }
  )

  function optionLabel(opt) {
    return opt && typeof opt === 'object' ? opt[props.optionLabel] : opt
  }

  function optionValue(opt) {
    return opt && typeof opt === 'object' ? opt[props.optionValue] : opt
  }

  function optionKey(opt) {
    return optionValue(opt)
  }

  function cerrar() {
    abierto.value = false
    idx_sel.value = -1
  }

  function on_focus() {
    if (sugerencias.value.length) abierto.value = true
  }

  function on_input() {
    texto_seleccionado.value = false
    emit('update:modelValue', null)
    if (timer) clearTimeout(timer)
    if (!props.search || texto.value.trim().length < props.minChars) {
      sugerencias.value = []
      cerrar()
      return
    }
    timer = setTimeout(async () => {
      try {
        buscando.value = true
        const rows = await props.search(texto.value.trim())
        sugerencias.value = Array.isArray(rows) ? rows : []
        idx_sel.value = sugerencias.value.length ? 0 : -1
        abierto.value = sugerencias.value.length > 0
      } catch (e) {
        console.error('[AutoComplete] error en busqueda:', e)
        sugerencias.value = []
        cerrar()
      } finally {
        buscando.value = false
      }
    }, props.debounce)
  }

  function seleccionar(opt) {
    emit('update:modelValue', optionValue(opt))
    texto_seleccionado.value = true
    texto.value = optionLabel(opt)
    cerrar()
  }

  function mover_sel(delta) {
    if (!abierto.value || sugerencias.value.length === 0) return
    const max = sugerencias.value.length - 1
    idx_sel.value = Math.min(Math.max(idx_sel.value + delta, 0), max)
  }

  function enter_sel(e) {
    if (abierto.value && idx_sel.value >= 0 && sugerencias.value[idx_sel.value]) {
      e.preventDefault()
      seleccionar(sugerencias.value[idx_sel.value])
    }
  }

  function on_blur() {
    // si no hay seleccion valida se restaura el texto de la seleccion previa (o se limpia)
    if (!texto_seleccionado.value) {
      texto.value = props.displayValue || ''
      emit('update:modelValue', props.modelValue)
    }
    cerrar()
  }
</script>

<style scoped>
  .autocomplete-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 1050;
    max-height: 260px;
    overflow-y: auto;
    padding: 0.25rem;
    background: var(--gb-surface);
    border: 1px solid var(--gb-border);
    box-shadow: var(--gb-shadow);
    border-radius: var(--gb-radius-sm);
  }
  .autocomplete-dropdown .list-group-item {
    border: 0;
    border-radius: 6px;
    padding: 0.45rem 0.65rem;
    cursor: pointer;
  }
  .autocomplete-dropdown .list-group-item.active {
    background: var(--gb-primary-soft);
    color: var(--gb-heading);
  }
  .gb-ac__spin {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    margin-top: -0.5rem;
    color: var(--gb-text-muted);
  }
</style>
