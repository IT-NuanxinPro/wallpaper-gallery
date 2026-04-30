<script setup>
/**
 * PC端电脑壁纸弹窗 - 左右布局
 * 左侧：圆角大图预览
 * 右侧：壁纸信息和操作
 */
import { computed, ref, watch } from 'vue'

import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import WallpaperCardActions from '@/components/wallpaper/card/shared/WallpaperCardActions.vue'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { usePopularityStore } from '@/stores/popularity'
import { trackWallpaperDownload, trackWallpaperPreview } from '@/utils/common/analytics'
import { buildProxyImageUrl, buildRawImageUrl, buildWallpaperDownloadFilename, downloadFile, formatDate, formatFileSize, formatRelativeTime, getDisplayFilename, getFileExtension, getResolutionLabel } from '@/utils/common/format'
import { recordDownload, recordView } from '@/utils/integrations/supabase'
import { resolveWallpaperSeries } from '@/utils/wallpaper/identity'
import DesktopImageStage from './DesktopImageStage.vue'

const props = defineProps({
  wallpaper: {
    type: Object,
    default: null,
  },
  isOpen: {
    type: Boolean,
    default: false,
  },
  liked: {
    type: Boolean,
    default: false,
  },
  collected: {
    type: Boolean,
    default: false,
  },
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
  likeCount: {
    type: Number,
    default: 0,
  },
  collectCount: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['close', 'openCrop', 'toggleLike', 'toggleCollect'])

const { currentSeries } = useWallpaperType()
const effectiveSeries = computed(() => resolveWallpaperSeries(props.wallpaper, currentSeries.value))
const popularityStore = usePopularityStore()

// 状态
const isVisible = ref(false)
const imageLoaded = ref(false)
const fallbackStage = ref('none')
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

// Bing 壁纸使用 date 字段，普通壁纸使用 createdAt
const formattedDate = computed(() => {
  if (!props.wallpaper)
    return ''
  const dateValue = props.wallpaper.date || props.wallpaper.createdAt
  return formatDate(dateValue)
})

const relativeTime = computed(() => {
  if (!props.wallpaper)
    return ''
  const dateValue = props.wallpaper.date || props.wallpaper.createdAt
  return formatRelativeTime(dateValue)
})

// 是否是 Bing 壁纸
const isBingWallpaper = computed(() => props.wallpaper?.isBing === true)

// 优化的图片 URL
const optimizedImageUrl = computed(() => {
  if (!props.wallpaper?.url)
    return ''

  const primaryUrl = props.wallpaper.previewUrl || props.wallpaper.url

  if (fallbackStage.value === 'raw')
    return buildRawImageUrl(primaryUrl)
  if (fallbackStage.value === 'proxy')
    return buildProxyImageUrl(primaryUrl)

  return primaryUrl
})

// 监听
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && props.wallpaper) {
    handleOpen()
  }
  else if (!isOpen && isVisible.value) {
    handleClose()
  }
}, { immediate: true })

watch(() => props.wallpaper, () => {
  fallbackStage.value = 'none'
  resetState()
  // 统计数据现在是 computed，从 popularityStore 自动获取
})

function handleOpen() {
  trackWallpaperPreview(props.wallpaper)
  recordView(props.wallpaper, effectiveSeries.value)

  // 滚动锁定由父组件处理，这里只需要显示弹窗
  isVisible.value = true
}

function handleClose() {
  isVisible.value = false
}

