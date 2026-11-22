<template>
  <header class="gb-page-header">
    <nav v-if="breadcrumbs.length" aria-label="breadcrumb">
      <ol class="gb-breadcrumbs">
        <li v-for="(b, i) in breadcrumbs" :key="i" :aria-current="i === breadcrumbs.length - 1 ? 'page' : null">
          <router-link v-if="b.to && i < breadcrumbs.length - 1" :to="b.to">{{ b.label }}</router-link>
          <span v-else>{{ b.label }}</span>
          <Icon v-if="i < breadcrumbs.length - 1" name="bi-chevron-right" class="gb-breadcrumbs__sep" />
        </li>
      </ol>
    </nav>
    <div class="gb-page-header__row">
      <div class="gb-page-header__titles">
        <h1 class="gb-page-header__title">
          <span v-if="icon" class="gb-page-header__icon"><Icon :name="icon" /></span>
          <slot name="title">{{ title }}</slot>
        </h1>
        <p v-if="subtitle || $slots.subtitle" class="gb-page-header__subtitle"><slot name="subtitle">{{ subtitle }}</slot></p>
      </div>
      <div v-if="$slots.actions" class="gb-page-header__actions"><slot name="actions"></slot></div>
    </div>
    <slot></slot>
  </header>
</template>

<script setup>
import Icon from './Icon.vue'
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  // [{ label: 'Inicio', to: '/' }, { label: 'Productos' }]
  breadcrumbs: { type: Array, default: () => [] }
})
</script>

<style scoped>
.gb-page-header { margin-bottom: 1.5rem; }
.gb-breadcrumbs {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0;
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  color: var(--gb-text-muted);
}
.gb-breadcrumbs li { display: inline-flex; align-items: center; gap: 0.25rem; }
.gb-breadcrumbs a { color: var(--gb-text-muted); text-decoration: none; }
.gb-breadcrumbs a:hover { color: var(--gb-primary); }
.gb-breadcrumbs li:last-child { color: var(--gb-text); font-weight: 500; }
.gb-breadcrumbs__sep { font-size: 0.65rem; opacity: 0.7; }
.gb-page-header__row { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.gb-page-header__titles { min-width: 0; }
.gb-page-header__title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  color: var(--gb-heading);
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.gb-page-header__icon {
  width: 2.25rem; height: 2.25rem;
  border-radius: var(--gb-radius-sm);
  display: grid; place-items: center;
  font-size: 1.1rem;
  background: var(--gb-primary-soft-2);
  color: var(--gb-primary);
}
.gb-page-header__subtitle { margin: 0.3rem 0 0; color: var(--gb-text-muted); font-size: 0.9rem; }
.gb-page-header__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
</style>
