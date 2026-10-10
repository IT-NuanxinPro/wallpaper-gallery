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
import { trackImageCrop } from '@/utils/common/analytics'
import { buildRawImageUrl } from '@/utils/common/format'
import CropBatchExportSection from './shared/CropBatchExportSection.vue'
import CropImageStage from './shared/CropImageStage.vue'
import CropModalHeader from './shared/CropModalHeader.vue'
import CropOutputSection from './shared/CropOutputSection.vue'
import CropPreviewSection from './shared/CropPreviewSection.vue'
import CropRatioSection from './shared/CropRatioSection.vue'
import CropSizeInfoSection from './shared/CropSizeInfoSection.vue'
import CropZoomSection from './shared/CropZoomSection.vue'
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

const OUTPUT_FORMAT_CONFIG = {
  jpeg: {
    extension: 'jpg',
    label: 'JPG',
    mime: 'image/jpeg',
    supportsQuality: true,
  },
  png: {
    extension: 'png',
    label: 'PNG',
    mime: 'image/png',
    supportsQuality: false,
  },
  webp: {
    extension: 'webp',
    label: 'WebP',
    mime: 'image/webp',
    supportsQuality: true,
  },
}

// Refs
const modalRef = ref(null)
const contentRef = ref(null)
const imageStageRef = ref(null)
const previewSectionRef = ref(null)
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
const outputFormat = ref('jpeg')
const outputQuality = ref(92)
const exactOutputEnabled = ref(false)
const outputWidth = ref('')
const outputHeight = ref('')
const selectedBatchPresetIds = ref([])
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
const outputFormatInfo = computed(() => OUTPUT_FORMAT_CONFIG[outputFormat.value] || OUTPUT_FORMAT_CONFIG.jpeg)
const parsedOutputWidth = computed(() => parseDimensionValue(outputWidth.value))
const parsedOutputHeight = computed(() => parseDimensionValue(outputHeight.value))
const exactOutputValid = computed(() =>
  !exactOutputEnabled.value || (parsedOutputWidth.value > 0 && parsedOutputHeight.value > 0),
)
const currentAspectRatio = computed(() => {
  if (cropInfo.value.width > 0 && cropInfo.value.height > 0) {
    return cropInfo.value.width / cropInfo.value.height
  }

  if (imageNaturalSize.value.width > 0 && imageNaturalSize.value.height > 0) {
    return imageNaturalSize.value.width / imageNaturalSize.value.height
  }

  if (Number.isFinite(currentPreset.value?.ratio) && currentPreset.value.ratio > 0) {
    return currentPreset.value.ratio
  }

  return 16 / 9
})
const finalExportSize = computed(() => {
  if (exactOutputEnabled.value && exactOutputValid.value) {
    return {
      width: parsedOutputWidth.value,
      height: parsedOutputHeight.value,
    }
  }

  return {
    width: cropInfo.value.width || 0,
    height: cropInfo.value.height || 0,
  }
})
const exportQualityLabel = computed(() =>
  outputFormatInfo.value.supportsQuality ? `${outputQuality.value}%` : '无损',
)
const exportScaleHint = computed(() => {
  if (cropInfo.value.width <= 0 || cropInfo.value.height <= 0 || finalExportSize.value.width <= 0 || finalExportSize.value.height <= 0) {
    return ''
  }

  const scale = Math.max(
    finalExportSize.value.width / cropInfo.value.width,
    finalExportSize.value.height / cropInfo.value.height,
  )

  if (scale > 1.02) {
    return `当前单张导出会放大约 ${scale.toFixed(2)}x，更适合指定屏幕尺寸，但细节不会超过原图本身。`
  }

  if (scale < 0.98) {
    return `当前单张导出会缩小到约 ${Math.round(scale * 100)}%，更适合轻量下载和网页使用。`
  }

  return '当前单张导出会保持裁剪区域的原生尺寸。'
})
const canSingleExport = computed(() =>
  imageLoaded.value && !imageError.value && !isProcessing.value && Boolean(cropper.value) && exactOutputValid.value,
)
const rawBatchPresets = computed(() => {
  const ratio = currentAspectRatio.value
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return []
  }

  const cropWidth = cropInfo.value.width || 0
  const cropHeight = cropInfo.value.height || 0
  const presets = []

  if (cropWidth > 0 && cropHeight > 0) {
    presets.push(buildBatchPreset('native', cropWidth, cropHeight, ratio, true))
  }

  for (const width of getBatchPresetWidths(ratio)) {
    const height = normalizeEven(width / ratio)
    const id = `${width}x${height}`
    if (presets.some(preset => preset.id === id))
      continue
    presets.push(buildBatchPreset(id, width, height, ratio))
  }

  return presets
})
const recommendedBatchPresetIds = computed(() => {
  const cropWidth = cropInfo.value.width || 0
  const cropHeight = cropInfo.value.height || 0
  const nativeFriendlyIds = rawBatchPresets.value
    .filter((preset) => {
      if (preset.id === 'native')
        return true

      if (cropWidth <= 0 || cropHeight <= 0)
        return true

      return preset.width <= cropWidth && preset.height <= cropHeight
    })
    .map(preset => preset.id)

  const sourceIds = nativeFriendlyIds.length > 0
    ? nativeFriendlyIds
    : rawBatchPresets.value.map(preset => preset.id)

  return sourceIds.slice(0, 3)
})
const batchPresets = computed(() =>
  rawBatchPresets.value.map(preset => ({
    ...preset,
    recommended: recommendedBatchPresetIds.value.includes(preset.id),
  })),
)

