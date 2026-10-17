<template>
  <div class="product-selector">
    <div class="row align-items-start">
      <div class="col">
        <label class="form-label">{{ label }}</label>
        <AutoComplete
          :modelValue="modelValue"
          :displayValue="displayValue"
          :search="search"
          :optionLabel="optionLabel"
          :optionValue="optionValue"
          :placeholder="placeholder"
          :disabled="disabled"
          @update:modelValue="handleSelect" />
      </div>
      <div class="col-auto pt-4" v-if="displayValue || selectedProduct">
        <span class="badge bg-info">
          {{ (selectedProduct && selectedProduct[optionLabel]) || displayValue }}
        </span>
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

  const emit = defineEmits(['update:modelValue'])
  const selectedProduct = ref(props.selectedItem)

  watch(() => props.selectedItem, (newVal) => {
    selectedProduct.value = newVal
  })

  function handleSelect(value) {
    emit('update:modelValue', value)
  }
</script>

<style scoped>
  .product-selector {
    margin-bottom: 1rem;
  }

  .badge {
    font-size: 0.875rem;
    padding: 0.5rem 0.75rem;
  }

  .form-label {
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .row {
    gap: 0.5rem;
  }
</style>
