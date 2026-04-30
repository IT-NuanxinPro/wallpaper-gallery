<script setup>
import { computed, ref, watch } from 'vue'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import WallpaperCardActions from '@/components/wallpaper/card/shared/WallpaperCardActions.vue'
import { useScrollLock } from '@/composables/useScrollLock'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { usePopularityStore } from '@/stores/popularity'
import { trackWallpaperDownload, trackWallpaperPreview } from '@/utils/common/analytics'
import { buildProxyImageUrl, buildRawImageUrl, buildWallpaperDownloadFilename, downloadFile, formatDate, formatFileSize, getDisplayFilename, getFileExtension, getResolutionLabel } from '@/utils/common/format'
import { recordDownload, recordView } from '@/utils/integrations/supabase'
import { resolveWallpaperSeries } from '@/utils/wallpaper/identity'
import { useDeviceMode } from '../composables/useDeviceMode'
import DeviceMode from '../shared/DeviceMode.vue'

const props = defineProps({
  wallpaper: { type: Object, default: null },
  isOpen: { type: Boolean, default: false },
  liked: { type: Boolean, default: false },
  collected: { type: Boolean, default: false },
  isAuthenticated: { type: Boolean, default: false },
  likeCount: { type: Number, default: 0 },
  collectCount: { type: Number, default: 0 },
})

const emit = defineEmits(['close', 'toggleLike', 'toggleCollect'])

const { currentSeries } = useWallpaperType()
const effectiveSeries = computed(() => resolveWallpaperSeries(props.wallpaper, currentSeries.value))
const deviceMode = useDeviceMode()
const scrollLock = useScrollLock()
const popularityStore = usePopularityStore()

const isVisible = ref(false)
const imageLoaded = ref(false)
const downloading = ref(false)
const imageDimensions = ref({ width: 0, height: 0 })
const fallbackStage = ref('none')

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

const displayImageUrl = computed(() => {
  if (!props.wallpaper?.url)
    return ''

  if (fallbackStage.value === 'raw')
    return buildRawImageUrl(props.wallpaper.url)
  if (fallbackStage.value === 'proxy')
    return buildProxyImageUrl(props.wallpaper.url)

  return props.wallpaper.url
})

// 计算属性 - 优先使用 AI 生成的 displayTitle
const displayFilename = computed(() => {
  if (!props.wallpaper)
    return ''

  // 优先使用 AI 生成的显示标题
  if (props.wallpaper.displayTitle) {
    // 去除常见的图片格式后缀名
    return props.wallpaper.displayTitle.replace(/\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|tif|ico|heic|heif)$/i, '')
  }

  // 回退到处理过的文件名
  return getDisplayFilename(props.wallpaper.filename)
})

// AI 标签（显示前3个关键词）
const aiTags = computed(() => {
  if (!props.wallpaper?.keywords || !Array.isArray(props.wallpaper.keywords)) {
    return []
  }
  return props.wallpaper.keywords.slice(0, 3)
})

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
const canUseDeviceMode = computed(() => effectiveSeries.value === 'mobile')

watch(() => props.isOpen, (open) => {
  if (open && props.wallpaper) {
    openModal()
  }
  else if (!open && isVisible.value) {
    closeModal()
  }
}, { immediate: true })

watch(() => props.wallpaper, () => {
  resetState()
  // 统计数据现在是 computed，从 popularityStore 自动获取
})

function openModal() {
  trackWallpaperPreview(props.wallpaper)
  recordView(props.wallpaper, effectiveSeries.value)
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
    await downloadFile(props.wallpaper.url, buildWallpaperDownloadFilename(props.wallpaper))
    trackWallpaperDownload(props.wallpaper, effectiveSeries.value)
    recordDownload(props.wallpaper, effectiveSeries.value)
  }
  finally {
    downloading.value = false
  }
}

function handleImageLoad(e) {
  imageLoaded.value = true
  imageDimensions.value = { width: e.target.naturalWidth, height: e.target.naturalHeight }
}

function handleImageError() {
  if (fallbackStage.value === 'none') {
    fallbackStage.value = 'raw'
    imageLoaded.value = false
    return
  }

  if (fallbackStage.value === 'raw') {
    fallbackStage.value = 'proxy'
    imageLoaded.value = false
  }
}

