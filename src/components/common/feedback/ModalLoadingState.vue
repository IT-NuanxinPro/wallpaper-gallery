<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import SoftLoading from './SoftLoading.vue'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  isOpen: { type: Boolean, default: false },
  error: { type: Error, default: null },
})
const emit = defineEmits(['close'])
const closeButton = ref(null)
let previousFocus

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
  else if (event.key === 'Tab') {
    // 异步内容就绪前只有关闭按钮可交互，避免焦点穿过遮罩。
    event.preventDefault()
    closeButton.value?.focus({ preventScroll: true })
  }
}

function releaseFocus() {
  document.removeEventListener('keydown', handleKeydown)
  if (document.activeElement === closeButton.value && previousFocus?.isConnected)
    previousFocus.focus({ preventScroll: true })
}

watch(() => props.isOpen, async (open) => {
  if (!open) {
    releaseFocus()
    return
  }
  previousFocus = document.activeElement
  document.addEventListener('keydown', handleKeydown)
  await nextTick()
  if (props.isOpen)
    closeButton.value?.focus({ preventScroll: true })
}, { immediate: true })

onBeforeUnmount(releaseFocus)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-loading" appear>
      <div v-if="isOpen" class="modal-loading" role="dialog" aria-modal="true" :aria-label="error ? '预览加载失败' : '加载预览'" @click.self="emit('close')" @wheel.prevent @touchmove.prevent>
        <button ref="closeButton" class="modal-loading__close" type="button" aria-label="关闭" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <div role="status" aria-live="polite" aria-atomic="true" class="modal-loading__status">
          <SoftLoading v-if="!error" :size="64" decorative />
          <svg v-else class="modal-loading__error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6m0 3v.1" stroke-linecap="round" />
          </svg>
          <p>{{ error ? '预览暂时无法打开，请关闭后刷新页面重试' : '正在打开预览' }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.modal-loading {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: color-mix(in srgb, var(--color-bg-modal) 85%, #111827 15%);
}

.modal-loading__status {
  display: grid;
  justify-items: center;
  gap: 16px;
  max-width: 28ch;
  color: rgba(255, 255, 255, 0.88);
  font-size: 14px;
  line-height: 1.6;
  text-align: center;

  p {
    margin: 0;
  }
}

.modal-loading__error {
  width: 44px;
  height: 44px;
}

.modal-loading__close {
  position: absolute;
  top: max(20px, env(safe-area-inset-top));
  right: max(20px, env(safe-area-inset-right));
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.2);
  color: #fff;
  transition:
    background-color 150ms ease,
    transform 150ms ease;

  svg {
    width: 20px;
    height: 20px;
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -4px;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.4);
  }

  &:active {
    transform: scale(0.94);
  }
}

.modal-loading-enter-active,
.modal-loading-leave-active {
  transition: opacity 160ms ease-out;
}

.modal-loading-enter-active .modal-loading__status,
.modal-loading-leave-active .modal-loading__status {
  transition: transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.modal-loading-enter-from,
.modal-loading-leave-to {
  opacity: 0;
}

.modal-loading-enter-from .modal-loading__status {
  transform: translateY(4px);
}

.modal-loading-leave-to .modal-loading__status {
  transform: translateY(-3px);
}

@media (prefers-reduced-motion: reduce) {
  .modal-loading__close,
  .modal-loading-enter-active,
  .modal-loading-leave-active,
  .modal-loading-enter-active .modal-loading__status,
  .modal-loading-leave-active .modal-loading__status {
    transition: none;
  }
}
</style>
