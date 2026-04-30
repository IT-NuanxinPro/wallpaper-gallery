<script setup>
import { gsap } from 'gsap'
import { computed, nextTick, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import WallpaperCardActions from '@/components/wallpaper/card/shared/WallpaperCardActions.vue'
import VideoWallpaperPlayer from '@/components/wallpaper/VideoWallpaperPlayer.vue'
import { useDevice } from '@/composables/useDevice'
import { useInteraction } from '@/composables/useInteraction'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { usePopularityStore } from '@/stores/popularity'
import { trackWallpaperDownload, trackWallpaperPreview } from '@/utils/common/analytics'
import { buildProxyImageUrl, buildRawImageUrl, buildWallpaperDownloadFilename, downloadFile, formatDate, formatFileSize, formatRelativeTime, getDisplayFilename, getFileExtension, getResolutionLabel } from '@/utils/common/format'
import { recordDownload, recordView } from '@/utils/integrations/supabase'
import { resolveWallpaperSeries } from '@/utils/wallpaper/identity'
import ImageCropModal from '../crop/index.vue'
import DesktopModal from './desktop/DesktopModal.vue'
import BingWallpaperInfo from './shared/BingWallpaperInfo.vue'

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

const emit = defineEmits(['close', 'prev', 'next'])

// 设备检测
const { isMobile, isTablet, isDesktop, isLandscape, isPortrait } = useDevice()

// 获取当前系列
const { currentSeries } = useWallpaperType()
const effectiveSeries = computed(() => resolveWallpaperSeries(props.wallpaper, currentSeries.value))
const { collected, isAuthenticated, liked, toggleCollect, toggleLike } = useInteraction(toRef(props, 'wallpaper'), effectiveSeries)

// 热门数据 Store
const popularityStore = usePopularityStore()

// PC端桌面壁纸和每日Bing使用独立的桌面弹窗（带 MacBook 预览）
const useDesktopModal = computed(() => isDesktop.value && ['desktop', 'bing'].includes(effectiveSeries.value))

// 是否显示裁剪功能（PC端和平板端，仅 desktop 系列）
// 平板用户也需要裁剪功能（4:3 iPad, 16:10 安卓, 3:2 Surface）
const showCropFeature = computed(() => !isMobile.value && effectiveSeries.value === 'desktop')

// 是否使用水平布局（PC端，或平板横屏时）
const useHorizontalLayout = computed(() => {
  if (isDesktop.value)
    return true
  if (isTablet.value && isLandscape.value)
    return true
  return false
})

// 是否使用紧凑信息布局（手机，或平板竖屏时）
const useCompactInfo = computed(() => {
  if (isMobile.value)
    return true
  if (isTablet.value && isPortrait.value)
    return true
  return false
})

// 裁剪弹窗状态
const isCropModalOpen = ref(false)

// 打开裁剪弹窗
function openCropModal() {
  isCropModalOpen.value = true
}

// 关闭裁剪弹窗
function closeCropModal() {
  isCropModalOpen.value = false
}

const modalRef = ref(null)
const contentRef = ref(null)
const infoRef = ref(null)
const imageLoaded = ref(false)
const imageError = ref(false)
const videoLoaded = ref(false)
const videoError = ref(false)
const downloading = ref(false)
const actualDimensions = ref({ width: 0, height: 0 })

// 保存滚动位置（修复移动端弹窗关闭后滚动位置丢失问题）
const savedScrollY = ref(0)

// 渐进式加载状态
const previewLoaded = ref(false)
const originalLoaded = ref(false)
const showOriginal = ref(false)
const loadingOriginal = ref(false)
const fallbackStage = ref('none')

// 下载次数（从 popularityStore 获取，支持乐观更新）
const downloadCount = computed(() => {
  if (!props.wallpaper)
    return 0
  return popularityStore.getDownloadCount(props.wallpaper.filename)
})

// 访问量（从 popularityStore 获取，支持乐观更新）
const viewCount = computed(() => {
  if (!props.wallpaper)
    return 0
  return popularityStore.getViewCount(props.wallpaper.filename)
})

const likeCount = computed(() => {
  if (!props.wallpaper)
    return 0
  return popularityStore.getLikeCount(props.wallpaper.filename)
})

const collectCount = computed(() => {
  if (!props.wallpaper)
    return 0
  return popularityStore.getCollectCount(props.wallpaper.filename)
})

const isVideoWallpaper = computed(() => props.wallpaper?.mediaType === 'video')

// 是否有预览图（仅 desktop 系列）
const hasPreview = computed(() => !!props.wallpaper?.previewUrl)

// 当前显示的图片 URL
const baseDisplayUrl = computed(() => {
  if (!props.wallpaper)
    return ''

  // 如果没有预览图，直接返回原图
  if (!hasPreview.value) {
    return props.wallpaper.url
  }

  // 如果用户选择查看原图，返回原图 URL
  if (showOriginal.value) {
    return props.wallpaper.url
  }

  // 默认返回预览图 URL
  return props.wallpaper.previewUrl || props.wallpaper.url
})

const displayUrl = computed(() => {
  if (!baseDisplayUrl.value)
    return ''

  if (fallbackStage.value === 'raw')
    return buildRawImageUrl(baseDisplayUrl.value)
  if (fallbackStage.value === 'proxy')
    return buildProxyImageUrl(baseDisplayUrl.value)

  return baseDisplayUrl.value
})

// GSAP 入场动画
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    // 如果使用 DesktopModal，由它自己处理统计，这里不重复调用
    if (!useDesktopModal.value && props.wallpaper) {
      // 追踪壁纸预览事件
      trackWallpaperPreview(props.wallpaper)
      // 记录到 Supabase 统计（异步 RPC）
      recordView(props.wallpaper, effectiveSeries.value)
    }

    // 保存当前滚动位置
    savedScrollY.value = window.scrollY || window.pageYOffset

    // 设置 body top 保持视觉位置，禁止背景滚动
    document.body.style.top = `-${savedScrollY.value}px`
    document.body.classList.add('modal-open')

    await nextTick()
    animateIn()
  }
  else {
    // 恢复背景滚动
    document.body.classList.remove('modal-open')
    document.body.style.top = ''

    // 恢复滚动位置（立即跳转，无动画）
    window.scrollTo({ top: savedScrollY.value, behavior: 'instant' })
  }
})

