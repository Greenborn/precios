<template>
  <section class="abm-shell" :class="{ 'abm-shell--fill': fill }">
    <PageHeader
      class="abm-shell__header"
      :title="title || storeApp.ruta_actual?.title || ''"
      :subtitle="subtitle"
      :icon="headerIcon"
      :breadcrumbs="breadcrumbs">
      <template v-if="$slots.actions" #actions><slot name="actions"></slot></template>
    </PageHeader>

    <Card v-if="$slots.filters" class="abm-shell__filters" variant="flat">
      <slot name="filters"></slot>
    </Card>

    <Card class="abm-shell__body" :flush="flush">
      <slot></slot>
    </Card>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { AppStore } from '@/stores/app'
import { piToBi } from '@/utils/icons'
import { useAdminBreadcrumbs } from './useAdminBreadcrumbs'

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  // fill: el cuerpo ocupa el alto disponible (tablas con scroll interno)
  fill: { type: Boolean, default: true },
  flush: { type: Boolean, default: true },
})

const storeApp = AppStore()
const breadcrumbs = useAdminBreadcrumbs()
const headerIcon = computed(() => props.icon || (storeApp.ruta_actual?.icon ? piToBi(storeApp.ruta_actual.icon) : ''))
</script>

<style scoped>
.abm-shell {
  display: flex;
  flex-direction: column;
  gap: var(--gb-space-4);
  min-height: 100%;
}
.abm-shell--fill { height: 100%; }
.abm-shell__header { margin-bottom: 0; }
.abm-shell__body { flex: 1; min-height: 0; overflow: hidden; }
.abm-shell--fill .abm-shell__body :deep(.gb-card__body) { height: 100%; display: flex; flex-direction: column; min-height: 0; }
.abm-shell__body :deep(.te-wrapper) { flex: 1; min-height: 0; border: 0; box-shadow: none; border-radius: 0; }
@media (max-width: 767.98px) {
  .abm-shell--fill { height: auto; }
  .abm-shell__body { min-height: 60vh; }
}
</style>
