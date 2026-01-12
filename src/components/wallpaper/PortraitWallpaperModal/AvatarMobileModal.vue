<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import { useScrollLock } from '@/composables/useScrollLock'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { usePopularityStore } from '@/stores/popularity'
import { trackWallpaperDownload, trackWallpaperPreview } from '@/utils/analytics'
import { downloadFile, formatDate, formatFileSize, getDisplayFilename, getFileExtension, getResolutionLabel } from '@/utils/format'
import { recordDownload, recordView } from '@/utils/supabase'

const props = defineProps({
  wallpaper: { type: Object, default: null },
  isOpen: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const { currentSeries } = useWallpaperType()
const scrollLock = useScrollLock()
const popularityStore = usePopularityStore()

// 状态
const isVisible = ref(false)
const imageLoaded = ref(false)
const downloading = ref(false)
const imageDimensions = ref({ width: 0, height: 0 })
const isSquare = ref(false) // 头像形状：false=圆形，true=方形

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

// 计算属性
const displayFilename = computed(() =>
  props.wallpaper ? getDisplayFilename(props.wallpaper.filename) : '',
)

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
})

// 监听壁纸变化
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
  imageDimensions.value = {
    width: e.target.naturalWidth,
    height: e.target.naturalHeight,
  }
}

function resetState() {
  imageLoaded.value = false
  imageDimensions.value = { width: 0, height: 0 }
  // 统计数据现在是 computed，无需手动重置
}

function handleKeydown(e) {
  if (!isVisible.value)
    return
  if (e.key === 'Escape')
    closeModal()
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" @after-leave="onAfterLeave">
      <div
        v-if="isVisible && wallpaper"
        class="avatar-modal"
        @click.self="closeModal"
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
                :src="wallpaper.url"
                :alt="wallpaper.filename"
                :class="{ loaded: imageLoaded }"
                @load="handleImageLoad"
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
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(26, 26, 46, 0.98), rgba(22, 33, 62, 0.98), rgba(15, 52, 96, 0.98));
  padding: 16px;

  &__content {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 360px;
    max-height: 90vh;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    overflow: hidden;
    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.4),
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
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 32px 24px 20px;
    background: rgba(0, 0, 0, 0.2);
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

// 头像框架
.avatar-frame {
  position: relative;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea, #764ba2);
  padding: 4px;
  box-shadow:
    0 8px 32px rgba(102, 126, 234, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1);
  transition: border-radius 0.3s ease;

  .loading-placeholder {
    position: absolute;
    inset: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(26, 26, 46, 0.8);
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

// 形状切换
.shape-toggle {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.shape-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 32px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.2s ease;

  svg {
    width: 18px;
    height: 18px;
  }

  &.active {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
  }

  &:not(.active):active {
    background: rgba(255, 255, 255, 0.1);
  }
}

.info-header {
  .info-title {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 8px;
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
}

// 动画
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

// 小屏适配
@media (max-height: 650px) {
  .avatar-modal {
    padding: 12px;
    &__content {
      max-height: 95vh;
      border-radius: 20px;
    }
    &__preview {
      padding: 24px 16px 16px;
      gap: 12px;
    }
    &__info {
      gap: 12px;
      padding: 14px;
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
