<script setup>
import { onUnmounted, ref, watch } from 'vue'

defineProps({
  cropInfo: {
    type: Object,
    default: () => ({ width: 0, height: 0 }),
  },
  currentAspectRatio: {
    type: Number,
    default: 1,
  },
  imageLoaded: {
    type: Boolean,
    default: false,
  },
  isProcessing: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['immersivePreview', 'resize'])

const previewCanvasEl = ref(null)
let resizeObserver
watch(previewCanvasEl, (canvas) => {
  resizeObserver?.disconnect()
  if (canvas?.parentElement && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => emit('resize'))
    resizeObserver.observe(canvas.parentElement)
  }
  if (canvas)
    emit('resize')
}, { flush: 'post' })
onUnmounted(() => resizeObserver?.disconnect())

function getCanvasElement() {
  return previewCanvasEl.value
}

defineExpose({
  getCanvasElement,
})
</script>

<template>
  <div class="preview-section">
    <div class="preview-header">
      <h3 class="preview-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
        实时预览
      </h3>
      <div class="preview-info">
        <span class="preview-size">{{ cropInfo.width || '—' }} × {{ cropInfo.height || '—' }}</span>
        <button
          class="preview-fullscreen-btn"
          title="沉浸预览"
          :disabled="isProcessing || !imageLoaded"
          @click="$emit('immersivePreview')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
          <span>全屏预览</span>
        </button>
      </div>
    </div>
    <div class="preview-canvas-wrapper">
      <canvas ref="previewCanvasEl" class="preview-canvas" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.preview-section {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background:
    radial-gradient(circle at top, rgba(var(--color-accent-rgb), 0.12), transparent 55%),
    linear-gradient(180deg, rgba(8, 14, 32, 0.72) 0%, rgba(8, 14, 32, 0.9) 100%);
  height: 340px;
  max-height: 45%;
  min-height: 0;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  flex-shrink: 0;
}

.preview-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.8px;

  svg {
    width: 14px;
    height: 14px;
    color: var(--color-accent);
  }
}

.preview-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-size {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent-contrast-soft);
  font-family: 'SF Mono', Monaco, monospace;
  padding: 3px 8px;
  background: var(--crop-chip-surface);
  border: 1px solid var(--crop-chip-border);
  border-radius: 5px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.preview-fullscreen-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 500;
  color: var(--crop-text-soft);
  background: var(--crop-pill-surface);
  border: 1px solid var(--crop-pill-border);
  border-radius: 6px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 13px;
    height: 13px;
  }

  &:hover:not(:disabled) {
    color: #fff;
    background: var(--crop-pill-surface-strong);
    border-color: var(--crop-pill-border-strong);
  }

  &:disabled {
    color: rgba(255, 255, 255, 0.3);
    background: rgba(9, 16, 32, 0.64);
    border-color: rgba(255, 255, 255, 0.04);
    cursor: not-allowed;
  }
}

.preview-canvas-wrapper {
  flex: 1;
  min-height: 0;
  padding: 14px 18px;
  box-sizing: border-box;
}

.preview-canvas {
  width: 100%;
  height: 100%;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(6, 10, 22, 0.92) 0%, rgba(10, 15, 30, 0.96) 100%);
  display: block;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 14px 36px rgba(0, 0, 0, 0.22);
}
</style>
