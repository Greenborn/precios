<template>
  <component :is="tag" class="gb-card" :class="[`gb-card--${variant}`, { 'gb-card--hover': hoverable, 'gb-card--flush': flush }]">
    <div v-if="title || subtitle || $slots.header || $slots.actions" class="gb-card__header">
      <slot name="header">
        <div class="gb-card__titles">
          <h3 v-if="title" class="gb-card__title">
            <Icon v-if="icon" :name="icon" class="gb-card__icon" />{{ title }}
          </h3>
          <p v-if="subtitle" class="gb-card__subtitle">{{ subtitle }}</p>
        </div>
      </slot>
      <div v-if="$slots.actions" class="gb-card__actions"><slot name="actions"></slot></div>
    </div>
    <div class="gb-card__body"><slot></slot></div>
    <div v-if="$slots.footer" class="gb-card__footer"><slot name="footer"></slot></div>
  </component>
</template>

<script setup>
import Icon from './Icon.vue'
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  variant: { type: String, default: 'default' }, // default | outline | flat | elevated
  hoverable: { type: Boolean, default: false },
  flush: { type: Boolean, default: false }, // body sin padding (p.ej. tablas)
  tag: { type: String, default: 'div' }
})
</script>

<style scoped>
.gb-card {
  background: var(--gb-surface);
  border: 1px solid var(--gb-border);
  border-radius: var(--gb-radius);
  box-shadow: var(--gb-shadow-sm);
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.gb-card--outline { box-shadow: none; }
.gb-card--flat { box-shadow: none; border-color: transparent; background: var(--gb-surface-2); }
.gb-card--elevated { box-shadow: var(--gb-shadow); border-color: transparent; }
.gb-card--hover { transition: transform var(--gb-transition), box-shadow var(--gb-transition); }
.gb-card--hover:hover { transform: translateY(-2px); box-shadow: var(--gb-shadow); }
.gb-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem 0;
}
.gb-card__title { font-size: 1rem; font-weight: 600; margin: 0; color: var(--gb-heading); display: flex; align-items: center; gap: 0.5rem; }
.gb-card__icon { color: var(--gb-primary); }
.gb-card__subtitle { margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--gb-text-muted); }
.gb-card__actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
.gb-card__body { padding: 1rem 1.25rem; flex: 1; min-width: 0; }
.gb-card--flush .gb-card__body { padding: 0; }
.gb-card--flush .gb-card__header { padding-bottom: 1rem; }
.gb-card__footer { padding: 0.75rem 1.25rem; border-top: 1px solid var(--gb-border); }
</style>
