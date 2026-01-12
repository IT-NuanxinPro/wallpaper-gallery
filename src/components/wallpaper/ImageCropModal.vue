<script setup>
/**
 * 智能图片裁剪弹窗组件
 * 专为 PC 端电脑壁纸设计
 * 功能：多比例预设、自定义分辨率、缩放、沉浸预览、实时预览
 */
import Cropper from 'cropperjs'
import { gsap } from 'gsap'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import { trackImageCrop } from '@/utils/analytics'
import { buildRawImageUrl } from '@/utils/format'
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
const previewRAF = ref(null) // requestAnimationFrame ID
const actualImageUrl = ref('') // 实际使用的图片 URL（可能回退到 GitHub Raw）
const imageNaturalSize = ref({ width: 0, height: 0 }) // 图片原始尺寸

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

// 计算当前比例显示文本
const currentRatioDisplay = computed(() => {
  if (selectedRatio.value === 'free' || selectedRatio.value === 'custom') {
    // 自由比例时，计算实际比例
    if (cropInfo.value.width > 0 && cropInfo.value.height > 0) {
      const gcd = (a, b) => b === 0 ? a : gcd(b, a % b)
      const divisor = gcd(cropInfo.value.width, cropInfo.value.height)
      const ratioW = Math.round(cropInfo.value.width / divisor)
      const ratioH = Math.round(cropInfo.value.height / divisor)
      // 如果比例数字太大，简化显示
      if (ratioW > 100 || ratioH > 100) {
        const ratio = (cropInfo.value.width / cropInfo.value.height).toFixed(2)
        return ratio
      }
      return `${ratioW}:${ratioH}`
    }
    return '自由'
  }
  return currentPreset.value?.name || ''
})

// 处理大文件：使用 jsDelivr CDN，如果失败则回退到 GitHub Raw
const croppedImageUrl = computed(() => actualImageUrl.value || props.imageUrl)

