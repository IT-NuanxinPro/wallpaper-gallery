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
const scrollLock = useScrollLock()
const popularityStore = usePopularityStore()

// 状态
const isVisible = ref(false)
const imageLoaded = ref(false)
const downloading = ref(false)
const imageDimensions = ref({ width: 0, height: 0 })
const isSquare = ref(false) // 头像形状：false=圆形，true=方形
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

const fileExt = computed(() =>
  props.wallpaper ? getFileExtension(props.wallpaper.filename).toUpperCase() : '',
)

const formattedSize = computed(() =>
  props.wallpaper ? formatFileSize(props.wallpaper.size) : '',
)

const formattedDate = computed(() =>
  props.wallpaper ? formatDate(props.wallpaper.createdAt) : '',
)

// 监听开关
watch(() => props.isOpen, (open) => {
  if (open && props.wallpaper) {
    openModal()
  }
  else if (!open && isVisible.value) {
    closeModal()
  }
}, { immediate: true })

// 监听壁纸变化
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
  imageDimensions.value = {
    width: e.target.naturalWidth,
    height: e.target.naturalHeight,
  }
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
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" @after-leave="onAfterLeave">
      <div
        v-if="isVisible && wallpaper"
        class="avatar-modal"
      >
        <div class="avatar-modal__content">
          <!-- 关闭按钮 -->
          <button class="avatar-modal__close" aria-label="关闭" @click="closeModal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <!-- 头像预览 -->
          <div class="avatar-modal__preview">
            <div class="avatar-frame" :class="{ 'is-square': isSquare }">
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
            <!-- 形状切换 -->
            <div class="shape-toggle">
              <button
                class="shape-btn"
                :class="{ active: !isSquare }"
                title="圆形"
                @click="isSquare = false"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </button>
              <button
                class="shape-btn"
                :class="{ active: isSquare }"
                title="方形"
                @click="isSquare = true"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 底部信息 -->
          <div class="avatar-modal__info">
            <div class="info-header">
              <h3 class="info-title">
                {{ displayFilename }}
              </h3>
              <p v-if="categoryDisplay" class="info-category">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                {{ categoryDisplay }}
              </p>
            </div>

            <div class="info-tags">
              <!-- AI 标签（显示前3个关键词） -->
              <span v-for="tag in aiTags" :key="tag" class="tag tag--ai">
                {{ tag }}
              </span>
              <span class="tag" :class="[`tag--${resolution.type || 'success'}`]">{{ resolution.label }}</span>
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
                <span class="detail-label">尺寸</span>
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
                :disabled="downloading"
                @click="handleDownload"
              >
                <LoadingSpinner v-if="downloading" size="sm" />
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span>{{ downloading ? '下载中...' : '下载头像' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.avatar-modal {
  --avatar-modal-overlay: linear-gradient(
    135deg,
    rgba(26, 26, 46, 0.98),
    rgba(22, 33, 62, 0.98),
    rgba(15, 52, 96, 0.98)
  );
  --avatar-modal-panel-bg: rgba(255, 255, 255, 0.05);
  --avatar-modal-panel-border: rgba(255, 255, 255, 0.1);
  --avatar-modal-panel-shadow: rgba(0, 0, 0, 0.4);
  --avatar-modal-close-bg: rgba(0, 0, 0, 0.4);
  --avatar-modal-close-border: rgba(255, 255, 255, 0.1);
  --avatar-modal-close-color: rgba(255, 255, 255, 0.9);
  --avatar-modal-preview-bg: rgba(0, 0, 0, 0.2);
  --avatar-modal-info-bg: rgba(255, 255, 255, 0.03);
  --avatar-modal-info-border: rgba(255, 255, 255, 0.08);
  --avatar-modal-card-bg: rgba(255, 255, 255, 0.05);
  --avatar-modal-card-border: rgba(255, 255, 255, 0.08);
  --avatar-modal-shape-bg: rgba(255, 255, 255, 0.08);
  --avatar-modal-shape-color: rgba(255, 255, 255, 0.5);
  --avatar-modal-title: #fff;
  --avatar-modal-text: #fff;
  --avatar-modal-muted: rgba(255, 255, 255, 0.5);
  --avatar-modal-muted-soft: rgba(255, 255, 255, 0.45);
  --avatar-modal-secondary-bg: rgba(255, 255, 255, 0.06);
  --avatar-modal-secondary-text: rgba(226, 232, 240, 0.82);
  --avatar-modal-secondary-border: rgba(148, 163, 184, 0.14);

  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--avatar-modal-overlay);
  padding: 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;

  &__content {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 360px;
    margin: 0 auto;
    background: var(--avatar-modal-panel-bg);
    border: 1px solid var(--avatar-modal-panel-border);
    border-radius: 24px;
    overflow: hidden;
    box-shadow:
      0 20px 40px var(--avatar-modal-panel-shadow),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
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
    background: var(--avatar-modal-close-bg);
    border: 1px solid var(--avatar-modal-close-border);
    border-radius: 50%;
    color: var(--avatar-modal-close-color);
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
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 32px 24px 20px;
    background: var(--avatar-modal-preview-bg);
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    background: var(--avatar-modal-info-bg);
    border-top: 1px solid var(--avatar-modal-info-border);
  }
}

.avatar-frame {
  position: relative;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  overflow: hidden;
  // background: var(--accent-gradient);
  padding: 4px;
  box-shadow:
    0 8px 32px var(--accent-shadow),
    0 0 0 1px rgba(255, 255, 255, 0.1);
  transition: border-radius 0.3s ease;

  .loading-placeholder {
    position: absolute;
    inset: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.16);
    border-radius: inherit;
    z-index: 1;
  }

  &.is-square {
    border-radius: 24px;

    img {
      border-radius: 20px;
    }

    .loading-placeholder {
      border-radius: 20px;
    }
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), transparent);
    pointer-events: none;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    opacity: 0;
    transform: scale(0.9);
    transition:
      opacity 0.4s ease,
      transform 0.4s ease,
      border-radius 0.3s ease;

    &.loaded {
      opacity: 1;
      transform: scale(1);
    }
  }
}

