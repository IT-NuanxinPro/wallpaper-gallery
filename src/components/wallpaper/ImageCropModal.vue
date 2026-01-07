<script setup>
/**
 * 智能图片裁剪弹窗组件
 * 专为 PC 端电脑壁纸设计
 * 功能：多比例预设、自定义分辨率、缩放、沉浸预览、实时预览
 */
import Cropper from 'cropperjs'
import { gsap } from 'gsap'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { trackImageCrop } from '@/utils/analytics'
import 'cropperjs/dist/cropper.css'

const props = defineProps({
  imageUrl: {
    type: String,
    required: true,
  },
  filename: {
    type: String,
    default: 'cropped-wallpaper',
  },
  isOpen: {
    type: Boolean,
    default: false,
  },
  originalResolution: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close'])

// Refs
const modalRef = ref(null)
const contentRef = ref(null)
const imageRef = ref(null)
const previewCanvasRef = ref(null)
const cropper = ref(null)

// State
const imageLoaded = ref(false)
const imageError = ref(false)
const isProcessing = ref(false)
const isCropCompleted = ref(false) // 标记是否完成裁剪（用于区分取消和完成）
const selectedRatio = ref('auto')
const cropInfo = ref({ width: 0, height: 0 })
const zoomLevel = ref(1)
const initialZoomRatio = ref(1) // 记录初始缩放比例，用于计算相对缩放
const isImmersivePreview = ref(false)
const immersiveImageUrl = ref('')
const outputOriginal = ref(false)
const showCustomInput = ref(false)
const customWidth = ref('')
const customHeight = ref('')
const previewUpdateTimer = ref(null)

// 获取用户屏幕分辨率
const screenResolution = ref({
  width: Math.round(window.screen.width * (window.devicePixelRatio || 1)),
  height: Math.round(window.screen.height * (window.devicePixelRatio || 1)),
})

// 比例预设配置
const ratioPresets = computed(() => [
  // 自动适配当前屏幕
  {
    id: 'auto',
    name: '自动适配',
    description: `${screenResolution.value.width}×${screenResolution.value.height}`,
    ratio: screenResolution.value.width / screenResolution.value.height,
    highlight: true,
  },
  // 电脑/显示器
  { id: '16:9', name: '16:9', description: '标准宽屏', ratio: 16 / 9 },
  { id: '21:9', name: '21:9', description: '带鱼屏', ratio: 21 / 9 },
  { id: '16:10', name: '16:10', description: 'MacBook', ratio: 16 / 10 },
  { id: '3:2', name: '3:2', description: 'Surface', ratio: 3 / 2 },
  // 平板 iPad
  { id: '4:3', name: '4:3', description: 'iPad', ratio: 4 / 3 },
  // 手机竖屏
  { id: '9:16', name: '9:16', description: '手机标准', ratio: 9 / 16 },
  { id: '9:19.5', name: '9:19.5', description: 'iPhone', ratio: 9 / 19.5 },
  { id: '9:21', name: '9:21', description: '安卓全面屏', ratio: 9 / 21 },
  // 其他
  { id: '1:1', name: '1:1', description: '正方形', ratio: 1 },
  { id: 'free', name: '自由', description: '任意比例', ratio: Number.NaN },
])

// 当前选中的比例配置
const currentPreset = computed(() =>
  ratioPresets.value.find(p => p.id === selectedRatio.value) || ratioPresets.value[0],
)

// 初始化 Cropper
function initCropper() {
  if (!imageRef.value || cropper.value)
    return

  const preset = currentPreset.value
  const aspectRatio = Number.isNaN(preset.ratio) ? Number.NaN : preset.ratio

  cropper.value = new Cropper(imageRef.value, {
    aspectRatio,
    viewMode: 1,
    dragMode: 'move',
    autoCropArea: 0.85,
    restore: false,
    guides: true,
    center: true,
    highlight: false, // 关闭高亮提升性能
    cropBoxMovable: true,
    cropBoxResizable: true,
    toggleDragModeOnDblclick: false,
    initialAspectRatio: aspectRatio,
    minContainerWidth: 200,
    minContainerHeight: 200,
    checkCrossOrigin: false, // 跳过跨域检查
    checkOrientation: false, // 跳过 EXIF 方向检查，提升性能
    ready() {
      // 记录初始缩放比例
      const canvasData = cropper.value.getCanvasData()
      const imageData = cropper.value.getImageData()
      initialZoomRatio.value = canvasData.width / imageData.naturalWidth
      zoomLevel.value = 1 // 相对缩放从 100% 开始
      updatePreview()
    },
    crop(event) {
      cropInfo.value = {
        width: Math.round(event.detail.width),
        height: Math.round(event.detail.height),
      }
      debouncedUpdatePreview()
    },
    zoom(event) {
      // 计算相对于初始状态的缩放比例
      if (initialZoomRatio.value > 0) {
        zoomLevel.value = event.detail.ratio / initialZoomRatio.value
      }
      debouncedUpdatePreview()
    },
  })
}

// 销毁 Cropper
function destroyCropper() {
  if (cropper.value) {
    cropper.value.destroy()
    cropper.value = null
  }
}

// 节流更新预览（增加延迟提升性能）
function debouncedUpdatePreview() {
  if (previewUpdateTimer.value) {
    clearTimeout(previewUpdateTimer.value)
  }
  previewUpdateTimer.value = setTimeout(() => {
    updatePreview()
  }, 120) // 增加延迟，减少频繁重绘
}

// 更新实时预览 - 优化性能版本
function updatePreview() {
  if (!cropper.value || !previewCanvasRef.value)
    return

  try {
    // 使用适中分辨率，平衡清晰度与性能
    const previewCanvas = cropper.value.getCroppedCanvas({
      maxWidth: 600,
      maxHeight: 340,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'medium', // 中等质量，提升性能
    })

    if (previewCanvas) {
      const ctx = previewCanvasRef.value.getContext('2d')
      // 预览区域尺寸
      const containerWidth = previewCanvasRef.value.offsetWidth || 600
      const containerHeight = 180

      // 计算缩放比例保持比例
      const scale = Math.min(
        containerWidth / previewCanvas.width,
        containerHeight / previewCanvas.height,
      )
      const drawWidth = previewCanvas.width * scale
      const drawHeight = previewCanvas.height * scale
      const offsetX = (containerWidth - drawWidth) / 2
      const offsetY = (containerHeight - drawHeight) / 2

      // 使用设备像素比提高清晰度
      const dpr = window.devicePixelRatio || 1
      previewCanvasRef.value.width = containerWidth * dpr
      previewCanvasRef.value.height = containerHeight * dpr
      previewCanvasRef.value.style.width = `${containerWidth}px`
      previewCanvasRef.value.style.height = `${containerHeight}px`
      ctx.scale(dpr, dpr)

      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, containerWidth, containerHeight)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(previewCanvas, offsetX, offsetY, drawWidth, drawHeight)
    }
  }
  catch {
    // 忽略预览错误
  }
}

// 切换比例
function selectRatio(ratioId) {
  if (selectedRatio.value === ratioId)
    return

  selectedRatio.value = ratioId
  showCustomInput.value = false

  const preset = ratioPresets.value.find(p => p.id === ratioId)
  if (cropper.value && preset) {
    const aspectRatio = Number.isNaN(preset.ratio) ? Number.NaN : preset.ratio
    cropper.value.setAspectRatio(aspectRatio)
  }
}

// 应用自定义分辨率
function applyCustomResolution() {
  const w = Number.parseInt(customWidth.value)
  const h = Number.parseInt(customHeight.value)

  if (w > 0 && h > 0 && cropper.value) {
    const ratio = w / h
    cropper.value.setAspectRatio(ratio)
    selectedRatio.value = 'custom'
  }
}

// 缩放控制
function handleZoom(direction) {
  if (!cropper.value)
    return

  const step = direction === 'in' ? 0.1 : -0.1
  cropper.value.zoom(step)
}

// 重置缩放
function resetZoom() {
  if (!cropper.value)
    return
  cropper.value.reset()
  // 重置后重新计算初始缩放比例
  const canvasData = cropper.value.getCanvasData()
  const imageData = cropper.value.getImageData()
  initialZoomRatio.value = canvasData.width / imageData.naturalWidth
  zoomLevel.value = 1
}

// 沉浸式预览
async function showImmersivePreview() {
  if (!cropper.value || isProcessing.value)
    return

  isProcessing.value = true

  try {
    const canvas = cropper.value.getCroppedCanvas({
      maxWidth: 4096,
      maxHeight: 4096,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    })

    if (canvas) {
      immersiveImageUrl.value = canvas.toDataURL('image/png')
      isImmersivePreview.value = true

      await nextTick()
      gsap.fromTo('.immersive-preview', { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' })
      gsap.fromTo('.immersive-image', { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.2)', delay: 0.1 })
    }
  }
  catch (error) {
    console.error('预览生成失败:', error)
  }
  finally {
    isProcessing.value = false
  }
}

// 关闭沉浸预览
function closeImmersivePreview() {
  gsap.to('.immersive-preview', {
    opacity: 0,
    duration: 0.2,
    ease: 'power2.in',
    onComplete: () => {
      isImmersivePreview.value = false
      immersiveImageUrl.value = ''
    },
  })
}

// 图片加载完成
function handleImageLoad() {
  imageLoaded.value = true
  nextTick(() => {
    initCropper()
  })
}

// 图片加载失败
function handleImageError() {
  imageError.value = true
  imageLoaded.value = true
}

// 裁剪并下载
async function handleCropAndDownload() {
  if (!cropper.value || isProcessing.value)
    return

  isProcessing.value = true

  try {
    const options = {
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    }

    if (outputOriginal.value) {
      options.maxWidth = 16384
      options.maxHeight = 16384
    }
    else {
      options.maxWidth = 8192
      options.maxHeight = 8192
    }

    const canvas = cropper.value.getCroppedCanvas(options)

    if (!canvas) {
      throw new Error('裁剪失败')
    }

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b)
            resolve(b)
          else reject(new Error('转换失败'))
        },
        'image/jpeg', // 使用 JPEG 格式，压缩效果更好
        0.92, // 质量 92%，平衡质量与文件大小
      )
    })

    // 追踪裁剪完成
    trackImageCrop('complete', {
      aspect_ratio: selectedRatio.value,
      output_size: `${cropInfo.value.width}x${cropInfo.value.height}`,
    })
    isCropCompleted.value = true // 标记为完成

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const baseName = props.filename.replace(/\.[^.]+$/, '')
    link.href = url
    link.download = `${baseName}_${cropInfo.value.width}x${cropInfo.value.height}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setTimeout(() => handleClose(), 300)
  }
  catch (error) {
    console.error('裁剪下载失败:', error)
  }
  finally {
    isProcessing.value = false
  }
}

// 关闭弹窗
function handleClose() {
  // 如果不是裁剪完成后关闭，则追踪取消事件
  if (!isCropCompleted.value && imageLoaded.value) {
    trackImageCrop('cancel')
  }
  animateOut(() => {
    emit('close')
  })
}

// 入场动画
function animateIn() {
  if (!modalRef.value || !contentRef.value)
    return

  const tl = gsap.timeline()

  tl.fromTo(modalRef.value, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' })

  tl.fromTo(contentRef.value, { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.2)' }, '-=0.15')
}

// 出场动画
function animateOut(callback) {
  if (!modalRef.value || !contentRef.value) {
    callback?.()
    return
  }

  const tl = gsap.timeline({ onComplete: callback })

  tl.to(contentRef.value, {
    scale: 0.95,
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
  })

  tl.to(modalRef.value, {
    opacity: 0,
    duration: 0.2,
  }, '-=0.1')
}

// 监听打开状态
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    // 追踪裁剪弹窗打开
    trackImageCrop('open', { filename: props.filename })

    imageLoaded.value = false
    imageError.value = false
    isCropCompleted.value = false // 重置完成标记
    selectedRatio.value = 'auto'
    zoomLevel.value = 1
    initialZoomRatio.value = 1 // 重置初始缩放比例
    outputOriginal.value = false
    showCustomInput.value = false
    customWidth.value = ''
    customHeight.value = ''
    await nextTick()
    animateIn()
  }
  else {
    destroyCropper()
    if (previewUpdateTimer.value) {
      clearTimeout(previewUpdateTimer.value)
    }
  }
})

// 键盘事件
function handleKeydown(e) {
  if (!props.isOpen)
    return

  if (isImmersivePreview.value) {
    if (e.key === 'Escape' || e.key === ' ') {
      e.preventDefault()
      closeImmersivePreview()
    }
    return
  }

  if (e.key === 'Escape') {
    handleClose()
  }
  else if (e.key === 'Enter' && !isProcessing.value) {
    handleCropAndDownload()
  }
  else if (e.key === '+' || e.key === '=') {
    handleZoom('in')
  }
  else if (e.key === '-') {
    handleZoom('out')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  destroyCropper()
  // 清理预览更新定时器
  if (previewUpdateTimer.value) {
    clearTimeout(previewUpdateTimer.value)
    previewUpdateTimer.value = null
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="crop-modal">
      <div v-if="isOpen" ref="modalRef" class="crop-modal-overlay" @click.self="handleClose">
        <div ref="contentRef" class="crop-modal-content">
          <!-- Header -->
          <div class="crop-header">
            <button class="back-btn" @click="handleClose">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>返回</span>
            </button>
            <h2 class="crop-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 2v4M6 14v8M18 2v4M18 14v8M2 6h4M14 6h8M2 18h4M14 18h8" />
              </svg>
              智能裁剪
            </h2>
            <button class="close-btn" @click="handleClose">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Main Content -->
          <div class="crop-main">
            <!-- 左侧：裁剪区域 + 实时预览 -->
            <div class="crop-left">
              <!-- 裁剪区域 -->
              <div class="crop-area">
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
                  ref="imageRef"
                  :src="imageUrl"
                  class="crop-image"
                  crossorigin="anonymous"
                  @load="handleImageLoad"
                  @error="handleImageError"
                >
              </div>

              <!-- 实时预览区域 -->
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
                      @click="showImmersivePreview"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                      </svg>
                      <span>全屏预览</span>
                    </button>
                  </div>
                </div>
                <div class="preview-canvas-wrapper">
                  <canvas ref="previewCanvasRef" class="preview-canvas" />
                </div>
              </div>
            </div>

            <!-- 右侧：控制面板 -->
            <div class="crop-panel">
              <!-- 比例预设 -->
              <div class="panel-section">
                <h3 class="section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                  比例预设
                </h3>
                <div class="ratio-grid">
                  <button
                    v-for="preset in ratioPresets"
                    :key="preset.id"
                    class="ratio-btn"
                    :class="{
                      'ratio-btn--active': selectedRatio === preset.id,
                      'ratio-btn--highlight': preset.highlight,
                    }"
                    @click="selectRatio(preset.id)"
                  >
                    <span class="ratio-name">{{ preset.name }}</span>
                    <span class="ratio-desc">{{ preset.description }}</span>
                  </button>
                </div>

                <!-- 自定义分辨率 -->
                <button
                  class="custom-toggle"
                  :class="{ 'custom-toggle--active': showCustomInput }"
                  @click="showCustomInput = !showCustomInput"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span>自定义比例</span>
                </button>

                <Transition name="slide-fade">
                  <div v-if="showCustomInput" class="custom-input-card">
                    <div class="custom-inputs">
                      <input
                        v-model="customWidth"
                        type="number"
                        placeholder="宽"
                        min="1"
                        @keyup.enter="applyCustomResolution"
                      >
                      <span class="input-divider">:</span>
                      <input
                        v-model="customHeight"
                        type="number"
                        placeholder="高"
                        min="1"
                        @keyup.enter="applyCustomResolution"
                      >
                      <button class="apply-btn" @click="applyCustomResolution">
                        应用
                      </button>
                    </div>
                  </div>
                </Transition>
              </div>

              <!-- 缩放控制 -->
              <div class="panel-section panel-section--tools">
                <h3 class="section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  缩放
                </h3>
                <div class="zoom-controls">
                  <button class="zoom-btn" title="缩小 (-)" @click="handleZoom('out')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35M8 11h6" />
                    </svg>
                  </button>
                  <div class="zoom-slider">
                    <div class="zoom-track">
                      <div class="zoom-fill" :style="{ width: `${Math.min(zoomLevel * 50, 100)}%` }" />
                    </div>
                    <span class="zoom-value">{{ Math.round(zoomLevel * 100) }}%</span>
                  </div>
                  <button class="zoom-btn" title="放大 (+)" @click="handleZoom('in')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
                    </svg>
                  </button>
                  <button class="zoom-reset-btn" @click="resetZoom">
                    重置
                  </button>
                </div>
              </div>

              <!-- 输出选项 -->
              <div class="panel-section panel-section--output">
                <h3 class="section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  输出选项
                </h3>
                <label class="option-toggle">
                  <input v-model="outputOriginal" type="checkbox">
                  <span class="toggle-track">
                    <span class="toggle-thumb" />
                  </span>
                  <span class="toggle-label">
                    <span class="label-text">原图质量</span>
                    <span class="label-hint">不压缩，文件更大</span>
                  </span>
                </label>
              </div>

              <!-- 尺寸信息 -->
              <div class="panel-section panel-section--info">
                <div class="size-info">
                  <div class="size-row">
                    <span class="size-label">裁剪尺寸</span>
                    <span class="size-value highlight">{{ cropInfo.width || '—' }} × {{ cropInfo.height || '—' }}</span>
                  </div>
                  <div v-if="originalResolution" class="size-row">
                    <span class="size-label">原图尺寸</span>
                    <span class="size-value">{{ originalResolution.width }} × {{ originalResolution.height }}</span>
                  </div>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="panel-actions">
                <button class="action-btn action-btn--secondary" @click="handleClose">
                  取消
                </button>
                <button
                  class="action-btn action-btn--primary"
                  :disabled="!imageLoaded || imageError || isProcessing"
                  @click="handleCropAndDownload"
                >
                  <LoadingSpinner v-if="isProcessing" size="sm" />
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  <span>{{ isProcessing ? '处理中...' : '裁剪下载' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 沉浸式预览 -->
        <Transition name="fade">
          <div v-if="isImmersivePreview" class="immersive-preview" @click="closeImmersivePreview">
            <img :src="immersiveImageUrl" class="immersive-image" alt="预览">
            <div class="immersive-hint">
              点击任意处关闭 / 按 ESC 退出
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
// 过渡动画
.crop-modal-enter-active,
.crop-modal-leave-active {
  transition: opacity 0.3s ease;
}

.crop-modal-enter-from,
.crop-modal-leave-to {
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.2s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.15s ease-in;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-8px);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.crop-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(20px);
}

.crop-modal-content {
  display: flex;
  flex-direction: column;
  width: 95vw;
  max-width: 1400px;
  height: 92vh;
  max-height: 900px;
  background: var(--color-bg-card);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

// Header
.crop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--color-text-secondary);
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-hover);
  }

  svg {
    width: 16px;
    height: 16px;
  }
}

.crop-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);

  svg {
    width: 20px;
    height: 20px;
    color: var(--color-accent);
  }
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--color-text-secondary);
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  svg {
    width: 18px;
    height: 18px;
  }
}

// Main
.crop-main {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

// 左侧区域
.crop-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #0a0a0a;
}

// Crop Area
.crop-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  min-height: 300px;
  will-change: contents; // 提示浏览器优化渲染
}

.crop-loading,
.crop-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--color-text-muted);

  p {
    font-size: 13px;
    margin: 0;
  }

  .loading-hint {
    font-size: 11px;
    opacity: 0.6;
  }

  svg {
    width: 48px;
    height: 48px;
  }
}

.crop-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
}

// 预览区域
.preview-section {
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #0f0f0f;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.preview-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;

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
  font-weight: 600;
  color: var(--color-accent);
  font-family: 'SF Mono', Monaco, monospace;
}

.preview-fullscreen-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 11px;
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  transition: all 0.2s ease;

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover:not(:disabled) {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.1);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.preview-canvas-wrapper {
  padding: 12px 16px 16px;
}

.preview-canvas {
  width: 100%;
  height: 180px;
  border-radius: 8px;
  background: #0a0a0a;
}

// Panel
.crop-panel {
  width: 280px;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border-left: 1px solid var(--color-border);
  overflow-y: auto;
  flex-shrink: 0;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;
  }
}

.panel-section {
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;

  &--tools {
    padding: 12px 16px;
  }

  &--output {
    padding: 12px 16px;
  }

  &--info {
    padding: 12px 16px;
    border-bottom: none;
    flex: 1;
  }
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  svg {
    width: 14px;
    height: 14px;
    color: var(--color-accent);
  }
}

// Ratio Grid
.ratio-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 5px;
}

.ratio-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 7px 9px;
  background: var(--color-bg-hover);
  border-radius: 6px;
  text-align: left;
  transition: all 0.15s ease;
  border: 1.5px solid transparent;

  &:hover {
    background: var(--color-bg-primary);
    border-color: var(--color-border);
  }

  &--active {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--color-accent);

    .ratio-name {
      color: var(--color-accent);
    }
  }

  &--highlight {
    grid-column: span 2;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%);
    padding: 9px 11px;

    &.ratio-btn--active {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
    }

    .ratio-desc {
      color: var(--color-accent);
      font-weight: 500;
    }
  }
}

.ratio-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.ratio-desc {
  font-size: 9px;
  color: var(--color-text-muted);
}

// Custom Input
.custom-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 10px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-bg-hover);
  border-radius: 6px;
  transition: all 0.2s ease;

  svg {
    width: 12px;
    height: 12px;
    transition: transform 0.2s ease;
  }

  &:hover {
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  &--active {
    color: var(--color-accent);

    svg {
      transform: rotate(45deg);
    }
  }
}

.custom-input-card {
  margin-top: 8px;
  padding: 8px;
  background: var(--color-bg-primary);
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.custom-inputs {
  display: flex;
  align-items: center;
  gap: 6px;

  input {
    width: 50px;
    padding: 5px 8px;
    font-size: 12px;
    color: var(--color-text-primary);
    background: var(--color-bg-hover);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    outline: none;
    text-align: center;

    &:focus {
      border-color: var(--color-accent);
    }

    &::placeholder {
      color: var(--color-text-muted);
    }
  }
}

.input-divider {
  color: var(--color-text-muted);
  font-weight: 600;
}

.apply-btn {
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  background: var(--color-accent);
  border-radius: 4px;
  margin-left: auto;

  &:hover {
    background: var(--color-accent-hover);
  }
}

// Zoom Controls
.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: var(--color-text-secondary);
  background: var(--color-bg-hover);
  border-radius: 6px;
  transition: all 0.15s ease;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
  }

  &:active {
    transform: scale(0.95);
  }
}

.zoom-slider {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-track {
  flex: 1;
  height: 4px;
  background: var(--color-bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.zoom-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 0.15s ease;
}

.zoom-value {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-primary);
  font-family: 'SF Mono', Monaco, monospace;
  min-width: 36px;
  text-align: right;
}

.zoom-reset-btn {
  padding: 5px 8px;
  font-size: 10px;
  color: var(--color-accent);
  background: rgba(99, 102, 241, 0.1);
  border-radius: 4px;

  &:hover {
    background: rgba(99, 102, 241, 0.2);
  }
}

// Output Option
.option-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;

  input {
    display: none;

    &:checked + .toggle-track {
      background: var(--color-accent);

      .toggle-thumb {
        transform: translateX(16px);
      }
    }
  }
}

.toggle-track {
  position: relative;
  width: 36px;
  height: 20px;
  background: var(--color-bg-hover);
  border-radius: 10px;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-label {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.label-text {
  font-size: 12px;
  color: var(--color-text-primary);
}

.label-hint {
  font-size: 10px;
  color: var(--color-text-muted);
}

// Size Info
.size-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.size-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--color-bg-hover);
  border-radius: 6px;
}

.size-label {
  font-size: 11px;
  color: var(--color-text-muted);
}

.size-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
  font-family: 'SF Mono', Monaco, monospace;

  &.highlight {
    color: var(--color-accent);
  }
}

// Actions
.panel-actions {
  display: flex;
  gap: 8px;
  padding: 14px 16px;
  background: var(--color-bg-primary);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.2s ease;

  svg {
    width: 16px;
    height: 16px;
  }

  &--secondary {
    flex: 0.35;
    color: var(--color-text-secondary);
    background: var(--color-bg-hover);

    &:hover {
      background: var(--color-bg-primary);
      color: var(--color-text-primary);
    }
  }

  &--primary {
    flex: 0.65;
    color: white;
    background: linear-gradient(135deg, var(--color-accent) 0%, #8b5cf6 100%);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);

    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  }
}

// Immersive Preview
.immersive-preview {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.98);
  cursor: pointer;
}

.immersive-image {
  max-width: 95vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}

.immersive-hint {
  margin-top: 20px;
  padding: 10px 20px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.08);
  border-radius: 20px;
}

// Cropper Styles
:deep(.cropper-container) {
  width: 100% !important;
  height: 100% !important;
}

:deep(.cropper-view-box) {
  outline: 2px solid var(--color-accent);
  outline-color: rgba(99, 102, 241, 0.9);
}

:deep(.cropper-line) {
  background-color: var(--color-accent);
}

:deep(.cropper-point) {
  width: 10px;
  height: 10px;
  background-color: var(--color-accent);
  border-radius: 50%;
  opacity: 1;
}

:deep(.cropper-point.point-se) {
  width: 14px;
  height: 14px;
}

:deep(.cropper-dashed) {
  border-color: rgba(255, 255, 255, 0.4);
}

:deep(.cropper-modal) {
  background-color: rgba(0, 0, 0, 0.6);
}

:deep(.cropper-face) {
  background-color: transparent;
}
</style>