watch(batchPresets, (presets) => {
  const validIds = new Set(presets.map(preset => preset.id))
  selectedBatchPresetIds.value = selectedBatchPresetIds.value.filter(id => validIds.has(id))
})

function getImageElement() {
  return imageStageRef.value?.getImageElement?.() || null
}

function getPreviewCanvasElement() {
  return previewSectionRef.value?.getCanvasElement?.() || null
}

function parseDimensionValue(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function normalizeEven(value) {
  const rounded = Math.max(1, Math.round(value))
  return rounded % 2 === 0 ? rounded : rounded + 1
}

function getBatchPresetWidths(ratio) {
  if (ratio > 2.05) {
    return [2560, 3440, 5120]
  }

  if (ratio < 0.85) {
    return [1080, 1440, 2160]
  }

  if (Math.abs(ratio - 1) < 0.08) {
    return [1080, 2048, 3072]
  }

  return [1920, 2560, 3840]
}

function getBatchPresetLabel(width, height, ratio) {
  const longSide = Math.max(width, height)

  if (ratio > 2.05) {
    if (width >= 5000)
      return '5K 带鱼'
    if (width >= 3400)
      return '3440 宽屏'
    return '宽屏'
  }

  if (Math.abs(ratio - 1) < 0.08) {
    if (width >= 3000)
      return '3K 方图'
    if (width >= 2000)
      return '2K 方图'
    return '1080 方图'
  }

  if (ratio < 0.85) {
    if (longSide >= 3800)
      return '4K 竖屏'
    if (longSide >= 2500)
      return '2K 竖屏'
    return '1080P 竖屏'
  }

  if (longSide >= 3800)
    return '4K'
  if (longSide >= 2500)
    return '2K'
  return '1080P'
}

function buildBatchPreset(id, width, height, ratio, isNative = false) {
  const cropWidth = cropInfo.value.width || width
  const cropHeight = cropInfo.value.height || height
  const scale = Math.max(width / cropWidth, height / cropHeight)

  let description = '适合当前比例的常用尺寸'
  if (isNative) {
    description = '当前选区原生尺寸'
  }
  else if (scale > 1.02) {
    description = `约放大 ${scale.toFixed(2)}x，适合目标设备尺寸`
  }
  else if (scale < 0.98) {
    description = '更轻量，适合网页或副屏'
  }

  return {
    description,
    height,
    id,
    label: isNative ? '当前裁剪' : getBatchPresetLabel(width, height, ratio),
    width,
  }
}

// 初始化 Cropper
function initCropper() {
  const imageElement = getImageElement()
  if (!imageElement || cropper.value)
    return

  const preset = currentPreset.value
  const aspectRatio = Number.isNaN(preset.ratio) ? Number.NaN : preset.ratio

  cropper.value = new Cropper(imageElement, {
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
  const previewCanvasElement = getPreviewCanvasElement()
  if (!cropper.value || !previewCanvasElement)
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
      const ctx = previewCanvasElement.getContext('2d', { alpha: false })
      const containerWidth = previewCanvasElement.offsetWidth || 800
      const containerHeight = previewCanvasElement.offsetHeight || 220

      // 计算缩放比例保持比例
      const scale = Math.min(
        containerWidth / previewCanvas.width,
        containerHeight / previewCanvas.height,
      )
      const drawWidth = previewCanvas.width * scale
      const drawHeight = previewCanvas.height * scale
      const offsetX = (containerWidth - drawWidth) / 2
      const offsetY = (containerHeight - drawHeight) / 2
      const coverScale = Math.max(
        containerWidth / previewCanvas.width,
        containerHeight / previewCanvas.height,
      )
      const coverWidth = previewCanvas.width * coverScale
      const coverHeight = previewCanvas.height * coverScale
      const coverOffsetX = (containerWidth - coverWidth) / 2
      const coverOffsetY = (containerHeight - coverHeight) / 2

      // 使用设备像素比提高清晰度
      const dpr = Math.min(window.devicePixelRatio || 1, 2) // 限制最大 2x
      const canvasWidth = containerWidth * dpr
      const canvasHeight = containerHeight * dpr

      // 只在尺寸变化时重设 canvas
      if (previewCanvasElement.width !== canvasWidth || previewCanvasElement.height !== canvasHeight) {
        previewCanvasElement.width = canvasWidth
        previewCanvasElement.height = canvasHeight
        previewCanvasElement.style.width = `${containerWidth}px`
        previewCanvasElement.style.height = `${containerHeight}px`
      }

      // 清除并绘制
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#0b1020'
      ctx.fillRect(0, 0, containerWidth, containerHeight)
      ctx.save()
      ctx.globalAlpha = 0.42
      ctx.filter = 'blur(26px) saturate(0.9)'
      ctx.drawImage(previewCanvas, coverOffsetX, coverOffsetY, coverWidth, coverHeight)
      ctx.restore()
      const gradient = ctx.createLinearGradient(0, 0, 0, containerHeight)
      gradient.addColorStop(0, 'rgba(8, 12, 24, 0.12)')
      gradient.addColorStop(1, 'rgba(8, 12, 24, 0.42)')
      ctx.fillStyle = gradient
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
  const imageElement = getImageElement()
  if (imageElement) {
    imageNaturalSize.value = {
      width: imageElement.naturalWidth,
      height: imageElement.naturalHeight,
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

function buildCanvasOptions(targetSize = null) {
  const options = {
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  }

  if (targetSize?.width > 0 && targetSize?.height > 0) {
    options.width = targetSize.width
    options.height = targetSize.height
    return options
  }

  if (exactOutputEnabled.value && exactOutputValid.value) {
    options.width = parsedOutputWidth.value
    options.height = parsedOutputHeight.value
    return options
  }

  options.maxWidth = 8192
  options.maxHeight = 8192

  return options
}

async function canvasToBlob(canvas) {
  const quality = outputFormatInfo.value.supportsQuality ? outputQuality.value / 100 : undefined

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob)
          resolve(blob)
        else reject(new Error('转换失败'))
      },
      outputFormatInfo.value.mime,
      quality,
    )
  })
}

async function createExportPayload(targetSize = null) {
  const canvas = cropper.value?.getCroppedCanvas(buildCanvasOptions(targetSize))

  if (!canvas) {
    throw new Error('裁剪失败')
  }

  const blob = await canvasToBlob(canvas)

  return {
    blob,
    height: canvas.height,
    width: canvas.width,
  }
}

function triggerDownload(blob, width, height) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const baseName = props.filename.replace(/\.[^.]+$/, '')

  link.href = url
  link.download = `${baseName}_${width}x${height}.${outputFormatInfo.value.extension}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function toggleBatchPreset(id) {
  if (selectedBatchPresetIds.value.includes(id)) {
    selectedBatchPresetIds.value = selectedBatchPresetIds.value.filter(item => item !== id)
    return
  }

  selectedBatchPresetIds.value = [...selectedBatchPresetIds.value, id]
}

function selectRecommendedBatchPresets() {
  selectedBatchPresetIds.value = [...recommendedBatchPresetIds.value]
}

function clearBatchPresets() {
  selectedBatchPresetIds.value = []
}

watch(
  [exactOutputEnabled, parsedOutputWidth, parsedOutputHeight, cropper],
  ([enabled, width, height, cropperInstance]) => {
    if (!enabled || width <= 0 || height <= 0 || !cropperInstance)
      return

    cropperInstance.setAspectRatio(width / height)
    selectedRatio.value = 'custom'
  },
)

// 裁剪并下载
async function handleCropAndDownload() {
  if (!cropper.value || isProcessing.value || !exactOutputValid.value)
    return

  isProcessing.value = true

  try {
    const payload = await createExportPayload()

    // 追踪裁剪完成
    trackImageCrop('complete', {
      aspect_ratio: selectedRatio.value,
      export_format: outputFormat.value,
      export_mode: exactOutputEnabled.value ? 'single_exact' : 'single',
      output_size: `${payload.width}x${payload.height}`,
    })
    isCropCompleted.value = true // 标记为完成

    triggerDownload(payload.blob, payload.width, payload.height)

    setTimeout(() => handleClose(), 300)
  }
  catch (error) {
    console.error('裁剪下载失败:', error)
  }
  finally {
    isProcessing.value = false
  }
}

async function handleBatchExport() {
  if (!cropper.value || isProcessing.value || selectedBatchPresetIds.value.length === 0)
    return

  const selectedPresets = batchPresets.value.filter(preset => selectedBatchPresetIds.value.includes(preset.id))
  if (selectedPresets.length === 0)
    return

  isProcessing.value = true

  try {
    for (const preset of selectedPresets) {
      const payload = await createExportPayload({
        width: preset.width,
        height: preset.height,
      })
      triggerDownload(payload.blob, payload.width, payload.height)
      await new Promise(resolve => setTimeout(resolve, 180))
    }

    trackImageCrop('complete', {
      aspect_ratio: selectedRatio.value,
      export_format: outputFormat.value,
      export_mode: 'batch',
      output_size: selectedPresets.map(preset => `${preset.width}x${preset.height}`).join(','),
      variant_count: selectedPresets.length,
    })
    isCropCompleted.value = true

    setTimeout(() => handleClose(), 400)
  }
  catch (error) {
    console.error('批量导出失败:', error)
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
    outputFormat.value = 'jpeg'
    outputQuality.value = 92
    exactOutputEnabled.value = false
    outputWidth.value = ''
    outputHeight.value = ''
    selectedBatchPresetIds.value = []
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
          <CropModalHeader @close="handleClose" />

          <!-- Main Content -->
          <div class="crop-main">
            <!-- 左侧：裁剪区域 + 实时预览 -->
            <div class="crop-left">
              <CropImageStage
                ref="imageStageRef"
                :crop-info="cropInfo"
                :current-ratio-display="currentRatioDisplay"
                :image-loaded="imageLoaded"
                :image-error="imageError"
                :image-url="croppedImageUrl"
                @load="handleImageLoad"
                @error="handleImageError"
              />

              <CropPreviewSection
                ref="previewSectionRef"
                :crop-info="cropInfo"
                :current-aspect-ratio="currentAspectRatio"
                :image-loaded="imageLoaded"
                :is-processing="isProcessing"
                @immersive-preview="showImmersivePreview"
              />
            </div>

            <!-- 右侧：控制面板 -->
            <div class="crop-panel">
              <CropRatioSection
                :ratio-presets="ratioPresets"
                :selected-ratio="selectedRatio"
                :show-custom-input="showCustomInput"
                :custom-width="customWidth"
                :custom-height="customHeight"
                @select-ratio="selectRatio"
                @toggle-custom="showCustomInput = !showCustomInput"
                @apply-custom="applyCustomResolution"
                @update:custom-width="customWidth = $event"
                @update:custom-height="customHeight = $event"
              />

              <CropZoomSection
                :zoom-level="zoomLevel"
                @zoom="handleZoom"
                @reset="resetZoom"
              />

              <CropOutputSection
                :exact-output-enabled="exactOutputEnabled"
                :exact-output-valid="exactOutputValid"
                :output-format="outputFormat"
                :output-quality="outputQuality"
                :output-width="outputWidth"
                :output-height="outputHeight"
                @update:exact-output-enabled="exactOutputEnabled = $event"
                @update:output-format="outputFormat = $event"
                @update:output-quality="outputQuality = $event"
                @update:output-width="outputWidth = $event"
                @update:output-height="outputHeight = $event"
              />

              <CropBatchExportSection
                :batch-presets="batchPresets"
                :selected-batch-preset-ids="selectedBatchPresetIds"
                :is-processing="isProcessing"
                @toggle-preset="toggleBatchPreset"
                @select-recommended="selectRecommendedBatchPresets"
                @clear-presets="clearBatchPresets"
                @batch-export="handleBatchExport"
              />

              <CropSizeInfoSection
                :crop-info="cropInfo"
                :export-format-label="outputFormatInfo.label"
                :export-quality-label="exportQualityLabel"
                :export-scale-hint="exportScaleHint"
                :final-export-size="finalExportSize"
                :original-resolution="originalResolution"
                :selected-batch-count="selectedBatchPresetIds.length"
              />

              <!-- 操作按钮 -->
              <div class="panel-actions">
                <button
                  class="action-btn action-btn--primary"
                  :disabled="!canSingleExport"
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
  // 裁剪弹窗固定使用深色视觉，不跟随全局亮色主题切换
  --color-accent: #6ea8ff;
  --color-accent-rgb: 110, 168, 255;
  --accent-gradient: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  --accent-gradient-hover: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
  --accent-gradient-soft:
    linear-gradient(180deg, rgba(30, 64, 175, 0.22), rgba(15, 23, 42, 0.18)),
    linear-gradient(135deg, rgba(96, 165, 250, 0.1), rgba(37, 99, 235, 0.04));
  --accent-gradient-soft-strong:
    linear-gradient(180deg, rgba(37, 99, 235, 0.28), rgba(15, 23, 42, 0.2)),
    linear-gradient(135deg, rgba(125, 177, 255, 0.14), rgba(37, 99, 235, 0.06));
  --accent-surface: rgba(59, 130, 246, 0.16);
  --accent-surface-strong: rgba(96, 165, 250, 0.24);
  --accent-border: rgba(96, 165, 250, 0.24);
  --accent-border-strong: rgba(147, 197, 253, 0.42);
  --accent-ring: rgba(96, 165, 250, 0.18);
  --accent-shadow: rgba(37, 99, 235, 0.28);
  --accent-shadow-strong: rgba(59, 130, 246, 0.36);
  --accent-contrast-soft: #dbeafe;
  --crop-panel-surface: linear-gradient(180deg, rgba(20, 30, 54, 0.9), rgba(11, 18, 35, 0.96));
  --crop-panel-surface-strong: linear-gradient(180deg, rgba(28, 41, 73, 0.94), rgba(14, 22, 41, 0.98));
  --crop-pill-surface: rgba(9, 16, 32, 0.82);
  --crop-pill-surface-strong: rgba(17, 28, 52, 0.92);
  --crop-pill-border: rgba(255, 255, 255, 0.08);
  --crop-pill-border-strong: rgba(255, 255, 255, 0.14);
  --crop-chip-surface: linear-gradient(180deg, rgba(28, 42, 76, 0.92), rgba(12, 20, 39, 0.98));
  --crop-chip-border: rgba(110, 168, 255, 0.2);
  --crop-text-muted: rgba(255, 255, 255, 0.45);
  --crop-text-soft: rgba(255, 255, 255, 0.62);
  // 输出格式与批量尺寸共用控件颜色，避免同一面板混入黑色卡片。
  --crop-control-surface: rgba(255, 255, 255, 0.03);
  --crop-control-surface-hover: rgba(255, 255, 255, 0.05);
  --crop-control-border: rgba(255, 255, 255, 0.06);
  --crop-control-border-hover: rgba(255, 255, 255, 0.1);
  --crop-control-text: rgba(255, 255, 255, 0.92);
  --crop-control-hint: rgba(255, 255, 255, 0.42);
  color-scheme: dark;
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
  width: min(1360px, 96vw);
  max-width: 96vw;
  height: min(94vh, 960px);
  max-height: 960px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  overflow: hidden;
  box-shadow:
    0 25px 60px -12px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

// Header
:deep(.crop-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

:deep(.back-btn) {
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

:deep(.crop-title) {
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
    color: var(--color-accent);
    filter: drop-shadow(0 0 6px var(--accent-shadow));
  }
}

:deep(.header-spacer) {
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

// Panel
.crop-panel {
  width: clamp(340px, 27vw, 390px);
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
    background: var(--accent-border);
    border-radius: 3px;

    &:hover {
      background: var(--accent-border-strong);
    }
  }
}

// Actions
.panel-actions {
  display: flex;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  position: sticky;
  bottom: 0;
  backdrop-filter: blur(18px);
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
    background: var(--accent-gradient);
    border: none;
    box-shadow: 0 4px 16px var(--accent-shadow);

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px var(--accent-shadow-strong);
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
  outline: 2px solid var(--color-accent);
  outline-offset: -1px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
}

:deep(.cropper-line) {
  background-color: var(--color-accent);
  opacity: 0.8;
}

:deep(.cropper-point) {
  width: 12px;
  height: 12px;
  background-color: var(--color-accent);
  border-radius: 50%;
  opacity: 1;
  box-shadow: 0 0 8px var(--accent-shadow-strong);
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
