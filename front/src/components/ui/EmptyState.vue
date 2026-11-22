<template>
  <div class="gb-empty" :class="'gb-empty--' + size">
    <div class="gb-empty__icon" aria-hidden="true"><Icon :name="icon" /></div>
    <div v-if="title" class="gb-empty__title">{{ title }}</div>
    <p v-if="description" class="gb-empty__desc">{{ description }}</p>
    <div v-if="$slots.default || $slots.actions" class="gb-empty__actions">
      <slot name="actions"></slot><slot></slot>
    </div>
  </div>
</template>

<script setup>
import Icon from './Icon.vue'
defineProps({
  icon: { type: String, default: 'bi-inbox' },
  title: { type: String, default: 'Sin datos' },
  description: { type: String, default: '' },
  size: { type: String, default: 'md' } // sm | md | lg
})
</script>

<style scoped>
.gb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2.5rem 1rem;
  color: var(--gb-text-muted);
}
.gb-empty--sm { padding: 1.25rem 1rem; }
.gb-empty--lg { padding: 4rem 1rem; }
.gb-empty__icon {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  color: var(--gb-primary);
  background: var(--gb-primary-soft);
  margin-bottom: 0.75rem;
}
.gb-empty--sm .gb-empty__icon { width: 2.5rem; height: 2.5rem; font-size: 1.1rem; margin-bottom: 0.5rem; }
.gb-empty__title { font-weight: 600; color: var(--gb-heading); }
.gb-empty--sm .gb-empty__title { font-weight: 500; font-size: 0.9rem; color: var(--gb-text-muted); }
.gb-empty__desc { margin: 0.25rem 0 0; max-width: 42ch; font-size: 0.875rem; }
.gb-empty__actions { margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; }
</style>
