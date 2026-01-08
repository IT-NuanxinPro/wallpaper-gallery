<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  message: { type: String, default: '' },
  type: { type: String, default: 'info' }, // info, success, error, warning
  duration: { type: Number, default: 2500 },
  show: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show'])

const visible = ref(false)
let timer = null

// 图标映射
const iconMap = {
  success: `<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  error: `<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  warning: `<path d="M12 9v4m0 4h.01M12 3l9.5 16.5H2.5L12 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  info: `<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
}

const icon = computed(() => iconMap[props.type] || iconMap.info)

watch(() => props.show, (val) => {
  if (val) {
    visible.value = true
    clearTimeout(timer)
    if (props.duration > 0) {
      timer = setTimeout(() => {
        visible.value = false
        emit('update:show', false)
      }, props.duration)
    }
  } else {
    visible.value = false
  }
}, { immediate: true })
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="visible" class="app-toast" :class="[`app-toast--${type}`]">
        <svg class="app-toast__icon" viewBox="0 0 24 24" v-html="icon" />
        <span class="app-toast__message">{{ message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.app-toast {
  position: fixed;
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  border-radius: 12px;
  font-size: 14px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  z-index: 10000;
  max-width: calc(100vw - 40px);

  &__icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  &__message {
    line-height: 1.4;
  }

  // 类型颜色
  &--success {
    background: rgba(16, 185, 129, 0.95);
  }

  &--error {
    background: rgba(239, 68, 68, 0.95);
  }

  &--warning {
    background: rgba(245, 158, 11, 0.95);
  }

  &--info {
    background: rgba(99, 102, 241, 0.95);
  }
}

// 动画
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
