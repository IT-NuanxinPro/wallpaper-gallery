<script setup>
/**
 * 弹窗内容区域（普通模式）
 * 包含图片展示、加载状态、错误处理、长按复制
 */
import { onUnmounted, ref } from 'vue'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import { useToast } from '@/composables/useToast'

const props = defineProps({
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

const toast = useToast()
const isLoaded = ref(false)
const hasError = ref(false)

// 长按相关
let longPressTimer = null
const longPressDelay = 500

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

// 长按开始
function handleTouchStart() {
  longPressTimer = setTimeout(() => {
    handleLongPress()
  }, longPressDelay)
}

// 长按结束
function handleTouchEnd() {
  clearTimeout(longPressTimer)
  longPressTimer = null
}

// 长按处理 - 复制图片
async function handleLongPress() {
  try {
    // 检查是否在原生平台
    const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()

    if (isNative) {
      // 原生平台：使用 Capacitor Clipboard 插件
      try {
        const { Clipboard } = await import('@capacitor/clipboard')
        // Capacitor Clipboard 只支持文本，图片需要用其他方式
        // 复制图片 URL 作为替代
        await Clipboard.write({
          url: props.src,
        })
        toast.success('图片链接已复制')
      }
      catch {
        // 如果 Clipboard 插件不可用，提示用户
        toast.info('长按保存图片到相册')
      }
    }
    else {
      // Web 平台：使用 Clipboard API
      const response = await fetch(props.src)
      const blob = await response.blob()

      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({ [blob.type]: blob })
        await navigator.clipboard.write([item])
        toast.success('图片已复制到剪贴板')
      }
      else {
        toast.warning('当前浏览器不支持复制图片')
      }
    }
  }
  catch {
    toast.error('复制失败')
  }
}

onUnmounted(() => {
  clearTimeout(longPressTimer)
})

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
        @touchstart.passive="handleTouchStart"
        @touchend="handleTouchEnd"
        @touchcancel="handleTouchEnd"
        @contextmenu.prevent="handleLongPress"
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
