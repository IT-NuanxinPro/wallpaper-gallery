<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import { useScrollLock } from '@/composables/useScrollLock'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { usePopularityStore } from '@/stores/popularity'
import { trackWallpaperDownload, trackWallpaperPreview } from '@/utils/analytics'
import { downloadFile, formatDate, formatFileSize, getDisplayFilename, getFileExtension, getResolutionLabel } from '@/utils/format'
import { recordDownload, recordView } from '@/utils/supabase'
import { useDeviceMode } from './composables/useDeviceMode'
import DeviceMode from './DeviceMode.vue'

const props = defineProps({
  wallpaper: { type: Object, default: null },
  isOpen: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const { currentSeries } = useWallpaperType()
const deviceMode = useDeviceMode()
const scrollLock = useScrollLock()
const popularityStore = usePopularityStore()

const isVisible = ref(false)
const imageLoaded = ref(false)
const downloading = ref(false)
const imageDimensions = ref({ width: 0, height: 0 })

// 统计数据（从 popularityStore 获取，支持乐观更新）
const downloadCount = computed(() => {
  if (!props.wallpaper)
    return 0
  return popularityStore.getDownloadCount(props.wallpaper.filename)
})

const viewCount = computed(() => {
  if (!props.wallpaper)
    return 0
  return popularityStore.getViewCount(props.wallpaper.filename)
})

const displayFilename = computed(() => props.wallpaper ? getDisplayFilename(props.wallpaper.filename) : '')

const categoryDisplay = computed(() => {
  if (!props.wallpaper?.category)
    return ''
  const { category, subcategory } = props.wallpaper
  return subcategory ? `${category} / ${subcategory}` : category
})

const resolution = computed(() => {
  if (props.wallpaper?.resolution)
    return props.wallpaper.resolution
  if (imageDimensions.value.width > 0)
    return getResolutionLabel(imageDimensions.value.width, imageDimensions.value.height)
  return { label: '加载中', type: 'secondary' }
})

const fileExt = computed(() => props.wallpaper ? getFileExtension(props.wallpaper.filename).toUpperCase() : '')
const formattedSize = computed(() => props.wallpaper ? formatFileSize(props.wallpaper.size) : '')
const formattedDate = computed(() => props.wallpaper ? formatDate(props.wallpaper.createdAt) : '')
const canUseDeviceMode = computed(() => currentSeries.value === 'mobile')

watch(() => props.isOpen, (open) => {
  if (open && props.wallpaper) {
    openModal()
  }
  else if (!open && isVisible.value) {
    closeModal()
  }
})

watch(() => props.wallpaper, () => {
  resetState()
  // 统计数据现在是 computed，从 popularityStore 自动获取
})

function openModal() {
  trackWallpaperPreview(props.wallpaper)
  recordView(props.wallpaper, currentSeries.value)
  // 乐观更新本地统计（立即反映到 UI）
  popularityStore.incrementLocalView(props.wallpaper.filename)
  scrollLock.lock()
  isVisible.value = true
}

function closeModal() {
  if (deviceMode.isDeviceMode.value) {
    deviceMode.exit()
    return
  }
  isVisible.value = false
}

function onAfterLeave() {
  scrollLock.unlock()
  emit('close')
}

async function handleDownload() {
  if (!props.wallpaper || downloading.value)
    return
  downloading.value = true
  try {
    await downloadFile(props.wallpaper.url, props.wallpaper.filename)
    trackWallpaperDownload(props.wallpaper, currentSeries.value)
    recordDownload(props.wallpaper, currentSeries.value)
    // 乐观更新本地统计（立即反映到 UI）
    popularityStore.incrementLocalDownload(props.wallpaper.filename)
  }
  finally {
    downloading.value = false
  }
}

function handleImageLoad(e) {
  imageLoaded.value = true
  imageDimensions.value = { width: e.target.naturalWidth, height: e.target.naturalHeight }
}

function resetState() {
  imageLoaded.value = false
  imageDimensions.value = { width: 0, height: 0 }
  // 统计数据现在是 computed，无需手动重置
  if (deviceMode.isDeviceMode.value)
    deviceMode.reset()
}

function handleKeydown(e) {
  if (!isVisible.value)
    return
  if (e.key === 'Escape') {
    deviceMode.isDeviceMode.value ? deviceMode.exit() : closeModal()
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" @after-leave="onAfterLeave">
      <div
        v-if="isVisible && wallpaper"
        class="mobile-modal"
        :class="{ 'is-device-mode': deviceMode.isDeviceMode.value }"
        @click.self="closeModal"
      >
        <div
          class="mobile-modal__content"
          :class="{ 'is-device-mode': deviceMode.isDeviceMode.value }"
        >
          <!-- 关闭按钮 -->
          <Transition name="fade">
            <button
              v-if="!deviceMode.isDeviceMode.value"
              class="mobile-modal__close"
              aria-label="关闭"
              @click="closeModal"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </Transition>

          <!-- 图片预览 -->
          <Transition name="content-fade">
            <div v-show="!deviceMode.isDeviceMode.value" class="mobile-modal__preview">
              <div v-if="!imageLoaded" class="loading-placeholder">
                <LoadingSpinner size="lg" />
              </div>
              <img
                :src="wallpaper.url"
                :alt="wallpaper.filename"
                :class="{ loaded: imageLoaded }"
                @load="handleImageLoad"
              >
            </div>
          </Transition>

          <!-- 真机模式 -->
          <DeviceMode
            v-if="canUseDeviceMode"
            :visible="deviceMode.isDeviceMode.value"
            :image-src="wallpaper.url"
            :image-alt="wallpaper.filename"
            @exit="deviceMode.exit"
            @after-enter="deviceMode.onAnimationEnd"
            @after-leave="() => { deviceMode.onAnimationEnd(); if (!props.isOpen) isVisible = false }"
          />

          <!-- 底部信息 -->
          <div v-show="!deviceMode.isDeviceMode.value" class="mobile-modal__info">
            <div class="info-header">
              <h3 class="info-title">
                {{ displayFilename }}
              </h3>
              <p v-if="categoryDisplay" class="info-category">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                {{ categoryDisplay }}
              </p>
            </div>

            <div class="info-tags">
              <span class="tag" :class="[`tag--${resolution.type || 'success'}`]">
                {{ resolution.label }}
              </span>
              <span class="tag tag--secondary">{{ fileExt }}</span>
              <span v-if="viewCount > 0" class="tag tag--view">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {{ viewCount }}
              </span>
              <span v-if="downloadCount > 0" class="tag tag--download">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                {{ downloadCount }}
              </span>
            </div>

            <div class="info-details">
              <div class="detail-row">
                <span class="detail-label">文件大小</span>
                <span class="detail-value">{{ formattedSize }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">上传时间</span>
                <span class="detail-value">{{ formattedDate }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">分辨率</span>
                <span class="detail-value">{{ imageDimensions.width > 0 ? `${imageDimensions.width} × ${imageDimensions.height}` : '加载中...' }}</span>
              </div>
            </div>

            <div class="info-actions">
              <button
                v-if="canUseDeviceMode"
                class="action-btn action-btn--secondary"
                :class="{ 'is-active': deviceMode.isDeviceMode.value }"
                @click="deviceMode.toggle"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <path d="M12 18h.01" />
                </svg>
                <span>真机预览</span>
              </button>

              <button
                class="action-btn action-btn--primary"
                :disabled="downloading"
                @click="handleDownload"
              >
                <LoadingSpinner v-if="downloading" size="sm" />
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span>{{ downloading ? '下载中...' : '下载壁纸' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.mobile-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(26, 26, 46, 0.98), rgba(22, 33, 62, 0.98), rgba(15, 52, 96, 0.98));
  padding: 16px;

  &.is-device-mode {
    padding: 0;
    background: #fff;
  }

  &__content {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 400px;
    max-height: 90vh;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    overflow: hidden;
    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    // 平滑过渡，让尺寸变化丝滑
    transition:
      height 0.3s ease,
      max-height 0.3s ease;

    &.is-device-mode {
      width: 100vw;
      max-width: 100%;
      height: 100vh;
      max-height: 100vh;
      border-radius: 0;
      box-shadow: none;
      background: transparent;
      border: none;
    }
  }

  &__close {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.9);
    transition: all 0.2s ease;

    &:active {
      transform: scale(0.92);
      background: rgba(0, 0, 0, 0.6);
    }

    svg {
      width: 18px;
      height: 18px;
    }
  }

  &__preview {
    position: relative;
    flex: 1;
    min-height: 280px;
    max-height: 55vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.2);
    overflow: hidden;
    transition: max-height 0.3s ease;

    .loading-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(26, 26, 46, 0.5), rgba(22, 33, 62, 0.5));
      z-index: 1;
    }

    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      opacity: 0;
      transform: scale(0.95);
      transition:
        opacity 0.4s ease,
        transform 0.4s ease;
      &.loaded {
        opacity: 1;
        transform: scale(1);
      }
    }
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.03);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
}

.info-header {
  .info-title {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 8px;
    letter-spacing: -0.3px;
    word-break: break-all;
  }
  .info-category {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
    svg {
      width: 14px;
      height: 14px;
      color: rgba(255, 255, 255, 0.35);
    }
  }
}

.info-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 16px;

  &--success {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  &--warning {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
  &--secondary {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }
  &--view,
  &--download {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    svg {
      width: 12px;
      height: 12px;
    }
  }
  &--view {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  &--download {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
}

.info-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  .detail-label {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.45);
  }
  .detail-value {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }
}

.info-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
  svg {
    width: 18px;
    height: 18px;
  }
  &:active {
    transform: scale(0.96);
  }

  &--primary {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    &:disabled {
      opacity: 0.6;
    }
  }

  &--secondary {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.15);
    &.is-active {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border-color: transparent;
    }
  }
}

