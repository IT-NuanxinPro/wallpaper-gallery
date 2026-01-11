<script setup>
/**
 * PC端头像弹窗 - 左右布局
 * 左侧：iPhone 14 Pro 真机预览（头像居中展示）
 * 右侧：头像信息和操作（支持圆形/圆角方形切换）
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
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
const popularityStore = usePopularityStore()

// 状态
const isVisible = ref(false)
const imageLoaded = ref(false)
const downloading = ref(false)
const imageDimensions = ref({ width: 0, height: 0 })
const isSquare = ref(false) // 头像形状：false=圆形，true=圆角方形

// 统计数据
const downloadCount = computed(() => props.wallpaper ? popularityStore.getDownloadCount(props.wallpaper.filename) : 0)
const viewCount = computed(() => props.wallpaper ? popularityStore.getViewCount(props.wallpaper.filename) : 0)

// 悬浮状态
const isHovered = ref(false)

// 计算属性
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

const optimizedImageUrl = computed(() => {
  if (!props.wallpaper?.url)
    return ''
  return props.wallpaper.url
})

// 监听
watch(() => props.isOpen, (isOpen) => {
  if (isOpen && props.wallpaper)
    handleOpen()
  else if (!isOpen && isVisible.value)
    handleClose()
})

watch(() => props.wallpaper, () => resetState())

function handleOpen() {
  trackWallpaperPreview(props.wallpaper)
  recordView(props.wallpaper, currentSeries.value)
  popularityStore.incrementLocalView(props.wallpaper.filename)
  isVisible.value = true
}

function handleClose() {
  isVisible.value = false
}

// eslint-disable-next-line style/max-statements-per-line
function onModalAfterLeave() { emit('close') }

async function handleDownload() {
  if (!props.wallpaper || downloading.value)
    return
  downloading.value = true
  try {
    await downloadFile(props.wallpaper.url, props.wallpaper.filename)
    trackWallpaperDownload(props.wallpaper, currentSeries.value)
    recordDownload(props.wallpaper, currentSeries.value)
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
}

function handleKeydown(e) {
  if (!isVisible.value)
    return
  if (e.key === 'Escape')
    handleClose()
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" @after-leave="onModalAfterLeave">
      <div v-if="isVisible && wallpaper" class="avatar-desktop-modal" @click.self="handleClose">
        <div class="avatar-desktop-modal__content">
          <!-- 关闭按钮 -->
          <button class="avatar-desktop-modal__close" aria-label="关闭" @click="handleClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <!-- 左侧：iPhone 14 Pro 真机预览 -->
          <div class="avatar-desktop-modal__preview">
            <div
              class="iphone-frame"
              :class="{ 'is-hovered': isHovered }"
              @mouseenter="isHovered = true"
              @mouseleave="isHovered = false"
            >
              <!-- 屏幕背景 -->
              <div class="screen-container">
                <div class="screen-bg" />
                <!-- 头像展示区 -->
                <div class="avatar-showcase">
                  <div class="avatar-wrapper" :class="{ 'is-square': isSquare }">
                    <div v-if="!imageLoaded" class="loading-placeholder">
                      <LoadingSpinner size="md" />
                    </div>
                    <img
                      :src="optimizedImageUrl"
                      :alt="wallpaper.filename"
                      :class="{ loaded: imageLoaded }"
                      @load="handleImageLoad"
                    >
                  </div>
                  <!-- 模拟昵称 -->
                  <div class="avatar-name">
                    头像预览
                  </div>
                </div>
              </div>

              <!-- 底部指示器 -->
              <div class="home-indicator" />

              <!-- 物理按键 -->
              <div class="mute-btn" />
              <div class="volume-up-btn" />
              <div class="volume-down-btn" />
              <div class="power-btn" />
            </div>
          </div>

          <!-- 右侧：信息面板 -->
          <div class="avatar-desktop-modal__info">
            <div class="info-header">
              <h2 class="info-title">
                {{ displayFilename }}
              </h2>
              <p v-if="categoryDisplay" class="info-category">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                {{ categoryDisplay }}
              </p>
            </div>

            <!-- 形状切换 -->
            <div class="shape-switcher">
              <span class="shape-label">头像形状</span>
              <div class="shape-toggle">
                <button class="shape-btn" :class="{ active: !isSquare }" title="圆形" @click="isSquare = false">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  <span>圆形</span>
                </button>
                <button class="shape-btn" :class="{ active: isSquare }" title="圆角方形" @click="isSquare = true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                  </svg>
                  <span>方形</span>
                </button>
              </div>
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
              <div v-if="imageDimensions.width > 0" class="detail-row">
                <span class="detail-label">尺寸</span>
                <span class="detail-value">{{ imageDimensions.width }} × {{ imageDimensions.height }}</span>
              </div>
            </div>

            <button class="download-btn" :disabled="downloading" @click="handleDownload">
              <LoadingSpinner v-if="downloading" size="sm" />
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              <span>{{ downloading ? '下载中...' : '下载头像' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.avatar-desktop-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(26, 26, 46, 0.95), rgba(22, 33, 62, 0.95), rgba(15, 52, 96, 0.95));
  backdrop-filter: blur(20px);
  padding: 40px;

  &__content {
    position: relative;
    display: flex;
    gap: 60px;
    max-width: 1000px;
    width: 100%;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 32px;
    padding: 50px;
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
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-top: 10px;
  }
}

// iPhone 14 Pro 真机框架
.iphone-frame {
  position: relative;
  width: 280px;
  height: 580px;
  background-color: #0e0e0e;
  border: 1px solid #959595;
  border-radius: 45px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow:
    0 0 0 2px #1a1a1a,
    0 0 0 4px #2a2a2a,
    0 25px 50px rgba(0, 0, 0, 0.5);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  &.is-hovered {
    transform: scale(1.02) rotateY(-2deg) rotateX(1deg);
    box-shadow:
      0 0 0 2px #1a1a1a,
      0 0 0 4px #2a2a2a,
      0 35px 70px rgba(0, 0, 0, 0.6),
      0 0 60px rgba(102, 126, 234, 0.15);
  }
}

.screen-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 44px;
  overflow: hidden;
  z-index: 1;
  padding: 3px;
  box-sizing: border-box;
}

.screen-bg {
  position: absolute;
  inset: 3px;
  border-radius: 42px;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}

// 头像展示区
.avatar-showcase {
  position: absolute;
  inset: 3px;
  border-radius: 42px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  z-index: 2;
}

.avatar-wrapper {
  position: relative;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea, #764ba2);
  padding: 4px;
  box-shadow:
    0 12px 40px rgba(102, 126, 234, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.15);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &.is-square {
    border-radius: 28px;
    img {
      border-radius: 24px;
    }
    .loading-placeholder {
      border-radius: 24px;
    }
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.25), transparent 60%);
    pointer-events: none;
    z-index: 2;
  }

  .loading-placeholder {
    position: absolute;
    inset: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(26, 26, 46, 0.9);
    border-radius: 50%;
    z-index: 1;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    opacity: 0;
    transform: scale(0.9);
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    &.loaded {
      opacity: 1;
      transform: scale(1);
    }
  }
}

.avatar-name {
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  letter-spacing: 0.5px;
}

.home-indicator {
  position: absolute;
  bottom: 12px;
  width: 40%;
  height: 5px;
  background-color: #fff;
  border-radius: 3px;
  z-index: 3;
}

// 物理按键
.mute-btn,
.volume-up-btn,
.volume-down-btn,
.power-btn {
  position: absolute;
  width: 3px;
  border-radius: 3px;
  background: linear-gradient(90deg, #ccc, #666, #222);
}
.mute-btn {
  left: -3px;
  top: 100px;
  height: 22px;
}
.volume-up-btn {
  left: -3px;
  top: 150px;
  height: 45px;
}
.volume-down-btn {
  left: -3px;
  top: 205px;
  height: 45px;
}
.power-btn {
  right: -3px;
  top: 165px;
  height: 75px;
}

// 信息区域
.info-header {
  .info-title {
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 12px 0;
    letter-spacing: -0.5px;
  }
  .info-category {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
    svg {
      width: 16px;
      height: 16px;
      color: rgba(255, 255, 255, 0.4);
    }
  }
}

// 形状切换
.shape-switcher {
  display: flex;
  align-items: center;
  gap: 16px;
}

.shape-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.shape-toggle {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 14px;
}

.shape-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  svg {
    width: 16px;
    height: 16px;
  }
  &.active {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
  &:not(.active):hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
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
  &--secondary {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.15);
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
}

.info-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
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
}

.download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 18px 28px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
  margin-top: auto;
  svg {
    width: 20px;
    height: 20px;
  }
  &:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(102, 126, 234, 0.5);
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
  .avatar-desktop-modal__content {
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}
.modal-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  .avatar-desktop-modal__content {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
}
.modal-enter-from {
  opacity: 0;
  .avatar-desktop-modal__content {
    opacity: 0;
    transform: scale(0.85) translateY(40px);
  }
}
.modal-leave-to {
  opacity: 0;
  .avatar-desktop-modal__content {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
  }
}
</style>