.shape-toggle {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: var(--avatar-modal-shape-bg);
  border-radius: 12px;
}

.shape-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 32px;
  border-radius: 8px;
  color: var(--avatar-modal-shape-color);
  transition: all 0.2s ease;

  svg {
    width: 18px;
    height: 18px;
  }

  &.active {
    background: var(--accent-gradient);
    color: white;
    box-shadow: 0 2px 8px var(--accent-shadow);
  }

  &:not(.active):active {
    background: rgba(148, 163, 184, 0.12);
  }
}

.info-header {
  .info-title {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 700;
    color: var(--avatar-modal-title);
    word-break: break-word;
  }

  .info-category {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 13px;
    color: var(--avatar-modal-muted);

    svg {
      width: 14px;
      height: 14px;
      color: var(--avatar-modal-muted-soft);
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
  background: var(--avatar-modal-card-bg);
  border: 1px solid var(--avatar-modal-card-border);
  border-radius: 14px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;

  .detail-label {
    font-size: 13px;
    color: var(--avatar-modal-muted-soft);
  }

  .detail-value {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--avatar-modal-text);
    text-align: right;
    word-break: break-word;
  }
}

.info-actions {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  gap: 12px;

  :deep(.card-actions) {
    flex-wrap: nowrap;
    gap: 8px;
    justify-self: start;
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
  flex: 1;
  width: 100%;
  min-height: 52px;
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
    grid-column: 2;
    background: var(--accent-gradient);
    color: white;
    border: none;
    box-shadow: 0 6px 20px var(--accent-shadow);

    &:disabled {
      opacity: 0.6;
    }
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

@media (max-height: 650px) {
  .avatar-modal {
    padding: 12px;

    &__content {
      border-radius: 20px;
    }

    &__preview {
      padding: 24px 16px 16px;
      gap: 12px;
    }

    &__info {
      gap: 12px;
      padding: 14px;
      padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));
    }
  }

  .avatar-frame {
    width: 150px;
    height: 150px;
  }

  .info-header .info-title {
    font-size: 16px;
    margin-bottom: 4px;
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

@media (max-width: 360px) {
  .avatar-modal {
    padding: 10px;

    &__info {
      padding: 12px;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    }

    &__preview {
      padding: 20px 12px 14px;
    }
  }

  .avatar-frame {
    width: 140px;
    height: 140px;

    &.is-square {
      border-radius: 20px;

      img {
        border-radius: 16px;
      }
    }
  }

  .info-header .info-title {
    font-size: 15px;
  }

  .tag {
    padding: 4px 8px;
    font-size: 11px;
  }

  .shape-btn {
    width: 36px;
    height: 28px;

    svg {
      width: 16px;
      height: 16px;
    }
  }
}
</style>
