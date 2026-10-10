<script setup>
import LoadingSpinner from './LoadingSpinner.vue'

defineOptions({ inheritAttrs: false })
defineProps({
  isOpen: { type: Boolean, default: false },
  error: { type: Error, default: null },
})
defineEmits(['close'])
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-loading" role="dialog" aria-modal="true" aria-label="加载预览" @keydown.esc="$emit('close')">
      <div class="modal-loading__panel">
        <button class="modal-loading__close" type="button" aria-label="关闭" autofocus @click="$emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <div role="status" aria-live="polite" class="modal-loading__status">
          <LoadingSpinner v-if="!error" />
          <p>{{ error ? '预览加载失败，请关闭后重试' : '正在打开预览' }}</p>
        </div>
      </div>
    </div>
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
  background: var(--color-bg-modal);
}

.modal-loading__panel {
  position: relative;
  width: min(100%, 320px);
  padding: 56px 24px 36px;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  background: var(--color-bg-card);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
}

.modal-loading__status {
  display: grid;
  justify-items: center;
  gap: 16px;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.modal-loading__close {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  color: var(--color-text-secondary);

  svg {
    width: 20px;
    height: 20px;
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -4px;
  }
}
</style>
