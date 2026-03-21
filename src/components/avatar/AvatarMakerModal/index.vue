<script setup>
/**
 * 头像自制弹窗主组件
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDevice } from '@/composables/useDevice'
import { useScrollLock } from '@/composables/useScrollLock'
import { useAvatarMakerWorkflow } from './composables/useAvatarMakerWorkflow'
import ControlPanel from './panel/ControlPanel.vue'
import PhonePreview from './preview/PhonePreview.vue'
import CropperArea from './shared/CropperArea.vue'
import ImageSourcePanel from './source/ImageSourcePanel.vue'

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
const isHorizontalLayout = computed(() => isDesktop.value)
const {
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
} = useAvatarMakerWorkflow()

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

function handleKeydown(e) {
  if (!isVisible.value)
    return
  if (e.key === 'Escape') {
    handleClose()
  }
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
  cleanupPendingImage()
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
