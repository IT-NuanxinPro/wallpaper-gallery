<script setup>
/**
 * PC端手机壁纸弹窗 - 左右布局
 * 左侧：iPhone 14 Pro 真机预览（带灵动岛动画）
 * 右侧：壁纸信息和操作
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import WallpaperCardActions from '@/components/wallpaper/card/shared/WallpaperCardActions.vue'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { usePopularityStore } from '@/stores/popularity'
import { trackWallpaperDownload, trackWallpaperPreview } from '@/utils/common/analytics'
import { buildProxyImageUrl, buildRawImageUrl, buildWallpaperDownloadFilename, downloadFile, formatDate, formatFileSize, getDisplayFilename, getFileExtension, getResolutionLabel } from '@/utils/common/format'
import { recordDownload, recordView } from '@/utils/integrations/supabase'
import { resolveWallpaperSeries } from '@/utils/wallpaper/identity'

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

const emit = defineEmits(['close', 'toggleLike', 'toggleCollect'])

const { currentSeries } = useWallpaperType()
const effectiveSeries = computed(() => resolveWallpaperSeries(props.wallpaper, currentSeries.value))
const popularityStore = usePopularityStore()

// 状态
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

// 时钟
const timeDigits = ref(['0', '0', '0', '0'])
let timeTimer = null

// 灵动岛动画
const islandExpanded = ref(false)
let islandTimer = null

// 悬浮状态
const isHovered = ref(false)

function updateTime() {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  timeDigits.value = [hours[0], hours[1], minutes[0], minutes[1]]
}

// 自动展示灵动岛动画
function autoExpandIsland() {
  if (!isVisible.value)
    return
  islandExpanded.value = true
  setTimeout(() => {
    islandExpanded.value = false
  }, 3500)
}

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

// 优化的图片 URL（使用 webp 预览图）
const optimizedImageUrl = computed(() => {
  if (!props.wallpaper?.url)
    return ''

  if (fallbackStage.value === 'raw')
    return buildRawImageUrl(props.wallpaper.url)
  if (fallbackStage.value === 'proxy')
    return buildProxyImageUrl(props.wallpaper.url)

  return props.wallpaper.url
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

  // 启动时钟更新（仅在弹窗打开时运行）
  updateTime()
  if (timeTimer)
    clearInterval(timeTimer)
  timeTimer = setInterval(updateTime, 1000)

  // 延迟启动灵动岛动画
  setTimeout(autoExpandIsland, 1500)
  islandTimer = setInterval(autoExpandIsland, 8000)
}

function handleClose() {
  isVisible.value = false
  // 清理所有定时器
  if (timeTimer) {
    clearInterval(timeTimer)
    timeTimer = null
  }
  if (islandTimer) {
    clearInterval(islandTimer)
    islandTimer = null
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
  imageLoaded.value = false
  imageDimensions.value = { width: 0, height: 0 }
  // 统计数据现在是 computed，无需手动重置
  islandExpanded.value = false
}

onMounted(() => {
  // 注意：时钟定时器在 handleOpen 中启动，避免组件挂载但弹窗未打开时浪费资源
})

onUnmounted(() => {
  if (timeTimer)
    clearInterval(timeTimer)
  if (islandTimer)
    clearInterval(islandTimer)
})
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

          <!-- 左侧：iPhone 14 Pro 真机预览 -->
          <div class="desktop-modal__preview">
            <div
              class="iphone-frame"
              :class="{ 'is-hovered': isHovered }"
              @mouseenter="isHovered = true"
              @mouseleave="isHovered = false"
            >
              <!-- 屏幕 -->
              <div class="screen-container">
                <div v-if="!imageLoaded" class="loading-placeholder">
                  <LoadingSpinner size="md" />
                </div>
                <img
                  :src="optimizedImageUrl"
                  :alt="wallpaper.filename"
                  :class="{ loaded: imageLoaded }"
                  @load="handleImageLoad"
                  @error="handleImageError"
                >
              </div>

              <!-- 灵动岛 -->
              <div class="dynamic-island" :class="{ expanded: islandExpanded }">
                <div class="caller">
                  <div class="avatar" />
                  <div class="info">
                    <span>iPhone</span>
                    <p>来电中...</p>
                  </div>
                </div>
                <div class="actions">
                  <div class="refuse">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="14" height="14">
                      <path fill="currentColor" d="M199.232 125.568 90.624 379.008a32 32 0 0 0 6.784 35.2l512.384 512.384a32 32 0 0 0 35.2 6.784l253.44-108.608a32 32 0 0 0 10.048-52.032L769.6 633.92a32 32 0 0 0-36.928-5.952l-130.176 65.088-271.488-271.552 65.024-130.176a32 32 0 0 0-5.952-36.928L251.2 115.52a32 32 0 0 0-51.968 10.048" />
                    </svg>
                  </div>
                  <div class="answer">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="14" height="14">
                      <path fill="currentColor" d="M199.232 125.568 90.624 379.008a32 32 0 0 0 6.784 35.2l512.384 512.384a32 32 0 0 0 35.2 6.784l253.44-108.608a32 32 0 0 0 10.048-52.032L769.6 633.92a32 32 0 0 0-36.928-5.952l-130.176 65.088-271.488-271.552 65.024-130.176a32 32 0 0 0-5.952-36.928L251.2 115.52a32 32 0 0 0-51.968 10.048" />
                    </svg>
                  </div>
                </div>
              </div>

              <!-- 时钟 -->
              <div class="clock">
                <span>{{ timeDigits[0] }}</span>
                <span>{{ timeDigits[1] }}</span>
                <span class="colon">:</span>
                <span>{{ timeDigits[2] }}</span>
                <span>{{ timeDigits[3] }}</span>
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
          <div class="desktop-modal__info">
            <div class="info-header">
              <h2 class="info-title">
                {{ displayFilename }}
              </h2>
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
              <div v-if="imageDimensions.width > 0" class="detail-row">
                <span class="detail-label">分辨率</span>
                <span class="detail-value">{{ imageDimensions.width }} × {{ imageDimensions.height }}</span>
              </div>
            </div>

            <div class="info-actions">
              <div v-if="isAuthenticated" class="info-actions__toolbar">
                <WallpaperCardActions
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
              </div>

              <button
                class="download-btn"
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
    gap: 28px;
    padding-top: 10px;
  }
}

.info-actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-start;
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
      0 0 60px var(--accent-ring);
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
  background: #000;

  .loading-placeholder {
    position: absolute;
    inset: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 42px;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 42px;
    display: block;
    opacity: 0;
    transition: opacity 0.5s ease;

    &.loaded {
      opacity: 1;
    }
  }
}

// 灵动岛
.dynamic-island {
  position: absolute;
  top: 18px;
  width: 90px;
  height: 28px;
  background: #000;
  border-radius: 20px;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 10px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &.expanded {
    width: 180px;
    height: 45px;
    border-radius: 25px;

    .caller {
      opacity: 1;
      visibility: visible;

      .avatar {
        width: 30px;
        height: 30px;
      }

      .info span {
        opacity: 1;
        visibility: visible;
        line-height: 10px;
      }
    }

    .actions {
      opacity: 1;
      visibility: visible;

      .refuse {
        background-color: #ff4438;
        color: #fff;
      }

      .answer {
        background-color: #30d258;
        color: #fff;
      }
    }
  }
}

.caller {
  display: flex;
  align-items: center;
  color: #fff;
  opacity: 0;
  visibility: hidden;
  transition: 0.4s;

  .avatar {
    width: 0;
    height: 0;
    border-radius: 50%;
    // background: var(--accent-gradient);
    background: url('https://photos5.appleinsider.com/gallery/50657-99800-Tim-Cook-xl.jpg') center/cover;
    margin-right: 8px;
    transition: 0.4s;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 3px;

    span {
      font-size: 9px;
      color: #cdcdcd;
      font-weight: 500;
      line-height: 0;
      opacity: 0;
      visibility: hidden;
      transition: 0.4s;
    }

    p {
      font-size: 11px;
      color: #f0f8ff;
      margin: 0;
    }
  }
}

.actions {
  display: flex;
  gap: 10px;
  opacity: 0;
  visibility: hidden;
  transition: 0.4s 0.2s;

  .refuse,
  .answer {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .refuse {
    color: #ff4438;
    transform: rotate(135deg);
  }

  .answer {
    color: #30d258;
  }
}

// 时钟
.clock {
  position: absolute;
  top: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  color: #fff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);

  span {
    font-size: 58px;
    font-weight: 700;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
    line-height: 1;
    margin: 0 2px;
  }

  .colon {
    position: relative;
    top: -5px;
    margin: 0 4px;
  }
}

.home-indicator {
  position: absolute;
  bottom: 12px;
  width: 40%;
  height: 5px;
  background-color: #fff;
  border-radius: 3px;
  z-index: 2;
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
  backdrop-filter: blur(10px);

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
  background: var(--accent-gradient);
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 24px var(--accent-shadow);
  margin-top: auto;

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
</style>