// 初始化 Cropper
function initCropper() {
  if (!imageRef.value || cropper.value)
    return

  const preset = currentPreset.value
  const aspectRatio = Number.isNaN(preset.ratio) ? Number.NaN : preset.ratio

  cropper.value = new Cropper(imageRef.value, {
    aspectRatio,
    viewMode: 1, // viewMode 1: 限制裁剪框不超出图片
    dragMode: 'move',
    autoCropArea: 1, // 最大化初始裁剪区域
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
    background: false, // 关闭背景网格，更简洁
    responsive: true, // 响应式
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

// 节流更新预览 - 使用 requestAnimationFrame 实现丝滑更新
function debouncedUpdatePreview() {
  // 取消之前的 RAF
  if (previewRAF.value) {
    cancelAnimationFrame(previewRAF.value)
  }
  // 使用 RAF 确保在下一帧渲染
  previewRAF.value = requestAnimationFrame(() => {
    updatePreview()
  })
}

// 更新实时预览 - 高性能版本
function updatePreview() {
  if (!cropper.value || !previewCanvasRef.value)
    return

  try {
    // 提高预览分辨率，保证清晰度
    const previewCanvas = cropper.value.getCroppedCanvas({
      maxWidth: 1200,
      maxHeight: 800,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high', // 高质量
    })

    if (previewCanvas) {
      const ctx = previewCanvasRef.value.getContext('2d', { alpha: false })
      const containerWidth = previewCanvasRef.value.offsetWidth || 800
      const containerHeight = previewCanvasRef.value.offsetHeight || 220

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
      const dpr = Math.min(window.devicePixelRatio || 1, 2) // 限制最大 2x
      const canvasWidth = containerWidth * dpr
      const canvasHeight = containerHeight * dpr

      // 只在尺寸变化时重设 canvas
      if (previewCanvasRef.value.width !== canvasWidth || previewCanvasRef.value.height !== canvasHeight) {
        previewCanvasRef.value.width = canvasWidth
        previewCanvasRef.value.height = canvasHeight
        previewCanvasRef.value.style.width = `${containerWidth}px`
        previewCanvasRef.value.style.height = `${containerHeight}px`
      }

      // 清除并绘制
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#0a0a12'
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
  // 记录图片原始尺寸
  if (imageRef.value) {
    imageNaturalSize.value = {
      width: imageRef.value.naturalWidth,
      height: imageRef.value.naturalHeight,
    }
  }
  nextTick(() => {
    initCropper()
  })
}

// 图片加载失败
function handleImageError() {
  // 如果还没有尝试过回退，则回退到 GitHub Raw CDN
  if (!actualImageUrl.value && props.imageUrl) {
    console.warn('[ImageCropModal] 图片加载失败，尝试回退到 GitHub Raw CDN')
    actualImageUrl.value = buildRawImageUrl(props.imageUrl)
    imageError.value = false
    imageLoaded.value = false
    // 稍后重试加载
    return
  }

  // 如果已经回退过，则显示错误
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
    // 清理预览更新定时器
    if (previewUpdateTimer.value) {
      clearTimeout(previewUpdateTimer.value)
      previewUpdateTimer.value = null
    }
    // 清理 RAF
    if (previewRAF.value) {
      cancelAnimationFrame(previewRAF.value)
      previewRAF.value = null
    }
    // 清理沉浸式预览
    if (immersiveImageUrl.value) {
      immersiveImageUrl.value = ''
    }
    isImmersivePreview.value = false
    // 重置图片 URL
    actualImageUrl.value = ''
    imageNaturalSize.value = { width: 0, height: 0 }
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
  // 清理预览更新定时器和 RAF
  if (previewUpdateTimer.value) {
    clearTimeout(previewUpdateTimer.value)
    previewUpdateTimer.value = null
  }
  if (previewRAF.value) {
    cancelAnimationFrame(previewRAF.value)
    previewRAF.value = null
  }
  // 清理沉浸式预览
  if (immersiveImageUrl.value) {
    immersiveImageUrl.value = ''
  }
  // 重置状态
  actualImageUrl.value = ''
  imageNaturalSize.value = { width: 0, height: 0 }
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
            <div class="header-spacer" />
          </div>

          <!-- Main Content -->
          <div class="crop-main">
            <!-- 左侧：裁剪区域 + 实时预览 -->
            <div class="crop-left">
              <!-- 裁剪区域 -->
              <div class="crop-area">
                <!-- 实时尺寸标注 -->
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
                  ref="imageRef"
                  :src="croppedImageUrl"
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
                    <span class="label-text">超高分辨率</span>
                    <span class="label-hint">最大 16K，适合大屏显示器</span>
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
  background: linear-gradient(
    135deg,
    rgba(26, 26, 46, 0.95) 0%,
    rgba(22, 33, 62, 0.95) 50%,
    rgba(15, 52, 96, 0.95) 100%
  );
  backdrop-filter: blur(24px);
}

.crop-modal-content {
  display: flex;
  flex-direction: column;
  width: 1100px; // 固定宽度，更紧凑
  max-width: 94vw;
  height: 92vh;
  max-height: 900px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  overflow: hidden;
  box-shadow:
    0 25px 60px -12px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

// Header
.crop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateX(-2px);
  }

  svg {
    width: 14px;
    height: 14px;
  }
}

.crop-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  letter-spacing: -0.3px;

  svg {
    width: 18px;
    height: 18px;
    color: #667eea;
    filter: drop-shadow(0 0 6px rgba(102, 126, 234, 0.4));
  }
}

.header-spacer {
  width: 70px; // 与返回按钮宽度大致相同，保持标题居中
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
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%);
}

// Crop Area - 占据主要空间
.crop-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  min-height: 0;
  will-change: contents;
  padding: 8px; // 最小内边距，最大化裁剪区域
  background: rgba(0, 0, 0, 0.15);
}

// 实时尺寸标注
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

// 预览区域 - 更大的预览
.preview-section {
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.2);
  height: 260px; // 增大预览区域
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
  height: calc(100% - 30px); // 减去 header 高度
  box-sizing: border-box;
}

.preview-canvas {
  width: 100%;
  height: 100%; // 填满容器
  border-radius: 10px;
  background: #0a0a12; // 深色背景
  border: 1px solid rgba(255, 255, 255, 0.06);
}

// Panel
.crop-panel {
  width: 280px;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.05);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  overflow-y: auto;
  flex-shrink: 0;

  // 自定义滚动条 - 深色主题
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(102, 126, 234, 0.3);
    border-radius: 3px;

    &:hover {
      background: rgba(102, 126, 234, 0.5);
    }
  }
}

