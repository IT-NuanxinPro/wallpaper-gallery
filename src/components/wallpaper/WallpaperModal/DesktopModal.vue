<script setup>
/**
 * PC端电脑壁纸弹窗 - 左右布局
 * 左侧：MacBook Pro 真机预览（带 macOS 菜单栏）
 * 右侧：壁纸信息和操作
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { usePopularityStore } from '@/stores/popularity'
import { trackWallpaperDownload, trackWallpaperPreview } from '@/utils/analytics'
import { downloadFile, formatDate, formatFileSize, formatRelativeTime, getDisplayFilename, getFileExtension, getResolutionLabel } from '@/utils/format'
import { recordDownload, recordView } from '@/utils/supabase'

const props = defineProps({
  wallpaper: {
    type: Object,
    default: null,
  },
  isOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'openCrop'])

const { currentSeries } = useWallpaperType()
const popularityStore = usePopularityStore()

// 状态
const isVisible = ref(false)
const imageLoaded = ref(false)
const shellLoaded = ref(false)
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

// 悬浮状态
const isHovered = ref(false)

// 当前时间
const currentTime = ref('')
let timeTimer = null

function updateTime() {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const weekDay = weekDays[now.getDay()]
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  currentTime.value = `${month}月${day}日 ${weekDay} ${hours}:${minutes}:${seconds}`
}

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
  return props.wallpaper.previewUrl || props.wallpaper.url
})

// 监听
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && props.wallpaper) {
    handleOpen()
  }
  else if (!isOpen && isVisible.value) {
    handleClose()
  }
})

watch(() => props.wallpaper, () => {
  resetState()
  // 统计数据现在是 computed，从 popularityStore 自动获取
})

function handleOpen() {
  trackWallpaperPreview(props.wallpaper)
  recordView(props.wallpaper, currentSeries.value)
  // 乐观更新本地统计（立即反映到 UI）
  popularityStore.incrementLocalView(props.wallpaper.filename)

  // 滚动锁定由父组件处理，这里只需要显示弹窗
  isVisible.value = true

  // 启动时钟更新（仅在弹窗打开时运行）
  updateTime()
  if (timeTimer)
    clearInterval(timeTimer)
  timeTimer = setInterval(updateTime, 1000)
}

function handleClose() {
  isVisible.value = false
  // 清理定时器
  if (timeTimer) {
    clearInterval(timeTimer)
    timeTimer = null
  }
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

function handleShellLoad() {
  shellLoaded.value = true
}

function handleOpenCrop() {
  emit('openCrop')
}

function resetState() {
  imageLoaded.value = false
  imageDimensions.value = { width: 0, height: 0 }
  // 统计数据现在是 computed，无需手动重置
}

function handleKeydown(e) {
  if (!isVisible.value)
    return
  switch (e.key) {
    case 'Escape':
      handleClose()
      break
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  // 注意：时钟定时器在 handleOpen 中启动，避免组件挂载但弹窗未打开时浪费资源
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (timeTimer)
    clearInterval(timeTimer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" @after-leave="onModalAfterLeave">
      <div
        v-if="isVisible && wallpaper"
        class="desktop-modal"
        @click.self="handleClose"
      >
        <div class="desktop-modal__content">
          <!-- 关闭按钮 -->
          <button class="desktop-modal__close" aria-label="关闭" @click="handleClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <!-- 左侧：MacBook Pro 真机预览 -->
          <div class="desktop-modal__preview">
            <div
              class="macbook-wrapper"
              :class="{ 'is-hovered': isHovered }"
              @mouseenter="isHovered = true"
              @mouseleave="isHovered = false"
            >
              <!-- 屏幕区域 -->
              <div class="screen-area">
                <div v-if="!imageLoaded" class="loading-placeholder">
                  <LoadingSpinner size="md" />
                </div>
                <img
                  :src="optimizedImageUrl"
                  alt="壁纸预览"
                  class="wallpaper-img"
                  :class="{ loaded: imageLoaded }"
                  @load="handleImageLoad"
                >
                <!-- macOS 菜单栏 -->
                <div class="menu-bar">
                  <div class="menu-left">
                    <span class="apple-logo" />
                    <span class="menu-item active">访达</span>
                    <span class="menu-item">文件</span>
                    <span class="menu-item">编辑</span>
                    <span class="menu-item">显示</span>
                    <span class="menu-item">前往</span>
                    <span class="menu-item">窗口</span>
                    <span class="menu-item">帮助</span>
                  </div>
                  <div class="menu-right">
                    <!-- 蓝牙图标 -->
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z" />
                    </svg>
                    <!-- Wi-Fi 图标 -->
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
                    </svg>
                    <!-- 投屏图标 -->
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM4 6h4v2H4zm0 3h4v2H4zm0 3h4v2H4z" />
                    </svg>
                    <!-- 控制中心图标 -->
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 11h2v2H7v-2zm14-5v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h1V2h2v2h8V2h2v2h1c1.1 0 2 .9 2 2zM5 8h14V6H5v2zm14 12V10H5v10h14zm-4-7h2v-2h-2v2zm-4 0h2v-2h-2v2z" />
                    </svg>
                    <!-- 时间 -->
                    <span class="time">{{ currentTime }}</span>
                  </div>
                </div>
              </div>
              <!-- MacBook 外壳 -->
              <img
                src="https://dynamicwallpaper.club/landing-vids/mb3.png"
                alt="MacBook Pro"
                class="macbook-shell"
                @load="handleShellLoad"
              >
            </div>
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
              <button
                v-if="currentSeries === 'desktop'"
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
    max-width: 380px;
  }
}

// MacBook 真机预览
.macbook-wrapper {
  position: relative;
  width: 700px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &.is-hovered {
    transform: scale(1.02) rotateY(-2deg) rotateX(1deg);

    .macbook-shell {
      filter: drop-shadow(0 35px 70px rgba(0, 0, 0, 0.6));
    }
  }
}

.macbook-shell {
  display: block;
  width: 100%;
  height: auto;
  position: relative;
  z-index: 1;
  pointer-events: none;
  filter: drop-shadow(0 25px 50px rgba(0, 0, 0, 0.5));
  transition: filter 0.4s ease;
}

.screen-area {
  position: absolute;
  top: 3.1%;
  left: 10.9%;
  width: 78%;
  height: 85.5%;
  z-index: 10;
  overflow: hidden;
  border-radius: 3px;
  background: #000;

  .loading-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  }
}

.wallpaper-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0;
  transition: opacity 0.5s ease;

  &.loaded {
    opacity: 1;
  }
}

// macOS 菜单栏
.menu-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3.8%;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1.2%;
  font-size: 8px;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  z-index: 20;
  // 文字阴影确保在任何背景下都可读
  text-shadow: 0 0.5px 1px rgba(0, 0, 0, 0.3);
}

.menu-left {
  display: flex;
  gap: 10px;
  align-items: center;

  .apple-logo::before {
    content: '\f8ff';
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11px;
  }

  .menu-item {
    opacity: 0.85;
    font-weight: 400;

    &.active {
      font-weight: 600;
    }
  }
}

.menu-right {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 9px;

  .menu-icon {
    width: 12px;
    height: 12px;
    opacity: 0.9;
  }

  .time {
    font-weight: 500;
    margin-left: 4px;
    font-variant-numeric: tabular-nums;
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
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
  border: 1px solid rgba(102, 126, 234, 0.25);
  border-radius: 16px;
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
    color: #667eea;
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
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
    transform: translateY(-2px);
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);

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

  .macbook-wrapper {
    width: 580px;
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
    max-width: 100%;
    width: 100%;
  }

  .macbook-wrapper {
    width: 100%;
    max-width: 600px;
  }
}
</style>