function animateIn() {
  if (!modalRef.value || !contentRef.value)
    return

  const tl = gsap.timeline()

  tl.fromTo(modalRef.value, {
    opacity: 0,
  }, {
    opacity: 1,
    duration: 0.3,
    ease: 'power2.out',
  })

  tl.fromTo(contentRef.value, {
    scale: 0.9,
    y: 30,
    opacity: 0,
  }, {
    scale: 1,
    y: 0,
    opacity: 1,
    duration: 0.4,
    ease: 'back.out(1.2)',
  }, '-=0.1')

  if (infoRef.value) {
    tl.fromTo(infoRef.value.children, {
      y: 20,
      opacity: 0,
    }, {
      y: 0,
      opacity: 1,
      duration: 0.3,
      stagger: 0.05,
      ease: 'power2.out',
    }, '-=0.2')
  }
}

function animateOut(callback) {
  if (!modalRef.value || !contentRef.value) {
    callback?.()
    return
  }

  const tl = gsap.timeline({
    onComplete: callback,
  })

  tl.to(contentRef.value, {
    scale: 0.95,
    y: 20,
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
  })

  tl.to(modalRef.value, {
    opacity: 0,
    duration: 0.2,
  }, '-=0.1')
}

// Reset state when wallpaper changes
watch(() => props.wallpaper, () => {
  fallbackStage.value = 'none'
  imageLoaded.value = false
  imageError.value = false
  videoLoaded.value = false
  videoError.value = false
  actualDimensions.value = { width: 0, height: 0 }
  // 重置渐进式加载状态
  previewLoaded.value = false
  originalLoaded.value = false
  showOriginal.value = false
  loadingOriginal.value = false
  // 统计数据现在是 computed，从 popularityStore 自动获取，无需手动重置
})

watch(baseDisplayUrl, () => {
  fallbackStage.value = 'none'
  imageLoaded.value = false
  imageError.value = false
  actualDimensions.value = { width: 0, height: 0 }
})

// 分辨率信息 - 显示当前加载图片的分辨率（预览图或原图）
const resolution = computed(() => {
  // 使用图片加载后的真实尺寸来计算分辨率标签
  if (actualDimensions.value.width > 0) {
    return getResolutionLabel(actualDimensions.value.width, actualDimensions.value.height)
  }
  return { label: '加载中', type: 'secondary' }
})

