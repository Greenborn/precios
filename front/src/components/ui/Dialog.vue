<template>
  <Teleport to="body">
    <Transition name="gb-dialog" appear>
      <div v-if="visible" class="dialog-overlay" @mousedown.self="onMaskClick" @keydown.esc="onEsc">
        <div
          class="dialog-content"
          :class="'dialog-' + size"
          :style="dialogStyle"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="header ? titleId : null"
          tabindex="-1"
          ref="panel"
        >
          <div class="dialog-header">
            <slot name="header">
              <h5 :id="titleId" class="dialog-title">{{ header }}</h5>
            </slot>
            <button v-if="closable" type="button" class="btn-close" aria-label="Cerrar" @click="close"></button>
          </div>
          <div class="dialog-body">
            <slot></slot>
          </div>
          <div v-if="$slots.footer" class="dialog-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'

let seq = 0
const props = defineProps({
  visible: { type: Boolean, default: false },
  header: { type: String, default: '' },
  modal: { type: Boolean, default: false },
  dismissableMask: { type: Boolean, default: true },
  style: { type: [String, Object], default: '' },
  closable: { type: Boolean, default: true },
  // Nuevos
  size: { type: String, default: 'auto' }, // auto | sm | md | lg | xl
  closeOnEscape: { type: Boolean, default: true }
})

const emit = defineEmits(['update:visible', 'after-hide', 'hide'])
const titleId = 'gb-dlg-' + (++seq)
const panel = ref(null)

const dialogStyle = computed(() => {
  if (typeof props.style === 'string') return props.style
  return props.style || {}
})

watch(() => props.visible, async (v) => {
  if (v) { await nextTick(); panel.value && panel.value.focus() }
}, { immediate: true })

function close() {
  emit('update:visible', false)
  emit('hide')
  emit('after-hide')
}

function onMaskClick() {
  if (props.dismissableMask) close()
}
function onEsc() {
  if (props.closeOnEscape && props.closable) close()
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--gb-overlay);
  backdrop-filter: blur(2px);
  z-index: 3000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1.5rem;
  overflow-y: auto;
}
.dialog-content {
  background: var(--gb-surface);
  border-radius: var(--gb-radius-lg);
  box-shadow: var(--gb-shadow-lg);
  width: 100%;
  margin: auto;
  outline: none;
  display: flex;
  flex-direction: column;
}
.dialog-sm { max-width: 400px; }
.dialog-md { max-width: 600px; }
.dialog-lg { max-width: 900px; }
.dialog-xl { max-width: 1200px; }
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--gb-border);
}
.dialog-title {
  margin: 0;
  font-weight: 600;
  font-size: 1.0625rem;
  color: var(--gb-heading);
}
.dialog-body { padding: 1.25rem; }
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.25rem;
  border-top: 1px solid var(--gb-border);
  background: var(--gb-surface-2);
  border-radius: 0 0 var(--gb-radius-lg) var(--gb-radius-lg);
}

.gb-dialog-enter-active, .gb-dialog-leave-active { transition: opacity var(--gb-transition); }
.gb-dialog-enter-active .dialog-content, .gb-dialog-leave-active .dialog-content {
  transition: transform var(--gb-transition), opacity var(--gb-transition);
}
.gb-dialog-enter-from, .gb-dialog-leave-to { opacity: 0; }
.gb-dialog-enter-from .dialog-content, .gb-dialog-leave-to .dialog-content {
  transform: translateY(12px) scale(0.98);
  opacity: 0;
}
</style>
