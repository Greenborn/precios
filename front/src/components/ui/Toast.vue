<template>
  <div class="gb-toast-stack" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="gb-toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="gb-toast"
        :class="'gb-toast--' + t.severity"
        :role="t.severity === 'error' || t.severity === 'danger' ? 'alert' : 'status'"
      >
        <i class="bi gb-toast__icon" :class="iconFor(t.severity)" aria-hidden="true"></i>
        <div class="gb-toast__body">
          <div v-if="t.summary" class="gb-toast__title">{{ t.summary }}</div>
          <div v-if="t.detail" class="gb-toast__detail">{{ t.detail }}</div>
        </div>
        <button type="button" class="btn-close gb-toast__close" aria-label="Cerrar" @click="removeById(t.id)"></button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// API: add({ severity: 'success'|'info'|'warn'|'warning'|'error'|'danger'|'secondary', summary, detail, life })
const toasts = ref([])
let seq = 0

const NORMALIZE = { warn: 'warning', error: 'danger' }
const ICONS = {
  success: 'bi-check-circle-fill',
  info: 'bi-info-circle-fill',
  warning: 'bi-exclamation-triangle-fill',
  danger: 'bi-x-circle-fill',
  secondary: 'bi-bell-fill'
}

function iconFor(sev) { return ICONS[sev] || ICONS.secondary }

function add(t) {
  const sev = NORMALIZE[t.severity] || t.severity || 'secondary'
  const toast = { id: ++seq, severity: sev, summary: t.summary, detail: t.detail }
  toasts.value.push(toast)
  if (t.life) setTimeout(() => removeById(toast.id), t.life)
}

function removeById(id) {
  const i = toasts.value.findIndex(x => x.id === id)
  if (i >= 0) toasts.value.splice(i, 1)
}

// Retrocompat: remove(index)
function remove(i) { if (i >= 0) toasts.value.splice(i, 1) }

defineExpose({ add, remove })
</script>

<style scoped>
.gb-toast-stack {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 4000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: min(380px, calc(100vw - 2rem));
  pointer-events: none;
}
.gb-toast {
  --tone: var(--gb-text-muted);
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 0.9rem;
  background: var(--gb-surface);
  border: 1px solid var(--gb-border);
  border-left: 4px solid var(--tone);
  border-radius: var(--gb-radius);
  box-shadow: var(--gb-shadow-lg);
}
.gb-toast--success { --tone: var(--gb-success); }
.gb-toast--info { --tone: var(--gb-info); }
.gb-toast--warning { --tone: var(--gb-warning); }
.gb-toast--danger { --tone: var(--gb-danger); }
.gb-toast__icon { color: var(--tone); font-size: 1.15rem; line-height: 1.3; }
.gb-toast__body { flex: 1; min-width: 0; }
.gb-toast__title { font-weight: 600; color: var(--gb-heading); font-size: 0.9rem; }
.gb-toast__detail { color: var(--gb-text-muted); font-size: 0.85rem; word-wrap: break-word; }
.gb-toast__close { font-size: 0.65rem; margin-top: 0.25rem; }

.gb-toast-enter-active, .gb-toast-leave-active { transition: all var(--gb-transition); }
.gb-toast-enter-from { opacity: 0; transform: translateX(24px); }
.gb-toast-leave-to { opacity: 0; transform: translateX(24px); }
.gb-toast-move { transition: transform var(--gb-transition); }
</style>
