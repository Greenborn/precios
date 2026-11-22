<template>
  <button
    :type="type"
    class="btn gb-btn"
    :class="classes"
    :disabled="disabled || loading"
    :autofocus="autofocus"
    :aria-busy="loading ? 'true' : null"
    :aria-label="!label && !$slots.default ? (ariaLabel || icon) : null"
    @click="onClick"
  >
    <span v-if="loading" class="spinner-border spinner-border-sm gb-btn__spinner" aria-hidden="true"></span>
    <Icon v-else-if="icon && iconPos !== 'right'" :name="icon" />
    <span v-if="label || $slots.default" class="gb-btn__label"><slot>{{ label }}</slot></span>
    <Icon v-if="!loading && icon && iconPos === 'right'" :name="icon" />
  </button>
</template>

<script setup>
import { computed } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  label: { type: String, default: '' },
  icon: { type: String, default: '' },
  iconPos: { type: String, default: 'left' },
  disabled: { type: Boolean, default: false },
  autofocus: { type: Boolean, default: false },
  class: { type: [String, Array, Object], default: '' },
  loading: { type: Boolean, default: false },
  // Nuevos
  variant: { type: String, default: '' },     // primary | secondary | ghost | danger | outline | success | link
  severity: { type: String, default: '' },    // alias estilo PrimeVue: secondary|success|danger|warning|info
  size: { type: String, default: '' },        // sm | md | lg | small | large
  text: { type: Boolean, default: false },    // estilo ghost
  outlined: { type: Boolean, default: false },
  rounded: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  type: { type: String, default: 'button' },
  ariaLabel: { type: String, default: '' }
})

const emit = defineEmits(['click'])

const classes = computed(() => {
  const legacy = String(props.class || '').split(/\s+/)
  const has = (c) => legacy.includes(c)
  let variant = props.variant || props.severity || 'primary'
  if (has('p-button-danger')) variant = 'danger-outline'
  if (has('p-button-text')) variant = 'link'
  if (props.text && variant !== 'link') variant = props.severity ? `ghost-${props.severity}` : 'ghost'
  else if (props.outlined) variant = `outline-${variant}`

  const map = {
    primary: 'btn-primary',
    secondary: 'gb-btn--secondary',
    ghost: 'gb-btn--ghost',
    danger: 'btn-danger',
    'danger-outline': 'btn-outline-danger',
    success: 'btn-success',
    warning: 'btn-warning',
    info: 'btn-info',
    link: 'btn-link',
    outline: 'btn-outline-primary'
  }
  let vc = map[variant]
  if (!vc && variant.startsWith('outline-')) vc = 'btn-' + variant
  if (!vc && variant.startsWith('ghost-')) vc = 'gb-btn--ghost gb-btn--ghost-' + variant.slice(6)
  vc = vc || 'btn-primary'

  const sz = { sm: 'btn-sm', small: 'btn-sm', lg: 'btn-lg', large: 'btn-lg' }[props.size] || ''
  return [vc, sz, {
    'gb-btn--rounded': props.rounded,
    'gb-btn--icon-only': props.icon && !props.label,
    'w-100': props.block,
    'gb-btn--loading': props.loading
  }, props.class]
})

function onClick(e) {
  if (props.disabled || props.loading) return
  emit('click', e)
}
</script>

<style scoped>
.gb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  font-weight: 500;
  border-radius: var(--gb-radius-sm);
  transition: background-color var(--gb-transition-fast), border-color var(--gb-transition-fast),
    color var(--gb-transition-fast), box-shadow var(--gb-transition-fast), transform var(--gb-transition-fast);
}
.gb-btn:not(.btn-sm):not(.btn-lg) { min-height: var(--gb-control-height); }
.gb-btn:active:not(:disabled) { transform: translateY(1px); }
.gb-btn:focus-visible { outline: none; box-shadow: var(--gb-focus-ring); }
.gb-btn__spinner { width: 1em; height: 1em; border-width: 0.15em; }
.gb-btn--rounded { border-radius: var(--gb-radius-pill); }
.gb-btn--icon-only { padding-inline: 0.6rem; }
.gb-btn--icon-only.btn-sm { padding-inline: 0.45rem; }

.gb-btn--secondary {
  background: var(--gb-surface);
  color: var(--gb-text);
  border: 1px solid var(--gb-border-strong);
}
.gb-btn--secondary:hover:not(:disabled) { background: var(--gb-surface-2); color: var(--gb-heading); }

.gb-btn--ghost {
  background: transparent;
  border: 1px solid transparent;
  color: var(--gb-text);
}
.gb-btn--ghost:hover:not(:disabled) { background: var(--gb-surface-2); }
.gb-btn--ghost-success, .gb-btn--ghost-primary { color: var(--gb-primary); }
.gb-btn--ghost-danger { color: var(--gb-danger); }
.gb-btn--ghost-danger:hover:not(:disabled) { background: var(--gb-danger-soft); }
.gb-btn--ghost-warning { color: var(--gb-warning); }
.gb-btn--ghost-info { color: var(--gb-info); }
.gb-btn--ghost-secondary { color: var(--gb-text-muted); }
</style>