function resetState() {
  fallbackStage.value = 'none'
  imageLoaded.value = false
  imageDimensions.value = { width: 0, height: 0 }
  // 统计数据现在是 computed，无需手动重置
  if (deviceMode.isDeviceMode.value)
    deviceMode.reset()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" @after-leave="onAfterLeave">
      <div
        v-if="isVisible && wallpaper"
        class="mobile-modal"
        :class="{ 'is-device-mode': deviceMode.isDeviceMode.value }"
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
                :src="displayImageUrl"
                :alt="wallpaper.filename"
                :class="{ loaded: imageLoaded }"
                @load="handleImageLoad"
                @error="handleImageError"
              >
            </div>
          </Transition>

          <!-- 真机模式 -->
          <DeviceMode
            v-if="canUseDeviceMode"
            :visible="deviceMode.isDeviceMode.value"
            :image-src="displayImageUrl"
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
              <!-- AI 标签（显示前3个关键词） -->
              <span v-for="tag in aiTags" :key="tag" class="tag tag--ai">
                {{ tag }}
              </span>
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
              <span v-if="collectCount > 0" class="tag tag--collect">
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {{ collectCount }}
              </span>
              <span v-if="likeCount > 0" class="tag tag--like">
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="m12 21-1.45-1.32C5.4 15.03 2 11.95 2 8.5 2 5.42 4.42 3 7.5 3A5.3 5.3 0 0 1 12 5.09 5.3 5.3 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.45-3.4 6.53-8.55 11.18z" />
                </svg>
                {{ likeCount }}
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
              <WallpaperCardActions
                v-if="isAuthenticated"
                compact
                :show-counts="false"
                :liked="liked"
                :collected="collected"
                :like-count="likeCount"
                :collect-count="collectCount"
                :is-authenticated="isAuthenticated"
                @toggle-like="emit('toggleLike')"
                @toggle-collect="emit('toggleCollect')"
              />

              <button
                class="action-btn action-btn--primary"
                type="button"
                :disabled="downloading"
                @click="handleDownload"
              >
                <LoadingSpinner v-if="downloading" size="sm" />
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span>{{ downloading ? '下载中...' : '下载壁纸' }}</span>
              </button>

              <button
                v-if="canUseDeviceMode"
                class="action-btn action-btn--secondary action-btn--icon"
                :class="{ 'is-active': deviceMode.isDeviceMode.value }"
                type="button"
                aria-label="真机预览"
                title="真机预览"
                @click="deviceMode.toggle"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <path d="M12 18h.01" />
                </svg>
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
  --mobile-modal-overlay: linear-gradient(
    135deg,
    rgba(26, 26, 46, 0.98),
    rgba(22, 33, 62, 0.98),
    rgba(15, 52, 96, 0.98)
  );
  --mobile-modal-panel-bg: rgba(255, 255, 255, 0.05);
  --mobile-modal-panel-border: rgba(255, 255, 255, 0.1);
  --mobile-modal-panel-shadow: rgba(0, 0, 0, 0.4);
  --mobile-modal-close-bg: rgba(0, 0, 0, 0.4);
  --mobile-modal-close-border: rgba(255, 255, 255, 0.1);
  --mobile-modal-close-color: rgba(255, 255, 255, 0.9);
  --mobile-modal-preview-bg: rgba(0, 0, 0, 0.2);
  --mobile-modal-loading-bg: linear-gradient(135deg, rgba(26, 26, 46, 0.5), rgba(22, 33, 62, 0.5));
  --mobile-modal-info-bg: rgba(255, 255, 255, 0.03);
  --mobile-modal-info-border: rgba(255, 255, 255, 0.08);
  --mobile-modal-card-bg: rgba(255, 255, 255, 0.05);
  --mobile-modal-card-border: rgba(255, 255, 255, 0.08);
  --mobile-modal-title: #fff;
  --mobile-modal-text: #fff;
  --mobile-modal-muted: rgba(255, 255, 255, 0.5);
  --mobile-modal-muted-soft: rgba(255, 255, 255, 0.45);
  --mobile-modal-secondary-bg: rgba(255, 255, 255, 0.06);
  --mobile-modal-secondary-text: rgba(226, 232, 240, 0.82);
  --mobile-modal-secondary-border: rgba(148, 163, 184, 0.14);

  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  background: var(--mobile-modal-overlay);
  padding: 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;

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
    margin: 0 auto;
    background: var(--mobile-modal-panel-bg);
    border: 1px solid var(--mobile-modal-panel-border);
    border-radius: 24px;
    overflow: hidden;
    box-shadow:
      0 20px 40px var(--mobile-modal-panel-shadow),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
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
    background: var(--mobile-modal-close-bg);
    border: 1px solid var(--mobile-modal-close-border);
    border-radius: 50%;
    color: var(--mobile-modal-close-color);
    transition: all 0.2s ease;

    &:active {
      transform: scale(0.92);
    }

    svg {
      width: 18px;
      height: 18px;
    }
  }

  &__preview {
    position: relative;
    flex: 1 1 auto;
    min-height: 220px;
    max-height: 55vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--mobile-modal-preview-bg);
    overflow: hidden;
    transition: max-height 0.3s ease;

    .loading-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--mobile-modal-loading-bg);
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
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    background: var(--mobile-modal-info-bg);
    border-top: 1px solid var(--mobile-modal-info-border);
  }
}

