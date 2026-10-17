<template>
  <div class="product-selector">
    <div class="row align-items-start">
      <div class="col">
        <label class="form-label">{{ label }}</label>
        <div class="position-relative w-100">
          <AutoComplete
            ref="autocompleteRef"
            :modelValue="modelValue"
            :displayValue="displayValue"
            :search="handleSearch"
            :optionLabel="optionLabel"
            :optionValue="optionValue"
            :placeholder="placeholder"
            :disabled="disabled"
            @update:modelValue="handleSelect" />
          <div class="col-auto pt-2" v-if="displayValue || lastSelected">
            <span class="badge bg-info" style="display: inline-block; margin-top: 0.5rem;">
              {{ (lastSelected && lastSelected[optionLabel]) || displayValue }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { ref, watch } from 'vue'
  import AutoComplete from '@/components/ui/AutoComplete.vue'

  const props = defineProps({
    modelValue: { default: null },
    displayValue: { type: String, default: '' },
    search: { type: Function, required: true },
    optionLabel: { type: String, default: 'name' },
    optionValue: { type: String, default: 'id' },
    label: { type: String, default: 'Seleccionar producto' },
    placeholder: { type: String, default: 'Buscar producto por nombre...' },
    disabled: { type: Boolean, default: false },
    selectedItem: { type: Object, default: null },
  })

  const emit = defineEmits(['update:modelValue', 'item-selected'])
  const lastSelected = ref(props.selectedItem)
  const lastSearchResults = ref([])

  watch(() => props.selectedItem, (newVal) => {
    lastSelected.value = newVal
  })

  watch(() => props.displayValue, (newVal) => {
    if (newVal && !lastSelected.value) {
      lastSelected.value = null
    }
  })

  async function handleSearch(q) {
    const results = await props.search(q)
    lastSearchResults.value = Array.isArray(results) ? results : []
    return lastSearchResults.value
  }

  function handleSelect(value) {
    if (value) {
      const selected = lastSearchResults.value.find(item => item[props.optionValue] === value)
      if (selected) {
        lastSelected.value = selected
        emit('item-selected', selected)
      }
    }
    emit('update:modelValue', value)
  }
</script>

<style scoped>
  .product-selector {
    margin-bottom: 1rem;
  }

  .badge {
    font-size: 0.85rem;
    padding: 0.35rem 0.65rem;
    margin-top: 0.5rem;
    display: inline-block;
    border-radius: 0.375rem;
  }

  .form-label {
    margin-bottom: 0.5rem;
    font-weight: 500;
    display: block;
  }

  .position-relative {
    position: relative;
  }
</style>