.panel-section {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
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
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;

  svg {
    width: 13px;
    height: 13px;
    color: #667eea;
  }
}

// Ratio Grid
.ratio-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.ratio-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
  }

  &--active {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
    border-color: rgba(102, 126, 234, 0.4);
    box-shadow: 0 0 12px rgba(102, 126, 234, 0.15);

    .ratio-name {
      color: #667eea;
    }

    .ratio-desc {
      color: rgba(102, 126, 234, 0.8);
    }
  }

  &--highlight {
    grid-column: span 2;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%);
    border-color: rgba(102, 126, 234, 0.2);
    padding: 10px 12px;

    &.ratio-btn--active {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
      border-color: rgba(102, 126, 234, 0.5);
    }

    .ratio-desc {
      color: #667eea;
      font-weight: 600;
    }
  }
}

.ratio-name {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.ratio-desc {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.4);
}

// Custom Input
.custom-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 10px;
  margin-top: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 12px;
    height: 12px;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.9);
    border-color: rgba(255, 255, 255, 0.1);
  }

  &--active {
    color: #667eea;
    border-color: rgba(102, 126, 234, 0.3);

    svg {
      transform: rotate(45deg);
    }
  }
}

.custom-input-card {
  margin-top: 8px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.custom-inputs {
  display: flex;
  align-items: center;
  gap: 6px;

  input {
    width: 50px;
    padding: 6px 8px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    outline: none;
    text-align: center;
    transition: all 0.2s ease;

    &:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.15);
    }

    &::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }
  }
}

.input-divider {
  color: rgba(255, 255, 255, 0.3);
  font-weight: 700;
  font-size: 12px;
}

.apply-btn {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 6px;
  margin-left: auto;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(102, 126, 234, 0.3);
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
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 15px;
    height: 15px;
  }

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
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
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.zoom-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 2px;
  transition: width 0.15s ease;
}

.zoom-value {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  font-family: 'SF Mono', Monaco, monospace;
  min-width: 38px;
  text-align: right;
}

.zoom-reset-btn {
  padding: 5px 8px;
  font-size: 10px;
  font-weight: 600;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 5px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(102, 126, 234, 0.2);
    border-color: rgba(102, 126, 234, 0.3);
  }
}

// Output Option
.option-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
  }

  input {
    display: none;

    &:checked + .toggle-track {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

      .toggle-thumb {
        transform: translateX(14px);
      }
    }
  }
}

.toggle-track {
  position: relative;
  width: 34px;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  transition: background 0.25s ease;
  flex-shrink: 0;
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  transition: transform 0.25s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-label {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.label-text {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.label-hint {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
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
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.size-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.size-value {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  font-family: 'SF Mono', Monaco, monospace;

  &.highlight {
    color: #667eea;
  }
}

// Actions
.panel-actions {
  display: flex;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 10px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 18px;
    height: 18px;
  }

  &--primary {
    flex: 1;
    color: white;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.35);

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.45);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.45;
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
  border-radius: 12px;
  box-shadow:
    0 30px 60px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05);
}

.immersive-hint {
  margin-top: 24px;
  padding: 12px 24px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
}

// Cropper Styles
:deep(.cropper-container) {
  width: 100% !important;
  height: 100% !important;
  background: transparent !important;
}

:deep(.cropper-wrap-box),
:deep(.cropper-canvas),
:deep(.cropper-drag-box),
:deep(.cropper-crop-box) {
  // 确保裁剪区域填满容器
}

:deep(.cropper-bg) {
  background-image: none !important; // 移除默认网格背景
}

:deep(.cropper-view-box) {
  outline: 2px solid #667eea;
  outline-offset: -1px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
}

:deep(.cropper-line) {
  background-color: #667eea;
  opacity: 0.8;
}

:deep(.cropper-point) {
  width: 12px;
  height: 12px;
  background-color: #667eea;
  border-radius: 50%;
  opacity: 1;
  box-shadow: 0 0 8px rgba(102, 126, 234, 0.5);
}

:deep(.cropper-point.point-se) {
  width: 16px;
  height: 16px;
}

:deep(.cropper-dashed) {
  border-color: rgba(255, 255, 255, 0.35);
}

:deep(.cropper-modal) {
  background-color: rgba(0, 0, 0, 0.5);
}

:deep(.cropper-face) {
  background-color: transparent;
}
</style>
