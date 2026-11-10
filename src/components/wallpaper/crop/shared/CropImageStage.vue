<script setup>
import { ref } from 'vue'
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
  imageUrl: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['error', 'load', 'retry'])
const stageImageRef = ref(null)

function getImageElement() {
  return stageImageRef.value
}

defineExpose({
  getImageElement,
})
</script>

<template>
  <div class="crop-area">
    <div
      v-if="imageLoaded && !imageError && imageUrl"
      class="crop-area__backdrop"
      :style="{ backgroundImage: `url(${imageUrl})` }"
    />
    <div class="crop-area__overlay" />

    <div v-if="cropInfo.width > 0" class="crop-size-badge">
      <span class="size-dimensions">{{ cropInfo.width }} × {{ cropInfo.height }}</span>
      <span class="size-divider">|</span>
      <span class="size-ratio">{{ currentRatioDisplay }}</span>
    </div>

    <div v-if="!imageLoaded && !imageError" class="crop-loading">
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
      <button type="button" class="crop-retry" @click="emit('retry')">
        重新加载
      </button>
    </div>

    <img
      v-if="imageUrl"
      v-show="imageLoaded && !imageError"
      :key="imageUrl"
      ref="stageImageRef"
      :src="imageUrl"
      class="crop-image"
      crossorigin="anonymous"
      @load="emit('load', $event)"
      @error="emit('error', $event)"
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
  padding: 4px;
  background:
    radial-gradient(circle at top, rgba(120, 144, 255, 0.14), transparent 42%),
    linear-gradient(180deg, rgba(5, 10, 25, 0.72) 0%, rgba(5, 10, 25, 0.58) 100%);
}

.crop-area__backdrop,
.crop-area__overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.crop-area__backdrop {
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  filter: blur(22px) saturate(1.08);
  transform: scale(1.08);
  opacity: 0.38;
}

.crop-area__overlay {
  background:
    linear-gradient(180deg, rgba(5, 10, 25, 0.12) 0%, rgba(5, 10, 25, 0.32) 100%),
    linear-gradient(
      90deg,
      rgba(var(--color-accent-rgb), 0.08),
      transparent 22%,
      transparent 78%,
      rgba(var(--color-accent-rgb), 0.08)
    );
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
    color: var(--color-accent);
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
  position: relative;
  z-index: 1;
}

.crop-retry {
  min-height: 44px;
  padding: 8px 20px;
  border: 1px solid var(--color-accent);
  border-radius: 8px;
  background: transparent;
  color: var(--color-accent);
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 3px;
  }
}
</style>
