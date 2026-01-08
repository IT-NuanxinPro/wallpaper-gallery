<script setup>
/**
 * 真机模式视图组件
 * 使用 Vue Transition 处理动画
 */
import { useDevice } from '@/composables/useDevice'
import PhoneFrame from './PhoneFrame.vue'

defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  imageSrc: {
    type: String,
    required: true,
  },
  imageAlt: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['exit', 'afterEnter', 'afterLeave'])

const { isMobile } = useDevice()

// Transition 钩子 - 通知父组件动画完成
function onAfterEnter() {
  emit('afterEnter')
}

function onAfterLeave() {
  emit('afterLeave')
}
</script>

<template>
  <Transition
    name="device-mode"
    @after-enter="onAfterEnter"
    @after-leave="onAfterLeave"
  >
    <div
      v-if="visible"
      class="device-mode"
      :class="{ 'is-mobile': isMobile }"
    >
      <!-- 退出按钮 -->
      <button
        class="device-mode__exit"
        aria-label="退出真机显示"
        @click="emit('exit')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
        <span>退出真机</span>
      </button>

      <!-- 手机框架 -->
      <div class="device-mode__frame">
        <PhoneFrame>
          <img
            :src="imageSrc"
            :alt="imageAlt"
            class="device-mode__image"
          >
        </PhoneFrame>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.device-mode {
  // PC 和移动端都使用 fixed 定位，确保全屏覆盖
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  z-index: 2000;

  &.is-mobile {
    // 移动端可能需要更高的 z-index
    z-index: 2000;
  }

  // 退出按钮
  &__exit {
    position: fixed;
    top: calc(20px + env(safe-area-inset-top, 0px));
    left: calc(20px + env(safe-area-inset-left, 0px));
    height: 40px;
    padding: 0 16px;
    border-radius: 20px;
    background: #000000;
    border: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    z-index: 10001;
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.25),
      0 2px 10px rgba(0, 0, 0, 0.2);
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
    transition: all 0.2s ease;

    svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    &:hover {
      transform: translateY(-2px);
      box-shadow:
        0 6px 28px rgba(0, 0, 0, 0.35),
        0 4px 16px rgba(0, 0, 0, 0.25);
    }

    &:active {
      transform: translateY(0);
    }

    @include mobile-only {
      top: calc(15px + env(safe-area-inset-top, 0px));
      left: calc(15px + env(safe-area-inset-left, 0px));
      height: 36px;
      padding: 0 12px;
      font-size: 13px;

      svg {
        width: 14px;
        height: 14px;
      }
    }
  }

  // 手机框架容器
  &__frame {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  // 框架内图片
  &__image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }
}

// Vue Transition 动画 - 进入
.device-mode-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); // 弹性效果
}

.device-mode-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(30px);
}

// Vue Transition 动画 - 离开
.device-mode-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.device-mode-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(20px);
}
</style>