// 动画 - 进入时淡入，离开时直接消失（避免看到滚动）
.modal-enter-active {
  transition: opacity 0.3s ease;
}
.modal-leave-active {
  transition: none;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.content-fade-enter-active,
.content-fade-leave-active {
  transition: opacity 0.3s ease;
}
.content-fade-enter-from,
.content-fade-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// 小屏适配
@media (max-height: 700px) {
  .mobile-modal {
    padding: 12px;
    &__content {
      max-height: 95vh;
      border-radius: 20px;
    }
    &__preview {
      min-height: 220px;
    }
    &__info {
      gap: 12px;
      padding: 14px;
    }
  }
  .info-header .info-title {
    font-size: 16px;
    margin-bottom: 4px;
  }
  .info-header .info-category {
    font-size: 12px;
  }
  .info-tags {
    gap: 6px;
  }
  .tag {
    padding: 4px 10px;
    font-size: 11px;
  }
  .info-details {
    gap: 8px;
    padding: 12px;
  }
  .detail-row .detail-label,
  .detail-row .detail-value {
    font-size: 12px;
  }
  .info-actions {
    gap: 10px;
  }
  .action-btn {
    padding: 12px 14px;
    font-size: 13px;
    border-radius: 12px;
    svg {
      width: 16px;
      height: 16px;
    }
  }
}

@media (max-height: 570px) {
  .mobile-modal {
    padding: 8px;
    &__content {
      max-height: 98vh;
      border-radius: 16px;
    }
    &__close {
      width: 32px;
      height: 32px;
      top: 8px;
      right: 8px;
      svg {
        width: 16px;
        height: 16px;
      }
    }
    &__preview {
      min-height: 180px;
    }
    &__info {
      gap: 10px;
      padding: 12px;
    }
  }
  .info-header .info-title {
    font-size: 15px;
  }
  .info-details {
    padding: 10px;
    gap: 6px;
    border-radius: 10px;
  }
  .action-btn {
    padding: 10px 12px;
    font-size: 12px;
    border-radius: 10px;
    svg {
      width: 14px;
      height: 14px;
    }
  }
}

@media (max-width: 360px) {
  .mobile-modal {
    padding: 10px;
    &__info {
      padding: 12px;
    }
  }
  .info-header .info-title {
    font-size: 15px;
  }
  .tag {
    padding: 4px 8px;
    font-size: 11px;
  }
  .action-btn {
    padding: 12px 10px;
    font-size: 12px;
    gap: 6px;
    span {
      display: none;
    }
    svg {
      width: 20px;
      height: 20px;
    }
  }
}
</style>