const fileExt = computed(() => props.wallpaper ? getFileExtension(props.wallpaper.filename).toUpperCase() : '')
const formattedSize = computed(() => props.wallpaper ? formatFileSize(props.wallpaper.size) : '')
const formattedDate = computed(() => props.wallpaper ? formatDate(props.wallpaper.createdAt) : '')
const relativeTime = computed(() => props.wallpaper ? formatRelativeTime(props.wallpaper.createdAt) : '')
// 显示标题（优先使用 AI 标题）
const displayTitle = computed(() => {
  if (!props.wallpaper)
    return ''

  // 优先使用 AI 生成的显示标题
  if (props.wallpaper.displayTitle) {
    return props.wallpaper.displayTitle
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

// 分类信息显示
const categoryDisplay = computed(() => {
  if (!props.wallpaper)
    return ''
  const { category, subcategory } = props.wallpaper
  if (!category)
    return ''
  if (subcategory)
    return `${category} / ${subcategory}`
  return category
})

// Bing 壁纸判断（详细信息由 BingWallpaperInfo 组件处理）
const isBingWallpaper = computed(() => props.wallpaper?.isBing === true)

// 原图分辨率信息（如果 JSON 数据中有分辨率但标签可能过时，使用 getResolutionLabel 重新计算）
const originalResolution = computed(() => {
  if (!props.wallpaper?.resolution) {
    return null
  }
  const res = props.wallpaper.resolution
  // 如果分辨率对象有 width 和 height，使用 getResolutionLabel 确保标签是最新的（支持16K）
  if (res.width && res.height) {
    const updatedLabel = getResolutionLabel(res.width, res.height)
    return {
      width: res.width,
      height: res.height,
      label: updatedLabel.label,
      type: updatedLabel.type,
    }
  }
  // 如果没有 width/height，直接返回原始数据
  return res
})
// 显示用的尺寸（显示当前加载图片的实际尺寸，即预览图尺寸）
const displayDimensions = computed(() => {
  // 使用图片加载后获取的实际尺寸（预览图尺寸）
  if (actualDimensions.value.width > 0) {
    return actualDimensions.value
  }
  return { width: 0, height: 0 }
})

// Handlers
function handleImageLoad(e) {
  imageLoaded.value = true

  // 根据是否有预览图更新不同的状态
  if (hasPreview.value) {
    if (showOriginal.value) {
      originalLoaded.value = true
      loadingOriginal.value = false
    }
    else {
      previewLoaded.value = true
    }
  }
  else {
    // 没有预览图，直接标记原图加载完成
    originalLoaded.value = true
  }

  // 获取图片实际尺寸
  if (e.target) {
    actualDimensions.value = {
      width: e.target.naturalWidth,
      height: e.target.naturalHeight,
    }
  }
}

function handleImageError() {
  if (fallbackStage.value === 'none') {
    fallbackStage.value = 'raw'
    imageLoaded.value = false
    imageError.value = false
    return
  }

  if (fallbackStage.value === 'raw') {
    fallbackStage.value = 'proxy'
    imageLoaded.value = false
    imageError.value = false
    return
  }

  imageError.value = true
  imageLoaded.value = true
  loadingOriginal.value = false
}

function handleClose() {
  animateOut(() => {
    emit('close')
  })
}

function handlePrev() {
  emit('prev')
}

function handleNext() {
  emit('next')
}

async function handleDownload() {
  if (!props.wallpaper || downloading.value)
    return

  downloading.value = true
  try {
    await downloadFile(props.wallpaper.url, buildWallpaperDownloadFilename(props.wallpaper))
    // 追踪下载事件,包含系列信息
    trackWallpaperDownload(props.wallpaper, effectiveSeries.value)
    // 记录到 Supabase 统计（异步 RPC）
    recordDownload(props.wallpaper, effectiveSeries.value)
  }
  finally {
    downloading.value = false
  }
}

function handleVideoLoadedMetadata(event) {
  videoLoaded.value = true
  videoError.value = false

  if (event?.target?.videoWidth > 0) {
    actualDimensions.value = {
      width: event.target.videoWidth,
      height: event.target.videoHeight,
    }
  }
}

function handleVideoError() {
  videoError.value = true
}

// Keyboard navigation
function handleKeydown(e) {
  if (!props.isOpen)
    return

  switch (e.key) {
    case 'ArrowLeft':
      handlePrev()
      break
    case 'ArrowRight':
      handleNext()
      break
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  // 确保清理 modal-open 类和样式
  document.body.classList.remove('modal-open')
  document.body.style.top = ''
  // 如果组件销毁时弹窗是打开的，恢复滚动位置
  if (savedScrollY.value > 0) {
    window.scrollTo({ top: savedScrollY.value, behavior: 'instant' })
  }
})
</script>

<template>
  <!-- PC端桌面壁纸使用独立的桌面弹窗（带 MacBook 预览） -->
  <DesktopModal
    v-if="useDesktopModal"
    :wallpaper="wallpaper"
    :is-open="isOpen"
    :liked="liked"
    :collected="collected"
    :is-authenticated="isAuthenticated"
    :like-count="likeCount"
    :collect-count="collectCount"
    @close="emit('close')"
    @open-crop="openCropModal"
    @toggle-like="toggleLike"
    @toggle-collect="toggleCollect"
  />

  <!-- 移动端和其他情况使用原有弹窗 -->
  <Teleport v-else to="body">
    <div v-if="isOpen && wallpaper" ref="modalRef" class="modal-overlay">
      <div ref="contentRef" class="modal-content" :class="{ 'modal-content--horizontal': useHorizontalLayout }">
        <!-- Close Button -->
        <button class="modal-close" aria-label="关闭" @click="handleClose">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <!-- Navigation Buttons -->
        <button class="modal-nav modal-nav--prev" aria-label="上一张" @click="handlePrev">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <button class="modal-nav modal-nav--next" aria-label="下一张" @click="handleNext">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <!-- Image Container -->
        <div class="modal-image-container" :class="{ 'modal-image-container--video': isVideoWallpaper }">
          <template v-if="isVideoWallpaper">
            <div v-if="videoError" class="modal-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <p>视频加载失败</p>
            </div>
            <VideoWallpaperPlayer
              v-else
              :src="wallpaper.url"
              :poster="wallpaper.thumbnailUrl || wallpaper.previewUrl"
              @loadedmetadata="handleVideoLoadedMetadata"
              @error="handleVideoError"
            />
          </template>

          <template v-else>
            <!-- Loading -->
            <div v-if="!imageLoaded" class="modal-loading">
              <LoadingSpinner size="lg" />
              <p v-if="loadingOriginal" class="loading-text">
                正在加载原图...
              </p>
            </div>

            <!-- Error -->
            <div v-else-if="imageError" class="modal-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <p>图片加载失败</p>
            </div>

            <!-- Image -->
            <img
              v-show="imageLoaded && !imageError"
              :src="displayUrl"
              :alt="wallpaper.filename"
              width="1920"
              height="1080"
              class="modal-image"
              @load="handleImageLoad"
              @error="handleImageError"
            >

            <!-- 预览图标识 -->
            <div v-if="hasPreview && imageLoaded && !imageError && !showOriginal" class="preview-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>预览图</span>
            </div>

            <!-- 原图标识 -->
            <div v-if="hasPreview && imageLoaded && !imageError && showOriginal" class="original-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 3l14 9-14 9V3z" />
              </svg>
              <span>原图</span>
            </div>
          </template>
        </div>

        <!-- Info Panel -->
        <div ref="infoRef" class="modal-info">
          <!-- 图片加载中显示骨架屏 -->
          <template v-if="(!isVideoWallpaper && (!imageLoaded || imageError)) || (isVideoWallpaper && videoError)">
            <div class="info-skeleton">
              <div class="skeleton-title" />
              <div class="skeleton-tags">
                <div class="skeleton-tag" />
                <div class="skeleton-tag" />
                <div class="skeleton-tag" />
              </div>
              <div class="skeleton-details">
                <div class="skeleton-line" />
                <div class="skeleton-line" />
                <div class="skeleton-line" />
              </div>
              <div class="skeleton-btn" />
            </div>
          </template>

          <!-- 图片加载完成后显示真实信息 -->
          <template v-else>
            <div class="info-header">
              <!-- Bing 壁纸信息（使用独立组件） -->
              <BingWallpaperInfo
                v-if="isBingWallpaper"
                :wallpaper="wallpaper"
                :compact="useCompactInfo"
              />
              <!-- 普通壁纸标题 -->
              <h3 v-if="!isBingWallpaper" class="info-title">
                {{ displayTitle }}
              </h3>
              <!-- 分类信息（普通壁纸） -->
              <div v-if="categoryDisplay && !isBingWallpaper" class="info-category">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span>{{ categoryDisplay }}</span>
              </div>
              <div class="info-tags">
                <!-- AI 标签（显示前3个关键词） -->
                <span v-for="tag in aiTags" :key="tag" class="tag tag--ai">
                  {{ tag }}
                </span>
                <!-- 紧凑布局显示原图清晰度，PC端显示预览图清晰度 -->
                <span v-if="useCompactInfo && originalResolution" class="tag" :class="[`tag--${originalResolution.type || 'success'}`]">{{ originalResolution.label }}</span>
                <span v-else class="tag" :class="[`tag--${resolution.type || 'success'}`]">{{ resolution.label }}</span>
                <span v-if="!isBingWallpaper" class="tag tag--secondary">{{ fileExt }}</span>
                <!-- 浏览量和下载量 -->
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
            </div>

            <!-- 移动端：原图信息卡片（突出显示高清质量） -->
            <div v-if="isMobile && originalResolution && !isBingWallpaper && !isVideoWallpaper" class="mobile-original-card">
              <div class="mobile-card-header">
                <span class="mobile-card-label">原图信息</span>
                <span class="mobile-resolution-tag" :class="[`tag--${originalResolution.type || 'success'}`]">
                  {{ originalResolution.label }}
                </span>
              </div>
              <div class="mobile-card-details">
                <div class="mobile-card-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                  <span class="mobile-card-value">{{ originalResolution.width }} × {{ originalResolution.height }}</span>
                </div>
                <div class="mobile-card-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  <span class="mobile-card-value">{{ formattedSize }}</span>
                </div>
              </div>
            </div>

            <div class="info-details" :class="{ 'info-details--compact': isMobile }">
              <!-- 移动端紧凑布局：上传时间 -->
              <template v-if="isMobile">
                <div class="detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>{{ formattedDate }}</span>
                  <span class="detail-sub">({{ relativeTime }})</span>
                </div>
              </template>

              <!-- PC端布局：显示预览图分辨率和日期，文件大小在原图卡片显示 -->
              <template v-else>
                <!-- 预览图分辨率尺寸 -->
                <div v-if="displayDimensions.width > 0" class="detail-item detail-item--highlight">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                  <span>{{ displayDimensions.width }} × {{ displayDimensions.height }}</span>
                  <span v-if="hasPreview && !showOriginal && !isVideoWallpaper" class="detail-label">预览图</span>
                </div>
                <!-- 上传日期 -->
                <div class="detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>{{ formattedDate }}</span>
                  <span class="detail-sub">({{ relativeTime }})</span>
                </div>
              </template>
            </div>

            <!-- 原图信息卡片（仅水平布局且有预览图时显示，突出原图质量吸引下载） -->
            <div v-if="useHorizontalLayout && hasPreview && originalResolution && !isBingWallpaper && !isVideoWallpaper" class="original-info-card">
              <div class="original-info-header">
                <span class="original-label">原图</span>
                <span class="original-resolution-tag" :class="[`tag--${originalResolution.type || 'success'}`]">
                  {{ originalResolution.label }}
                </span>
              </div>
              <div class="original-info-details">
                <div class="original-dimension">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                  <span>{{ originalResolution.width }} × {{ originalResolution.height }}</span>
                </div>
                <div class="original-size">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  <span>{{ formattedSize }}</span>
                </div>
              </div>
              <p class="original-hint">
                下载获取完整高清原图
              </p>
            </div>

            <!-- 操作按钮组 -->
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
                @toggle-like="toggleLike"
                @toggle-collect="toggleCollect"
              />

              <!-- 裁剪按钮（仅PC端 desktop 系列显示） -->
              <button
                v-if="showCropFeature"
                class="crop-btn"
                :disabled="!imageLoaded || imageError"
                @click="openCropModal"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 2v4M6 14v8M18 2v4M18 14v8M2 6h4M14 6h8M2 18h4M14 18h8" />
                </svg>
                <span>智能裁剪</span>
              </button>

              <!-- 下载按钮 -->
              <button
                class="download-btn"
                :disabled="downloading"
                @click="handleDownload"
              >
                <LoadingSpinner v-if="downloading" size="sm" />
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span>{{ downloading ? '下载中...' : (isVideoWallpaper ? '下载视频' : '下载原图') }}</span>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 裁剪弹窗 -->
  <ImageCropModal
    v-if="wallpaper && !isVideoWallpaper"
    :image-url="wallpaper.url"
    :filename="wallpaper.filename"
    :is-open="isCropModalOpen"
    :original-resolution="originalResolution"
    @close="closeCropModal"
  />
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-modal);
  backdrop-filter: blur(12px);
  padding: $spacing-sm;

  @include desktop-up {
    padding: $spacing-lg;
  }
}

.modal-content {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 95vw;
  max-height: 95vh;
  background: linear-gradient(180deg, rgba(22, 32, 54, 0.98), rgba(14, 22, 38, 0.96));
  border: 1px solid rgba(96, 165, 250, 0.14);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow:
    0 30px 80px rgba(2, 8, 23, 0.46),
    inset 0 1px 0 rgba(191, 219, 254, 0.08);

  // 平板竖屏：垂直布局，更宽
  @include tablet-only {
    max-width: 90vw;
    max-height: 90vh;
  }

  // 水平布局模式（桌面端，或平板横屏时由 JS 动态添加）
  &--horizontal {
    flex-direction: row;
    max-width: 1400px;
    max-height: 90vh;

    @include large-desktop-up {
      max-width: 1600px;
    }
  }
}

.modal-close {
  position: absolute;
  top: $spacing-md;
  right: $spacing-md;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: $radius-full;
  color: white;
  transition: all var(--transition-fast);

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    transform: scale(1.1);
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

.modal-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: $radius-full;
  color: white;
  transition: all var(--transition-fast);

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    transform: translateY(-50%) scale(1.1);
  }

  svg {
    width: 24px;
    height: 24px;
  }

  &--prev {
    left: $spacing-md;
  }

  &--next {
    right: $spacing-md;
  }

  // 移动端：较小的按钮
  @include mobile-only {
    width: 40px;
    height: 40px;

    svg {
      width: 20px;
      height: 20px;
    }
  }
}

