<script setup>
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'

defineProps({
  cropInfo: {
    type: Object,
    default: () => ({ width: 0, height: 0 }),
  },
  currentRatioDisplay: {
    type: String,
    default: '',
  },
  imageLoaded: {
    type: Boolean,
    default: false,
  },
  imageError: {
    type: Boolean,
    default: false,
  },
  imageRef: {
    type: Object,
    default: null,
  },
  imageUrl: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['error', 'load'])
</script>

<template>
  <div class="crop-area">
    <div v-if="cropInfo.width > 0" class="crop-size-badge">
      <span class="size-dimensions">{{ cropInfo.width }} × {{ cropInfo.height }}</span>
      <span class="size-divider">|</span>
      <span class="size-ratio">{{ currentRatioDisplay }}</span>
    </div>

    <div v-if="!imageLoaded" class="crop-loading">
      <LoadingSpinner size="lg" />
      <p>正在加载原图...</p>
      <p class="loading-hint">
        原图较大，请耐心等待
      </p>
    </div>

    <div v-else-if="imageError" class="crop-error">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <p>原图加载失败</p>
    </div>

    <img
      v-show="imageLoaded && !imageError"
      :ref="imageRef"
      :src="imageUrl"
      class="crop-image"
      crossorigin="anonymous"
      @load="emit('load')"
      @error="emit('error')"
    >
  </div>
</template>

<style lang="scss" scoped>
.crop-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  min-height: 0;
  will-change: contents;
  padding: 8px;
  background: rgba(0, 0, 0, 0.15);
}

.crop-size-badge {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: 'SF Mono', Monaco, 'Consolas', monospace;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  .size-dimensions {
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.3px;
  }

  .size-divider {
    color: rgba(255, 255, 255, 0.3);
    font-weight: 300;
  }

  .size-ratio {
    font-size: 14px;
    font-weight: 600;
    color: #667eea;
  }
}

.crop-loading,
.crop-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: rgba(255, 255, 255, 0.5);

  p {
    font-size: 14px;
    margin: 0;
  }

  .loading-hint {
    font-size: 12px;
    opacity: 0.5;
  }

  svg {
    width: 52px;
    height: 52px;
    opacity: 0.6;
  }
}

.crop-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
}
</style>