function onModalAfterLeave() {
  // 滚动恢复由父组件处理，这里只需要通知关闭
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

function handleOpenCrop() {
  emit('openCrop')
}

function resetState() {
  imageLoaded.value = false
  imageDimensions.value = { width: 0, height: 0 }
  // 统计数据现在是 computed，无需手动重置
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" @after-leave="onModalAfterLeave">
      <div
        v-if="isVisible && wallpaper"
        class="desktop-modal"
      >
        <div class="desktop-modal__content">
          <!-- 关闭按钮 -->
          <button class="desktop-modal__close" aria-label="关闭" @click="handleClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <!-- 左侧：圆角大图预览 -->
          <div class="desktop-modal__preview">
            <DesktopImageStage
              :image-loaded="imageLoaded"
              :image-src="optimizedImageUrl"
              @load="handleImageLoad"
              @error="handleImageError"
            >
              <template #loading>
                <LoadingSpinner size="md" />
              </template>
            </DesktopImageStage>
          </div>

          <!-- 右侧：信息面板 -->
          <div class="desktop-modal__info">
            <div class="info-header">
              <h2 class="info-title">
                {{ isBingWallpaper ? wallpaper.title : displayFilename }}
              </h2>
              <p v-if="categoryDisplay && !isBingWallpaper" class="info-category">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                {{ categoryDisplay }}
              </p>
              <!-- Bing 壁纸版权信息 -->
              <p v-if="isBingWallpaper && wallpaper.copyright" class="info-copyright">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M14.83 14.83a4 4 0 1 1 0-5.66" />
                </svg>
                {{ wallpaper.copyright }}
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
              <span v-if="!isBingWallpaper" class="tag tag--secondary">{{ fileExt }}</span>
              <span v-if="isBingWallpaper" class="tag tag--bing">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                每日 Bing
              </span>
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
              <div v-if="!isBingWallpaper && formattedSize" class="detail-row">
                <span class="detail-label">文件大小</span>
                <span class="detail-value">{{ formattedSize }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">{{ isBingWallpaper ? '发布日期' : '上传时间' }}</span>
                <span class="detail-value">{{ formattedDate }} <span class="detail-sub">({{ relativeTime }})</span></span>
              </div>
              <div v-if="imageDimensions.width > 0" class="detail-row">
                <span class="detail-label">分辨率</span>
                <span class="detail-value">{{ imageDimensions.width }} × {{ imageDimensions.height }}</span>
              </div>
            </div>

            <!-- 原图信息卡片 -->
            <div v-if="wallpaper.resolution && !isBingWallpaper" class="original-card">
              <div class="original-header">
                <span class="original-label">原图</span>
                <span class="original-tag" :class="[`tag--${wallpaper.resolution.type || 'success'}`]">
                  {{ wallpaper.resolution.label }}
                </span>
              </div>
              <div class="original-details">
                <div class="original-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                  <span>{{ wallpaper.resolution.width }} × {{ wallpaper.resolution.height }}</span>
                </div>
              </div>
              <p class="original-hint">
                下载获取完整高清原图
              </p>
            </div>

            <!-- 操作按钮 -->
            <div class="action-buttons">
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
                v-if="effectiveSeries === 'desktop'"
                class="crop-btn"
                :disabled="!imageLoaded"
                @click="handleOpenCrop"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 2v4M6 14v8M18 2v4M18 14v8M2 6h4M14 6h8M2 18h4M14 18h8" />
                </svg>
                <span>智能裁剪</span>
              </button>

              <button
                class="download-btn"
                :disabled="downloading"
                @click="handleDownload"
              >
                <LoadingSpinner v-if="downloading" size="sm" />
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span>{{ downloading ? '下载中...' : '下载原图' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.desktop-modal {
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
  padding: 40px;

  &__content {
    position: relative;
    display: flex;
    gap: 50px;
    max-width: 1400px;
    width: 100%;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 32px;
    padding: 40px 50px;
    box-shadow:
      0 25px 50px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  &__close {
    position: absolute;
    top: 20px;
    right: 20px;
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
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;

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

  &__preview {
    flex: 0 1 860px;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__info {
    flex: 0 1 380px;
    min-width: 320px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 380px;
  }
}

// 信息区域
.info-header {
  .info-title {
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 12px 0;
    letter-spacing: -0.5px;
    word-break: break-all;
  }

  .info-category,
  .info-copyright {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
    line-height: 1.5;

    svg {
      width: 16px;
      height: 16px;
      color: rgba(255, 255, 255, 0.4);
      flex-shrink: 0;
      margin-top: 2px;
    }
  }
}

.info-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 20px;

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

  &--secondary {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.15);
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
      margin-right: 6px;
      font-size: 11px;
    }
  }

  &--bing {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(0, 120, 212, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(0, 120, 212, 0.3);

    svg {
      width: 14px;
      height: 14px;
    }
  }

  &--view,
  &--download {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    svg {
      width: 14px;
      height: 14px;
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
    gap: 6px;
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);

    svg {
      width: 14px;
      height: 14px;
    }
  }

  &--like {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(244, 63, 94, 0.2);
    color: #fb7185;
    border: 1px solid rgba(244, 63, 94, 0.3);

    svg {
      width: 14px;
      height: 14px;
    }
  }
}

.info-details {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .detail-label {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.5);
  }

  .detail-value {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }

  .detail-sub {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    margin-left: 6px;
  }
}

// 原图信息卡片
.original-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  background: linear-gradient(180deg, rgba(39, 56, 88, 0.96), rgba(23, 34, 58, 0.92));
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: 16px;
  box-shadow:
    0 16px 30px rgba(2, 8, 23, 0.26),
    inset 0 1px 0 rgba(191, 219, 254, 0.08);
}

.original-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.original-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.original-tag {
  padding: 4px 12px;
  font-size: 14px;
  font-weight: 700;
  border-radius: 8px;
}

.original-details {
  display: flex;
  gap: 16px;
}

.original-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;

  svg {
    width: 16px;
    height: 16px;
    color: var(--color-accent);
  }
}

.original-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
}

// 操作按钮
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: auto;
}

.crop-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 24px;
  background: linear-gradient(180deg, rgba(34, 47, 76, 0.96), rgba(23, 33, 56, 0.92));
  border: 1px solid rgba(96, 165, 250, 0.2);
  color: #dbeafe;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: inset 0 1px 0 rgba(191, 219, 254, 0.08);

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover:not(:disabled) {
    background: linear-gradient(180deg, rgba(43, 61, 96, 0.98), rgba(29, 41, 68, 0.94));
    border-color: rgba(96, 165, 250, 0.28);
    transform: translateY(-2px);
    box-shadow:
      inset 0 1px 0 rgba(191, 219, 254, 0.1),
      0 14px 28px rgba(2, 8, 23, 0.26);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 18px 28px;
  background: var(--accent-gradient);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 24px var(--accent-shadow);

  svg {
    width: 20px;
    height: 20px;
  }

  &:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px var(--accent-shadow-strong);
  }

  &:active:not(:disabled) {
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

// 弹窗动画
.modal-enter-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);

  .desktop-modal__content {
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

.modal-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  .desktop-modal__content {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

.modal-enter-from {
  opacity: 0;

  .desktop-modal__content {
    opacity: 0;
    transform: scale(0.85) translateY(40px);
  }
}

.modal-leave-to {
  opacity: 0;

  .desktop-modal__content {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
  }
}

// 响应式
@media (max-width: 1500px) {
  .desktop-modal {
    padding: 30px;

    &__content {
      gap: 40px;
      padding: 35px 40px;
    }
  }
}

@media (max-width: 1200px) {
  .desktop-modal__content {
    flex-direction: column;
    align-items: center;
    max-width: 800px;
    gap: 30px;
  }

  .desktop-modal__info {
    flex: 1 1 auto;
    min-width: 0;
    max-width: 100%;
    width: 100%;
  }
}
</style>