// 水平布局时，下一张按钮需要偏移（信息面板在右侧）
.modal-content--horizontal .modal-nav--next {
  right: calc(320px + $spacing-lg);
}

.modal-image-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 300px; // 垂直布局初始高度
  max-height: 60vh; // 垂直布局限制图片区域高度
  background: linear-gradient(180deg, rgba(8, 13, 24, 0.98), rgba(11, 18, 32, 0.94));
  overflow: hidden;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;

  // 平板竖屏：稍大的图片区域
  @include tablet-only {
    min-height: 400px;
    max-height: 65vh;
  }
}

.modal-image-container--video {
  padding: $spacing-xl;

  @include mobile-only {
    padding: $spacing-md;
  }
}

// 水平布局时的图片容器样式
.modal-content--horizontal .modal-image-container {
  min-width: 600px;
  min-height: 500px;
  max-height: none;
  border-radius: var(--radius-xl) 0 0 var(--radius-xl);

  @include large-desktop-up {
    min-width: 800px;
  }
}

.modal-loading,
.modal-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-md;
  color: var(--color-text-muted);

  svg {
    width: 48px;
    height: 48px;
  }
}

.loading-text {
  font-size: $font-size-sm;
  color: var(--color-text-secondary);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.modal-image {
  max-width: 100%;
  max-height: 100%; // 垂直布局限制在容器内
  object-fit: contain;
  opacity: 0;
  animation: imageReveal 0.5s ease forwards;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}

// 水平布局时的图片样式
.modal-content--horizontal .modal-image {
  max-height: 85vh;
  border-radius: var(--radius-xl) 0 0 var(--radius-xl);
}

@keyframes imageReveal {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

// 预览图/原图标识
.preview-badge,
.original-badge {
  position: absolute;
  bottom: $spacing-md;
  left: $spacing-md;
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: 6px $spacing-sm;
  border-radius: $radius-sm;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;

  svg {
    width: 14px;
    height: 14px;
  }
}

.preview-badge {
  background: rgba(59, 130, 246, 0.9);
  color: white;
}

.original-badge {
  background: rgba(16, 185, 129, 0.9);
  color: white;
}

.modal-info {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
  padding: $spacing-lg;
  background: linear-gradient(180deg, rgba(18, 28, 47, 0.96), rgba(14, 22, 38, 0.94));
  overflow-y: auto; // 允许滚动查看所有内容

  // 移动端底部圆角 + 增加间距（不再过于紧凑）
  @include mobile-only {
    gap: $spacing-md;
    padding: $spacing-md $spacing-lg;
    padding-bottom: max($spacing-lg, env(safe-area-inset-bottom)); // 适配底部安全区域
    border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  }

  // 平板竖屏：适中间距
  @include tablet-only {
    gap: $spacing-md;
    padding: $spacing-lg;
  }
}

// 水平布局时的信息面板样式
.modal-content--horizontal .modal-info {
  width: 320px;
  min-width: 320px;
  border-left: 1px solid rgba(96, 165, 250, 0.14);
  padding: $spacing-xl;
  border-radius: 0 var(--radius-xl) var(--radius-xl) 0;
}

.info-header {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.info-title {
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
  word-break: break-all;
}

.info-category {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  margin-top: $spacing-xs;
  margin-bottom: $spacing-sm;
  font-size: $font-size-sm;
  color: var(--color-text-secondary);
  font-weight: $font-weight-medium;

  svg {
    width: 16px;
    height: 16px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }
}

.info-tags {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
}

.tag {
  padding: 4px $spacing-sm;
  font-size: $font-size-xs;
  font-weight: $font-weight-bold;
  border-radius: $radius-sm;
  letter-spacing: 0.3px;

  &--ai {
    background: linear-gradient(180deg, rgba(34, 47, 76, 0.94), rgba(23, 33, 56, 0.9));
    color: #dbeafe;
    border: 1px solid rgba(96, 165, 250, 0.2);
    box-shadow: inset 0 1px 0 rgba(191, 219, 254, 0.06);
    font-weight: $font-weight-semibold;
    position: relative;

    &::before {
      content: '✨';
      margin-right: 4px;
      font-size: 10px;
    }
  }

  &--primary {
    background: rgba(37, 99, 235, 0.22);
    color: #93c5fd;
    border: 1px solid rgba(96, 165, 250, 0.22);
  }

  &--success {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  &--warning {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  &--info {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  &--danger {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  &--secondary {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(226, 232, 240, 0.76);
    border: 1px solid rgba(148, 163, 184, 0.12);
  }

  &--view {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
    font-weight: $font-weight-bold;

    svg {
      width: 12px;
      height: 12px;
    }
  }

  &--download {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    font-weight: $font-weight-bold;

    svg {
      width: 12px;
      height: 12px;
    }
  }

  &--collect {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;

    svg {
      width: 12px;
      height: 12px;
    }
  }

  &--like {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(244, 63, 94, 0.15);
    color: #fb7185;

    svg {
      width: 12px;
      height: 12px;
    }
  }

  &--dark {
    background: rgba(0, 0, 0, 0.6);
    color: white;
  }
}

.info-details {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding: $spacing-md;
  background: linear-gradient(180deg, rgba(34, 47, 76, 0.8), rgba(22, 31, 52, 0.76));
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: var(--radius-md);
  box-shadow: inset 0 1px 0 rgba(191, 219, 254, 0.05);

  // 移动端布局（增加间距，不再过于紧凑）
  &--compact {
    gap: $spacing-sm;
    padding: $spacing-md;
  }
}

// 移动端原图信息卡片（类似 PC 端，突出显示高清质量）
.mobile-original-card {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  padding: $spacing-md;
  background: linear-gradient(180deg, rgba(39, 56, 88, 0.96), rgba(23, 34, 58, 0.92));
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: var(--radius-md);
  margin-bottom: $spacing-sm;
  box-shadow:
    0 14px 28px rgba(2, 8, 23, 0.24),
    inset 0 1px 0 rgba(191, 219, 254, 0.08);

  // 移动端更紧凑的视觉效果
  @include mobile-only {
    padding: $spacing-sm $spacing-md;
  }
}

.mobile-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mobile-card-label {
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  color: rgba(191, 219, 254, 0.56);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mobile-resolution-tag {
  padding: 4px 10px;
  font-size: $font-size-sm;
  font-weight: $font-weight-bold;
  border-radius: $radius-sm;
  letter-spacing: 0.3px;

  &.tag--danger {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  &.tag--warning {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
  }

  &.tag--info {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  &.tag--success {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  &.tag--primary {
    background: rgba(37, 99, 235, 0.24);
    color: #bfdbfe;
    border: 1px solid rgba(96, 165, 250, 0.2);
  }
}

.mobile-card-details {
  display: flex;
  gap: $spacing-md;
}

.mobile-card-item {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;

  svg {
    width: 16px;
    height: 16px;
    color: var(--color-accent);
    flex-shrink: 0;
  }
}

.mobile-card-value {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: #f8fafc;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  font-size: $font-size-sm;
  color: rgba(226, 232, 240, 0.76);

  svg {
    width: 18px;
    height: 18px;
    color: rgba(191, 219, 254, 0.46);
    flex-shrink: 0;
  }

  &--highlight {
    color: #f8fafc;
    font-weight: $font-weight-medium;

    svg {
      color: var(--color-accent);
    }
  }
}

.detail-sub {
  font-size: $font-size-xs;
  color: rgba(191, 219, 254, 0.44);
  margin-left: 2px;
}

// 预览图标签
.detail-label {
  font-size: $font-size-xs;
  color: rgba(191, 219, 254, 0.5);
  margin-left: $spacing-xs;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 4px;
}

// 原图信息卡片（突出显示原图质量，吸引用户下载）
.original-info-card {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  padding: $spacing-md;
  background: linear-gradient(180deg, rgba(39, 56, 88, 0.96), rgba(23, 34, 58, 0.92));
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: var(--radius-md);
  position: relative;
  overflow: hidden;
  box-shadow:
    0 16px 30px rgba(2, 8, 23, 0.26),
    inset 0 1px 0 rgba(191, 219, 254, 0.08);

  // 装饰性光晕
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -50%;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle, rgba(var(--color-accent-rgb), 0.15) 0%, transparent 70%);
    pointer-events: none;
  }
}

.original-info-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  position: relative;
  z-index: 1;
}

.original-label {
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  color: rgba(191, 219, 254, 0.56);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.original-resolution-tag {
  padding: 4px 10px;
  font-size: $font-size-md;
  font-weight: $font-weight-bold;
  border-radius: $radius-sm;
  letter-spacing: 0.5px;

  &.tag--danger {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  &.tag--warning {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
  }

  &.tag--info {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  &.tag--success {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  &.tag--primary {
    background: rgba(37, 99, 235, 0.24);
    color: #bfdbfe;
    border: 1px solid rgba(96, 165, 250, 0.2);
  }
}

.original-info-details {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-md;
  position: relative;
  z-index: 1;
}

.original-dimension,
.original-size {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: #f8fafc;

  svg {
    width: 16px;
    height: 16px;
    color: var(--color-accent);
  }
}

.original-hint {
  font-size: $font-size-xs;
  color: rgba(191, 219, 254, 0.46);
  margin: 0;
  position: relative;
  z-index: 1;
}

// 浏览量和下载量标签样式已移至 .tag--view 和 .tag--download

// 操作按钮组
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  margin-top: auto;
}

// 裁剪按钮
.crop-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  width: 100%;
  padding: $spacing-md;
  background: linear-gradient(180deg, rgba(34, 47, 76, 0.96), rgba(23, 33, 56, 0.92));
  color: #dbeafe;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  border-radius: var(--radius-md);
  border: 1px solid rgba(96, 165, 250, 0.2);
  box-shadow: inset 0 1px 0 rgba(191, 219, 254, 0.08);
  transition: all var(--transition-fast);

  &:hover:not(:disabled) {
    background: linear-gradient(180deg, rgba(43, 61, 96, 0.98), rgba(29, 41, 68, 0.94));
    border-color: rgba(96, 165, 250, 0.28);
    box-shadow:
      inset 0 1px 0 rgba(191, 219, 254, 0.1),
      0 14px 28px rgba(2, 8, 23, 0.26);
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 18px;
    height: 18px;
  }
}

.download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  width: 100%;
  padding: $spacing-md;
  background: var(--accent-gradient);
  color: white;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  border: none;
  border-radius: var(--radius-md);
  box-shadow: 0 16px 30px var(--accent-shadow);
  transition: all var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--accent-gradient-hover);
    box-shadow: 0 20px 38px var(--accent-shadow-strong);
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  svg {
    width: 18px;
    height: 18px;
  }
}

// 骨架屏样式
.info-skeleton {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.skeleton-title {
  height: 24px;
  width: 80%;
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  animation: skeletonPulse 1.5s ease-in-out infinite;
}

.skeleton-tags {
  display: flex;
  gap: $spacing-xs;
}

.skeleton-tag {
  height: 24px;
  width: 50px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: $radius-sm;
  animation: skeletonPulse 1.5s ease-in-out infinite;

  &:nth-child(2) {
    width: 40px;
    animation-delay: 0.1s;
  }

  &:nth-child(3) {
    width: 35px;
    animation-delay: 0.2s;
  }
}

.skeleton-details {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding: $spacing-md;
  background: linear-gradient(180deg, rgba(34, 47, 76, 0.8), rgba(22, 31, 52, 0.76));
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: var(--radius-md);
}

.skeleton-line {
  height: 18px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  animation: skeletonPulse 1.5s ease-in-out infinite;

  &:nth-child(1) {
    width: 70%;
  }

  &:nth-child(2) {
    width: 50%;
    animation-delay: 0.1s;
  }

  &:nth-child(3) {
    width: 60%;
    animation-delay: 0.2s;
  }
}

.skeleton-btn {
  height: 48px;
  width: 100%;
  background: linear-gradient(180deg, rgba(34, 47, 76, 0.96), rgba(23, 33, 56, 0.92));
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: var(--radius-md);
  animation: skeletonPulse 1.5s ease-in-out infinite;
  margin-top: auto;
}

@keyframes skeletonPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
