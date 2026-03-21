<script setup>
/**
 * 图片裁剪区域 - 基于 Cropper.js
 */
import Cropper from 'cropperjs'
import { nextTick, onUnmounted, ref, watch } from 'vue'
import 'cropperjs/dist/cropper.css'

const props = defineProps({
  imageSource: { type: String, required: true },
  aspectRatio: { type: Number, default: 1 },
})

const emit = defineEmits(['cropChange', 'imageLoaded', 'imageError'])

const imageRef = ref(null)
const cropper = ref(null)
const imageLoaded = ref(false)
const imageError = ref(false)
const cropInfo = ref({ width: 0, height: 0 })
const zoomLevel = ref(1)
const initialZoomRatio = ref(1)

function initCropper() {
  if (!imageRef.value || cropper.value)
    return

  cropper.value = new Cropper(imageRef.value, {
    aspectRatio: props.aspectRatio,
    viewMode: 1,
    dragMode: 'move',
    autoCropArea: 0.9,
    restore: false,
    guides: true,
    center: true,
    highlight: false,
    cropBoxMovable: true,
    cropBoxResizable: true,
    toggleDragModeOnDblclick: false,
    initialAspectRatio: props.aspectRatio,
    minContainerWidth: 200,
    minContainerHeight: 200,
    checkCrossOrigin: false,
    checkOrientation: false,
    background: true,
    responsive: true,
    ready() {
      const canvasData = cropper.value.getCanvasData()
      const imageData = cropper.value.getImageData()
      initialZoomRatio.value = canvasData.width / imageData.naturalWidth
      zoomLevel.value = 1
      updateCropInfo()
    },
    crop() { updateCropInfo() },
    zoom(event) {
      if (initialZoomRatio.value > 0) {
        zoomLevel.value = event.detail.ratio / initialZoomRatio.value
      }
    },
  })
}

function destroyCropper() {
  if (cropper.value) {
    try {
      cropper.value.destroy()
    }
    catch (e) {
      console.warn('Cropper destroy error:', e)
    }
    cropper.value = null
  }
}

function updateCropInfo() {
  if (!cropper.value)
    return
  const data = cropper.value.getData()
  cropInfo.value = { width: Math.round(data.width), height: Math.round(data.height) }
  emit('cropChange', {
    x: Math.round(data.x),
    y: Math.round(data.y),
    width: cropInfo.value.width,
    height: cropInfo.value.height,
    scale: zoomLevel.value,
  })
}

function handleImageLoad() {
  imageLoaded.value = true
  imageError.value = false
  emit('imageLoaded', {
    width: imageRef.value?.naturalWidth || 0,
    height: imageRef.value?.naturalHeight || 0,
  })
  nextTick(() => initCropper())
}

function handleImageError() {
  imageLoaded.value = false
  imageError.value = true
  emit('imageError')
}

function getCroppedCanvas(options = {}) {
  if (!cropper.value)
    return null
  return cropper.value.getCroppedCanvas({
    width: 440,
    height: 440,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    ...options,
  })
}

function reset() {
  if (!cropper.value)
    return
  cropper.value.reset()
  const canvasData = cropper.value.getCanvasData()
  const imageData = cropper.value.getImageData()
  initialZoomRatio.value = canvasData.width / imageData.naturalWidth
  zoomLevel.value = 1
}

function getCropData() {
  if (!cropper.value)
    return null
  const data = cropper.value.getData()
  return {
    x: Math.round(data.x),
    y: Math.round(data.y),
    width: Math.round(data.width),
    height: Math.round(data.height),
    scale: zoomLevel.value,
  }
}

defineExpose({ getCroppedCanvas, reset, getCropData })

watch(() => props.imageSource, (newSource, oldSource) => {
  if (newSource !== oldSource) {
    destroyCropper()
    imageLoaded.value = false
    imageError.value = false
    cropInfo.value = { width: 0, height: 0 }
    zoomLevel.value = 1
  }
})

onUnmounted(() => destroyCropper())
</script>

<template>
  <div class="cropper-area">
    <div class="cropper-tips">
      <span class="tip-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
        </svg>
        鼠标滚动放大缩小
      </span>
      <span class="tip-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
        </svg>
        拖拽移动图片
      </span>
    </div>

    <div v-if="cropInfo.width > 0" class="crop-size-badge">
      <span class="size-dimensions">{{ cropInfo.width }} × {{ cropInfo.height }}</span>
      <span class="size-divider">|</span>
      <span class="size-ratio">1:1</span>
      <span class="size-divider">|</span>
      <span class="size-zoom">{{ Math.round(zoomLevel * 100) }}%</span>
    </div>

    <div class="cropper-container">
      <div v-if="!imageLoaded && !imageError" class="cropper-loading">
        <span class="loading-spinner" />
        <span>正在加载图片...</span>
      </div>

      <div v-else-if="imageError" class="cropper-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span>图片加载失败</span>
      </div>

      <img
        v-show="imageLoaded && !imageError"
        ref="imageRef"
        :src="imageSource"
        class="cropper-image"
        crossorigin="anonymous"
        @load="handleImageLoad"
        @error="handleImageError"
      >
    </div>
  </div>
</template>

<style lang="scss" scoped>
.cropper-area {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 250px;
  background: rgba(0, 0, 0, 0.2);
}

.cropper-tips {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  border-radius: 6px;
  white-space: nowrap;

  svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    opacity: 0.8;
  }
}

.crop-size-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: 'SF Mono', Monaco, 'Consolas', monospace;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  .size-dimensions {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }
  .size-divider {
    color: rgba(255, 255, 255, 0.3);
    font-weight: 300;
  }
  .size-ratio {
    font-size: 13px;
    font-weight: 600;
    color: #667eea;
  }
  .size-zoom {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
  }
}

.cropper-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 0;
}

.cropper-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.cropper-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;

  svg {
    width: 48px;
    height: 48px;
    opacity: 0.6;
  }
}

.cropper-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
}

:deep(.cropper-container) {
  width: 100% !important;
  height: 100% !important;
}
:deep(.cropper-view-box) {
  outline: 2px solid rgba(102, 126, 234, 0.9);
}
:deep(.cropper-line) {
  background-color: #667eea;
}
:deep(.cropper-point) {
  width: 10px;
  height: 10px;
  background-color: #667eea;
  border-radius: 50%;
  opacity: 1;
}
:deep(.cropper-point.point-e),
:deep(.cropper-point.point-n),
:deep(.cropper-point.point-w),
:deep(.cropper-point.point-s) {
  width: 8px;
  height: 8px;
}
:deep(.cropper-point.point-ne),
:deep(.cropper-point.point-nw),
:deep(.cropper-point.point-se),
:deep(.cropper-point.point-sw) {
  width: 12px;
  height: 12px;
}
:deep(.cropper-dashed) {
  border-color: rgba(255, 255, 255, 0.4);
}
:deep(.cropper-center::before),
:deep(.cropper-center::after) {
  background-color: rgba(255, 255, 255, 0.6);
}
:deep(.cropper-modal) {
  background-color: rgba(0, 0, 0, 0.6);
}
</style>
