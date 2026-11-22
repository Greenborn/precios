<template>
  <span class="gb-badge" :class="[`gb-badge--${tone}`, `gb-badge--${variant}`, { 'gb-badge--sm': size === 'sm', 'gb-badge--pill': pill }]">
    <span v-if="dot" class="gb-badge__dot" aria-hidden="true"></span>
    <Icon v-if="icon" :name="icon" />
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup>
import Icon from './Icon.vue'
defineProps({
  label: { type: [String, Number], default: '' },
  tone: { type: String, default: 'neutral' }, // neutral | primary | success | warning | danger | info | accent
  variant: { type: String, default: 'soft' }, // soft | solid | outline
  size: { type: String, default: 'md' },      // sm | md
  icon: { type: String, default: '' },
  dot: { type: Boolean, default: false },
  pill: { type: Boolean, default: true }
})
</script>

<style scoped>
.gb-badge {
  --c: var(--gb-text-muted);
  --bg: var(--gb-surface-2);
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
  border-radius: 6px;
  white-space: nowrap;
  border: 1px solid transparent;
}
.gb-badge--pill { border-radius: var(--gb-radius-pill); }
.gb-badge--sm { padding: 0.1rem 0.45rem; font-size: 0.6875rem; }
.gb-badge--primary { --c: var(--gb-primary); --bg: var(--gb-primary-soft-2); }
.gb-badge--success { --c: var(--gb-success); --bg: var(--gb-success-soft); }
.gb-badge--warning { --c: var(--gb-warning); --bg: var(--gb-warning-soft); }
.gb-badge--danger  { --c: var(--gb-danger);  --bg: var(--gb-danger-soft); }
.gb-badge--info    { --c: var(--gb-info);    --bg: var(--gb-info-soft); }
.gb-badge--accent  { --c: var(--gb-accent);  --bg: color-mix(in srgb, var(--gb-accent) 12%, transparent); }
.gb-badge--neutral { --c: var(--gb-text); }
.gb-badge--soft    { color: var(--c); background: var(--bg); }
.gb-badge--solid   { color: var(--gb-on-primary); background: var(--c); }
.gb-badge--outline { color: var(--c); background: transparent; border-color: currentColor; }
.gb-badge__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
</style>