.info-header {
  .info-title {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.3px;
    color: var(--mobile-modal-title);
    word-break: break-word;
  }

  .info-category {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 13px;
    color: var(--mobile-modal-muted);

    svg {
      width: 14px;
      height: 14px;
      color: var(--mobile-modal-muted-soft);
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
  backdrop-filter: blur(10px);

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

  &--info {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  &--danger {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  &--primary {
    background: rgba(37, 99, 235, 0.22);
    color: #93c5fd;
    border: 1px solid rgba(96, 165, 250, 0.22);
  }

  &--secondary {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(226, 232, 240, 0.82);
    border: 1px solid rgba(148, 163, 184, 0.14);
  }

  &--ai {
    background: linear-gradient(180deg, rgba(34, 47, 76, 0.94), rgba(23, 33, 56, 0.9));
    color: #dbeafe;
    border: 1px solid rgba(96, 165, 250, 0.2);
    box-shadow: inset 0 1px 0 rgba(191, 219, 254, 0.06);
    font-weight: 700;
    position: relative;

    &::before {
      content: '✨';
      margin-right: 4px;
      font-size: 10px;
    }
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

  &--collect {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);

    svg {
      width: 12px;
      height: 12px;
    }
  }

  &--like {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(244, 63, 94, 0.2);
    color: #fb7185;
    border: 1px solid rgba(244, 63, 94, 0.3);

    svg {
      width: 12px;
      height: 12px;
    }
  }
}

.info-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--mobile-modal-card-bg);
  border: 1px solid var(--mobile-modal-card-border);
  border-radius: 14px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;

  .detail-label {
    font-size: 13px;
    color: var(--mobile-modal-muted-soft);
  }

  .detail-value {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--mobile-modal-text);
    text-align: right;
    word-break: break-word;
  }
}

.info-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  :deep(.card-actions) {
    flex: 0 0 auto;
    flex-wrap: nowrap;
    gap: 8px;
  }

  :deep(.card-actions--compact .action-btn) {
    width: 42px;
    min-width: 42px;
    height: 42px;
    padding: 0;
    border-radius: 14px;
    overflow: visible;
  }

  :deep(.card-actions--compact .action-btn.has-count) {
    width: 42px;
    min-width: 42px;
    padding: 0;
  }

  :deep(.card-actions--compact .action-btn__count) {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    margin-left: 0;
    font-size: 10px;
    border: 1px solid rgba(15, 23, 42, 0.08);
  }

  :deep(.card-actions--compact .action-btn__lottie) {
    inset: -24px;
    transform: scale(1.68);
  }
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
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
    flex: 1 1 auto;
    min-width: 0;
    padding: 0 16px;
    background: var(--accent-gradient);
    color: white;
    border: none;
    box-shadow: 0 6px 20px var(--accent-shadow);

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &:disabled {
      opacity: 0.6;
    }
  }

  &--secondary {
    flex: 0 0 auto;
    background: var(--mobile-modal-secondary-bg);
    color: var(--mobile-modal-secondary-text);
    border: 1px solid var(--mobile-modal-secondary-border);

    &.is-active {
      background: var(--accent-gradient);
      color: white;
      border-color: transparent;
    }
  }

  &--icon {
    width: 42px;
    min-width: 42px;
    min-height: 42px;
    padding: 0;
    border-radius: 14px;
    flex-shrink: 0;
  }
}

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

@media (max-height: 700px) {
  .mobile-modal {
    padding: 12px;

    &__content {
      border-radius: 20px;
    }

    &__preview {
      min-height: 220px;
    }

    &__info {
      gap: 12px;
      padding: 14px;
      padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));
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
    font-size: 13px;
    border-radius: 12px;

    svg {
      width: 16px;
      height: 16px;
    }
  }

  .action-btn--primary {
    padding: 0 14px;
  }
}

@media (max-height: 570px) {
  .mobile-modal {
    padding: 8px;

    &__content {
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
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
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
    font-size: 12px;
    border-radius: 10px;

    svg {
      width: 14px;
      height: 14px;
    }
  }

  .action-btn--primary {
    padding: 0 12px;
  }
}

@media (max-width: 360px) {
  .mobile-modal {
    padding: 10px;

    &__info {
      padding: 12px;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
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
    font-size: 12px;
    gap: 6px;

    &--primary span {
      display: none;
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .action-btn--icon {
    width: 40px;
    min-width: 40px;
    min-height: 40px;
  }
}
</style>
