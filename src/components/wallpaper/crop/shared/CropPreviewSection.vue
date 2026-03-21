<script setup>
defineProps({
  cropInfo: {
    type: Object,
    default: () => ({ width: 0, height: 0 }),
  },
  imageLoaded: {
    type: Boolean,
    default: false,
  },
  isProcessing: {
    type: Boolean,
    default: false,
  },
  previewCanvasRef: {
    type: Object,
    default: null,
  },
})

defineEmits(['immersivePreview'])
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
      <canvas :ref="previewCanvasRef" class="preview-canvas" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.preview-section {
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.2);
  height: 260px;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
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
    color: #667eea;
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
  color: #667eea;
  font-family: 'SF Mono', Monaco, monospace;
  padding: 3px 8px;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 5px;
}

.preview-fullscreen-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 13px;
    height: 13px;
  }

  &:hover:not(:disabled) {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.15);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.preview-canvas-wrapper {
  padding: 8px 16px 12px;
  height: calc(100% - 30px);
  box-sizing: border-box;
}

.preview-canvas {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  background: #0a0a12;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
</style>
