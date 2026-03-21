import { computed, ref } from 'vue'
import { AVATAR_OUTPUT_CONFIG, generateAvatarFilename } from '@/utils/avatar/maker'

const DEFAULT_AVATAR_SIZE = 450
const DEFAULT_AVATAR_RADIUS = 45

export function useAvatarMakerWorkflow() {
  const imageSource = ref(null)
  const sourceType = ref(null)
  const isLoading = ref(false)
  const error = ref(null)
  const avatarShape = ref('circle')
  const isDownloading = ref(false)
  const croppedPreview = ref(null)
  const cropperRef = ref(null)
  const pendingImage = ref(null)

  const avatarWidth = ref(DEFAULT_AVATAR_SIZE)
  const avatarHeight = ref(DEFAULT_AVATAR_SIZE)
  const avatarRadius = ref(DEFAULT_AVATAR_RADIUS)

  const hasImage = computed(() => !!imageSource.value)
  const canDownload = computed(() => hasImage.value && croppedPreview.value)
  const cropAspectRatio = computed(() => avatarWidth.value / avatarHeight.value)

  function cleanupPendingImage() {
    if (pendingImage.value) {
      pendingImage.value.onload = null
      pendingImage.value.onerror = null
      pendingImage.value = null
    }
  }

  function resetState() {
    imageSource.value = null
    sourceType.value = null
    isLoading.value = false
    error.value = null
    avatarShape.value = 'circle'
    isDownloading.value = false
    croppedPreview.value = null
    avatarWidth.value = DEFAULT_AVATAR_SIZE
    avatarHeight.value = DEFAULT_AVATAR_SIZE
    avatarRadius.value = DEFAULT_AVATAR_RADIUS
    cleanupPendingImage()
  }

  function handleFileSelect(file) {
    isLoading.value = true
    error.value = null
    sourceType.value = 'local'

    const reader = new FileReader()
    reader.onload = (e) => {
      imageSource.value = e.target.result
      isLoading.value = false
    }
    reader.onerror = () => {
      error.value = '文件读取失败，请重试'
      isLoading.value = false
      sourceType.value = null
    }
    reader.readAsDataURL(file)
  }

  function handleUrlSubmit(url) {
    isLoading.value = true
    error.value = null
    sourceType.value = 'url'

    cleanupPendingImage()

    const img = new Image()
    pendingImage.value = img
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageSource.value = url
      isLoading.value = false
      pendingImage.value = null
    }
    img.onerror = () => {
      error.value = '图片加载失败，请检查链接是否正确或尝试其他链接'
      isLoading.value = false
      sourceType.value = null
      pendingImage.value = null
    }
    img.src = url
  }

  function handleClearImage() {
    imageSource.value = null
    sourceType.value = null
    error.value = null
    croppedPreview.value = null
  }

  function handleCropChange() {
    if (!cropperRef.value)
      return

    const canvas = cropperRef.value.getCroppedCanvas({
      width: 200,
      height: Math.round(200 / cropAspectRatio.value),
    })

    if (canvas) {
      croppedPreview.value = canvas.toDataURL('image/png')
    }
  }

  function handleCropperImageLoaded() {
    isLoading.value = false
    error.value = null
  }

  function handleCropperImageError() {
    error.value = '图片加载失败，请重试'
    isLoading.value = false
  }

  function handleShapeChange(shape) {
    avatarShape.value = shape
  }

  async function handleDownload() {
    if (!cropperRef.value || isDownloading.value)
      return

    isDownloading.value = true
    error.value = null

    try {
      const outputWidth = avatarWidth.value
      const outputHeight = avatarHeight.value

      const croppedCanvas = cropperRef.value.getCroppedCanvas({
        width: outputWidth,
        height: outputHeight,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      })

      if (!croppedCanvas)
        throw new Error('无法获取裁剪区域')

      const outputCanvas = document.createElement('canvas')
      outputCanvas.width = outputWidth
      outputCanvas.height = outputHeight
      const ctx = outputCanvas.getContext('2d')

      if (!ctx)
        throw new Error('Canvas 上下文创建失败')

      applyShapeMask(ctx, avatarShape.value, outputWidth, outputHeight, avatarRadius.value)
      ctx.drawImage(croppedCanvas, 0, 0)

      const blob = await canvasToBlob(outputCanvas, 'image/png', AVATAR_OUTPUT_CONFIG.quality)
      if (!blob)
        throw new Error('图片导出失败')

      downloadBlob(blob, generateAvatarFilename(avatarShape.value))
    }
    catch (err) {
      console.error('头像下载失败:', err)
      error.value = err.message || '头像生成失败，请重试'
    }
    finally {
      isDownloading.value = false
    }
  }

  return {
    avatarHeight,
    avatarRadius,
    avatarShape,
    avatarWidth,
    canDownload,
    cleanupPendingImage,
    cropAspectRatio,
    croppedPreview,
    cropperRef,
    error,
    handleClearImage,
    handleCropChange,
    handleCropperImageError,
    handleCropperImageLoaded,
    handleDownload,
    handleFileSelect,
    handleShapeChange,
    handleUrlSubmit,
    hasImage,
    imageSource,
    isDownloading,
    isLoading,
    resetState,
    sourceType,
  }
}

function applyShapeMask(ctx, shape, width, height, avatarRadius) {
  ctx.beginPath()
  if (shape === 'circle') {
    const radius = Math.min(width, height) / 2
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2)
  }
  else {
    ctx.roundRect(0, 0, width, height, avatarRadius)
  }
  ctx.closePath()
  ctx.clip()
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(blob => resolve(blob), type, quality)
  })
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
