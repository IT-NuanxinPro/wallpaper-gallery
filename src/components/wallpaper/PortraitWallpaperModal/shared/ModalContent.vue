<script setup>
/**
 * 弹窗内容区域（普通模式）
 * 包含图片展示、加载状态、错误处理
 */
import { ref } from 'vue'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'

defineProps({
  src: {
    type: String,
    required: true,
  },
  alt: {
    type: String,
    default: '',
  },
  isAvatar: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['load', 'error'])

const isLoaded = ref(false)
const hasError = ref(false)

function handleLoad(e) {
  isLoaded.value = true
  emit('load', {
    width: e.target.naturalWidth,
    height: e.target.naturalHeight,
  })
}

function handleError() {
  hasError.value = true
  isLoaded.value = true
  emit('error')
}

// 暴露状态给父组件
defineExpose({ isLoaded, hasError })
</script>

<template>
  <div class="modal-content" :class="{ 'is-avatar': isAvatar }">
    <!-- 加载中 -->
    <Transition name="fade">
      <div v-if="!isLoaded" class="modal-content__loading">
        <LoadingSpinner size="lg" />
      </div>
    </Transition>

    <!-- 加载失败 -->
    <Transition name="fade">
      <div v-if="hasError" class="modal-content__error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <p>图片加载失败</p>
      </div>
    </Transition>

    <!-- 图片 -->
    <Transition name="image-reveal">
      <img
        v-show="isLoaded && !hasError"
        :src="src"
        :alt="alt"
        class="modal-content__image"
        :class="{ 'is-avatar': isAvatar }"
        @load="handleLoad"
        @error="handleError"
      >
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.modal-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 60vh;
  background: var(--color-bg-primary);
  overflow: hidden;

  &.is-avatar {
    min-height: auto;
    flex: 0 0 auto;
    aspect-ratio: 1 / 1;
    width: 100%;
  }

  @include mobile-only {
    min-height: 55vh;

    &.is-avatar {
      min-height: auto;
    }
  }

  // 加载和错误状态
  &__loading,
  &__error {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: $spacing-md;
    color: var(--color-text-muted);

    svg {
      width: 48px;
      height: 48px;
    }
  }

  // 图片
  &__image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;

    &.is-avatar {
      width: 100%;
      height: auto;
      aspect-ratio: 1 / 1;
      object-fit: cover;
    }
  }
}

// 淡入淡出动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// 图片揭示动画 - 只使用 opacity，避免 scale 导致的视觉跳动
.image-reveal-enter-active {
  transition: opacity 0.35s ease-out;
}

.image-reveal-enter-from {
  opacity: 0;
}
</style>
