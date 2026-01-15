<script setup>
/**
 * 头像自制弹窗主组件
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDevice } from '@/composables/useDevice'
import { useScrollLock } from '@/composables/useScrollLock'
import { AVATAR_OUTPUT_CONFIG, generateAvatarFilename } from '@/utils/avatar-maker'
import ControlPanel from './ControlPanel.vue'
import CropperArea from './CropperArea.vue'
import ImageSourcePanel from './ImageSourcePanel.vue'
import PhonePreview from './PhonePreview.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close'])

const { isDesktop } = useDevice()
const { lock: lockScroll, unlock: unlockScroll } = useScrollLock()

const isVisible = ref(false)
const imageSource = ref(null)
const sourceType = ref(null)
const isLoading = ref(false)
const error = ref(null)
const avatarShape = ref('circle')
const isDownloading = ref(false)
const croppedPreview = ref(null)
const cropperRef = ref(null)
const pendingImage = ref(null)

// 自定义尺寸
const avatarWidth = ref(450)
const avatarHeight = ref(450)
const avatarRadius = ref(45)

const hasImage = computed(() => !!imageSource.value)
const canDownload = computed(() => hasImage.value && croppedPreview.value)
const isHorizontalLayout = computed(() => isDesktop.value)
const cropAspectRatio = computed(() => avatarWidth.value / avatarHeight.value)

function handleOpen() {
  lockScroll()
  isVisible.value = true
}

function handleClose() {
  isVisible.value = false
}

function onModalAfterLeave() {
  unlockScroll()
  resetState()
  emit('close')
}

function handleOverlayClick(e) {
  if (e.target === e.currentTarget) {
    handleClose()
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
  avatarWidth.value = 450
  avatarHeight.value = 450
  avatarRadius.value = 45

  // 清理 pending image
  if (pendingImage.value) {
    pendingImage.value.onload = null
    pendingImage.value.onerror = null
    pendingImage.value = null
  }
}

function handleKeydown(e) {
  if (!isVisible.value)
    return
  if (e.key === 'Escape') {
    handleClose()
  }
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

  // 清理之前的 pending image
  if (pendingImage.value) {
    pendingImage.value.onload = null
    pendingImage.value.onerror = null
    pendingImage.value = null
  }

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
  if (cropperRef.value) {
    const canvas = cropperRef.value.getCroppedCanvas({
      width: 200,
      height: Math.round(200 / cropAspectRatio.value),
    })
    if (canvas) {
      croppedPreview.value = canvas.toDataURL('image/png')
    }
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

// 生成并下载头像
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

    applyShapeMask(ctx, avatarShape.value, outputWidth, outputHeight)
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

// 应用形状蒙版
function applyShapeMask(ctx, shape, width, height) {
  ctx.beginPath()
  if (shape === 'circle') {
    const radius = Math.min(width, height) / 2
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2)
  }
  else {
    const radius = avatarRadius.value
    ctx.roundRect(0, 0, width, height, radius)
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

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    handleOpen()
  }
  else if (isVisible.value) {
    handleClose()
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)

  // 清理 pending image
  if (pendingImage.value) {
    pendingImage.value.onload = null
    pendingImage.value.onerror = null
    pendingImage.value = null
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" @after-leave="onModalAfterLeave">
      <div
        v-if="isVisible"
        class="avatar-maker-modal"
        @click="handleOverlayClick"
      >
        <div
          class="avatar-maker-modal__content"
          :class="{ 'avatar-maker-modal__content--horizontal': isHorizontalLayout }"
        >
          <button class="avatar-maker-modal__close" aria-label="关闭" @click="handleClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <div class="avatar-maker-modal__main">
            <div v-if="!hasImage" class="avatar-maker-modal__source">
              <ImageSourcePanel
                :current-source="imageSource"
                :is-loading="isLoading"
                :error="error"
                @select-file="handleFileSelect"
                @submit-url="handleUrlSubmit"
                @clear="handleClearImage"
              />
            </div>

            <template v-else>
              <div class="avatar-maker-modal__cropper">
                <CropperArea
                  ref="cropperRef"
                  :image-source="imageSource"
                  :aspect-ratio="cropAspectRatio"
                  @crop-change="handleCropChange"
                  @image-loaded="handleCropperImageLoaded"
                  @image-error="handleCropperImageError"
                />
              </div>

              <div class="avatar-maker-modal__preview">
                <PhonePreview
                  :preview-image="croppedPreview"
                  :avatar-shape="avatarShape"
                  :avatar-radius="avatarRadius"
                  :is-loading="isLoading"
                />
              </div>
            </template>

            <div v-if="!hasImage" class="avatar-maker-modal__preview avatar-maker-modal__preview--placeholder">
              <PhonePreview :preview-image="null" :avatar-shape="avatarShape" :avatar-radius="avatarRadius" :is-loading="false" />
            </div>
          </div>

          <div class="avatar-maker-modal__panel">
            <ControlPanel
              v-model:avatar-width="avatarWidth"
              v-model:avatar-height="avatarHeight"
              v-model:avatar-radius="avatarRadius"
              :avatar-shape="avatarShape"
              :can-download="canDownload"
              :is-downloading="isDownloading"
              @shape-change="handleShapeChange"
              @download="handleDownload"
            />

            <button v-if="hasImage" class="avatar-maker-modal__reselect" @click="handleClearImage">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>重新选择图片</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.avatar-maker-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(26, 26, 46, 0.95) 0%,
    rgba(22, 33, 62, 0.95) 50%,
    rgba(15, 52, 96, 0.95) 100%
  );
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 20px;
}

.avatar-maker-modal__content {
  position: relative;
  display: flex;
  flex-direction: row;
  width: 100%;
  max-width: 1200px;
  min-height: 700px;
  max-height: 85vh;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  overflow: hidden;
  box-shadow:
    0 25px 50px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.avatar-maker-modal__close {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
    transform: rotate(90deg);
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

.avatar-maker-modal__main {
  flex: 1;
  display: flex;
  flex-direction: row;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.avatar-maker-modal__source {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 30px;
}

.avatar-maker-modal__cropper {
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  background: rgba(0, 0, 0, 0.2);
  min-height: 400px;
  overflow: hidden;
}

.avatar-maker-modal__preview {
  flex: 0 0 auto;
  width: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.2) 100%);
  border-left: 1px solid rgba(255, 255, 255, 0.06);
  padding: 24px;

  &--placeholder {
    opacity: 0.6;
  }
}

.avatar-maker-modal__panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 280px;
  min-width: 280px;
  padding: 32px 28px;
  background: rgba(255, 255, 255, 0.02);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.avatar-maker-modal__reselect {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  min-height: 44px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }
}

// 弹窗动画
.modal-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  .avatar-maker-modal__content {
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

.modal-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  .avatar-maker-modal__content {
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

.modal-enter-from {
  opacity: 0;
  .avatar-maker-modal__content {
    opacity: 0;
    transform: scale(0.9) translateY(30px);
  }
}

.modal-leave-to {
  opacity: 0;
  .avatar-maker-modal__content {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
  }
}
</style>
