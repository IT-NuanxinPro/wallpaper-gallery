<script setup>
import { gsap } from 'gsap'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useDevice } from '@/composables/useDevice'
import { IMAGE_PROXY } from '@/utils/constants'
import { formatBingDate, formatFileSize, formatNumber, formatRelativeTime, getDisplayFilename, highlightText } from '@/utils/format'

const props = defineProps({
  wallpaper: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    default: 0,
  },
  searchQuery: {
    type: String,
    default: '',
  },
  viewMode: {
    type: String,
    default: 'grid',
  },
  aspectRatio: {
    type: String,
    default: '16/10',
  },
  // 热门排名（0表示不是热门）
  popularRank: {
    type: Number,
    default: 0,
  },
  // 下载次数
  downloadCount: {
    type: Number,
    default: 0,
  },
  // 访问量
  viewCount: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['click', 'imageLoad'])

// 设备检测
const { isMobile } = useDevice()

const cardRef = ref(null)
const imageRef = ref(null)
const imageLoaded = ref(false)
const imageError = ref(false)
const useProxy = ref(false)

// 定时器引用（用于组件卸载时清理）
let cacheCheckTimer = null
// GSAP 动画目标引用（用于组件卸载时清理）
let gsapTargets = []

// 根据系列类型智能选择显示URL：
// - mobile 系列使用 previewUrl（1080px 预览图，更清晰适合长屏）
// - avatar 和 desktop 使用 thumbnailUrl（550px 缩略图，加载更快）
// - 如果加载失败则使用代理服务
const thumbnailUrl = computed(() => {
  if (useProxy.value) {
    // 使用代理服务生成缩略图
    return `${IMAGE_PROXY.BASE_URL}?url=${encodeURIComponent(props.wallpaper.url)}&w=${IMAGE_PROXY.THUMB_WIDTH}&q=${IMAGE_PROXY.THUMB_QUALITY}&output=${IMAGE_PROXY.FORMAT}`
  }
  // 优先使用 previewUrl（mobile 长屏），其次 thumbnailUrl，最后 url
  return props.wallpaper.previewUrl || props.wallpaper.thumbnailUrl || props.wallpaper.url
})

// 检查图片是否已在浏览器缓存中
onMounted(() => {
  // 使用 nextTick 确保 DOM 已渲染
  cacheCheckTimer = setTimeout(() => {
    if (imageRef.value && imageRef.value.complete && imageRef.value.naturalWidth > 0) {
      // 图片已经加载完成（从缓存中）
      imageLoaded.value = true
    }
  }, 0)
})

// 组件卸载时清除定时器和 GSAP 动画
onUnmounted(() => {
  if (cacheCheckTimer) {
    clearTimeout(cacheCheckTimer)
    cacheCheckTimer = null
  }

  // 清理所有 GSAP 动画，防止内存泄漏
  if (gsapTargets.length > 0) {
    gsapTargets.forEach(target => gsap.killTweensOf(target))
    gsapTargets = []
  }

  // 清理卡片本身的动画
  if (cardRef.value) {
    gsap.killTweensOf(cardRef.value)
  }
})

const formattedSize = computed(() => formatFileSize(props.wallpaper.size))
const fileFormat = computed(() => {
  const ext = props.wallpaper.filename.split('.').pop()?.toUpperCase() || ''
  return ext
})

// 相对时间（如"3天前"）
const relativeTime = computed(() => formatRelativeTime(props.wallpaper.createdAt))

// 显示用的文件名（优先使用 AI 生成的 displayTitle）
const displayFilename = computed(() => {
  // 优先使用 AI 生成的标题
  if (props.wallpaper.displayTitle) {
    // 去除常见的图片格式后缀名
    return props.wallpaper.displayTitle.replace(/\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|tif|ico|heic|heif)$/i, '')
  }
  return getDisplayFilename(props.wallpaper.filename)
})

// AI 关键词标签（显示前 3 个）
const aiKeywords = computed(() => {
  if (!props.wallpaper.keywords || props.wallpaper.keywords.length === 0) {
    return []
  }
  return props.wallpaper.keywords.slice(0, 3)
})

// 高亮文件名（对显示名称进行高亮）
const highlightedFilename = computed(() => {
  return highlightText(displayFilename.value, props.searchQuery)
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

// Bing 壁纸特有属性
const isBingWallpaper = computed(() => props.wallpaper?.isBing === true)
const bingTitle = computed(() => props.wallpaper?.title || '')
const bingDate = computed(() => {
  if (!props.wallpaper?.date)
    return ''
  return formatBingDate(props.wallpaper.date)
})
const bingCopyright = computed(() => {
  if (!props.wallpaper?.copyright)
    return ''
  // 简化版权信息，只显示主要内容
  const copyright = props.wallpaper.copyright
  const parenIndex = copyright.indexOf('(')
  return parenIndex > 0 ? copyright.substring(0, parenIndex).trim() : copyright
})

// 计算卡片图片样式 - 动态宽高比
const cardImageStyle = computed(() => {
  if (props.viewMode === 'masonry')
    return {} // 瀑布流不固定比例，让图片自适应高度
  return { aspectRatio: props.aspectRatio.replace('/', ' / ') }
})

// 列表视图图片样式
const listImageStyle = computed(() => {
  // 移动端使用正方形图片，更和谐
  if (isMobile.value) {
    return {
      width: '100px',
      height: '100px',
      aspectRatio: '1 / 1',
    }
  }
  // PC端保持原逻辑
  const [w, h] = props.aspectRatio.split('/').map(Number)
  const ratio = w / h
  const baseWidth = ratio >= 1 ? 200 : 120 // 横屏200px，竖屏120px
  return {
    width: `${baseWidth}px`,
    aspectRatio: props.aspectRatio.replace('/', ' / '),
  }
})

function handleImageLoad() {
  imageLoaded.value = true
  imageError.value = false
  emit('imageLoad')
}

function handleImageError() {
  // 只有在未使用代理时才尝试代理
  if (!useProxy.value) {
    useProxy.value = true
    imageLoaded.value = false
  }
  else {
    // 代理也失败了，显示错误
    imageError.value = true
    imageLoaded.value = true
  }
}

function handleClick() {
  emit('click', props.wallpaper)
}

// 悬停动画（仅 PC 端）
function handleMouseEnter(e) {
  // 移动端不需要悬浮效果
  if (isMobile.value)
    return

  const card = e.currentTarget
  const overlay = card.querySelector('.card-overlay')
  const img = card.querySelector('.card-image img')

  // 记录动画目标，便于清理
  gsapTargets = [card, overlay, img].filter(Boolean)

  gsap.to(card, {
    y: -10,
    boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
    duration: 0.3,
    ease: 'power2.out',
  })

  gsap.to(overlay, {
    opacity: 1,
    duration: 0.3,
  })

  if (img) {
    gsap.to(img, {
      scale: 1.1,
      duration: 0.4,
      ease: 'power2.out',
    })
  }
}

function handleMouseLeave(e) {
  // 移动端不需要悬浮效果
  if (isMobile.value)
    return

  const card = e.currentTarget
  const overlay = card.querySelector('.card-overlay')
  const img = card.querySelector('.card-image img')

  gsap.to(card, {
    y: 0,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    duration: 0.3,
    ease: 'power2.out',
    // 动画完成后清除内联样式，减少内存占用
    clearProps: 'transform',
  })

  gsap.to(overlay, {
    opacity: 0,
    duration: 0.3,
  })

  if (img) {
    gsap.to(img, {
      scale: 1,
      duration: 0.4,
      ease: 'power2.out',
      // 动画完成后清除内联样式
      clearProps: 'transform',
    })
  }
}
</script>

<template>
  <div
    ref="cardRef"
    class="wallpaper-card"
    :class="`view-${viewMode}`"
    :data-flip-id="wallpaper.id"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- Image Container -->
    <div class="card-image" :style="viewMode === 'list' ? listImageStyle : cardImageStyle">
      <!-- 热门标签 -->
      <div v-if="popularRank > 0 && popularRank <= 10" class="hot-badge" :class="{ 'hot-badge--top3': popularRank <= 3 }">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
        <span>🔥 热门</span>
      </div>

      <!-- Skeleton 骨架屏 -->
      <div v-if="!imageLoaded" class="image-skeleton">
        <div class="skeleton-shimmer" />
      </div>

      <!-- Error State -->
      <div v-if="imageError && imageLoaded" class="image-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span>加载失败</span>
      </div>

      <!-- Image -->
      <img
        ref="imageRef"
        :src="thumbnailUrl"
        :alt="wallpaper.filename"
        width="800"
        height="600"
        loading="lazy"
        :fetchpriority="index < 6 ? 'high' : 'auto'"
        :class="{ 'is-loaded': imageLoaded, 'is-error': imageError }"
        @load="handleImageLoad"
        @error="handleImageError"
      >

      <!-- 分类标签（移动端网格/瀑布流视图显示在图片上，使用 CSS 控制显示避免 CLS） -->
      <div v-if="categoryDisplay && (viewMode === 'grid' || viewMode === 'masonry') && !isBingWallpaper" class="card-category-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span>{{ categoryDisplay }}</span>
      </div>

      <!-- Bing 壁纸日期标签（移动端显示在图片上，使用 CSS 控制显示避免 CLS） -->
      <div v-if="isBingWallpaper && (viewMode === 'grid' || viewMode === 'masonry')" class="card-bing-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{{ bingDate }}</span>
      </div>

      <!-- Overlay on hover (仅 PC 端显示) -->
      <div v-if="!isMobile" class="card-overlay">
        <div class="overlay-content">
          <span class="overlay-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
              <path d="M11 8v6M8 11h6" />
            </svg>
          </span>
          <span class="overlay-text">查看大图</span>
        </div>
      </div>
    </div>

    <!-- Card Info -->
    <div class="card-info">
      <!-- Bing 壁纸专用信息展示 -->
      <template v-if="isBingWallpaper">
        <!-- Bing 标题 -->
        <p class="card-filename card-bing-title" :title="bingTitle">
          {{ bingTitle }}
        </p>
        <!-- Bing 日期和版权 -->
        <div class="card-bing-meta">
          <span class="bing-date">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {{ bingDate }}
          </span>
          <span class="bing-resolution">4K</span>
        </div>
        <!-- 版权信息 -->
        <div v-if="bingCopyright" class="card-bing-copyright" :title="wallpaper.copyright">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M14.83 14.83a4 4 0 1 1 0-5.66" />
          </svg>
          <span>{{ bingCopyright }}</span>
        </div>
      </template>

      <!-- 普通壁纸信息展示 -->
      <template v-else>
        <!-- 第一行：文件名 (AI 标题优先) + AI 标识 -->
        <div class="card-filename-row">
          <p class="card-filename" :title="displayFilename">
            <template v-for="(part, idx) in highlightedFilename" :key="idx">
              <span v-if="part.highlight" class="highlight">{{ part.text }}</span>
              <span v-else>{{ part.text }}</span>
            </template>
          </p>
          <!-- AI 标识 -->
          <!-- <span v-if="hasAiInfo" class="ai-badge" title="AI 智能分析">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 3L5 7l4 4m6-8l4 4-4 4M13 21l-2-8-2 8" />
            </svg>
          </span> -->
        </div>

        <!-- AI 关键词标签 -->
        <div v-if="aiKeywords.length > 0" class="card-ai-keywords">
          <span v-for="keyword in aiKeywords" :key="keyword" class="ai-keyword-tag">
            {{ keyword }}
          </span>
        </div>

        <!-- 分类信息 -->
        <div v-if="categoryDisplay" class="card-category">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>{{ categoryDisplay }}</span>
        </div>
        <!-- 第二行：文件大小、访问量、下载量 -->
        <div class="card-meta">
          <span class="meta-item">{{ formattedSize }}</span>
          <!-- 访问量 -->
          <span v-if="viewCount > 0" class="meta-item meta-views">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {{ formatNumber(viewCount) }}
          </span>
          <!-- 下载次数 -->
          <span v-if="downloadCount > 0" class="meta-item meta-downloads">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            {{ formatNumber(downloadCount) }}
          </span>
        </div>
        <!-- 第三行：上传时间、格式标签 -->
        <div class="card-meta-secondary">
          <span class="meta-item meta-time">{{ relativeTime }}</span>
          <span class="meta-item meta-format">{{ fileFormat }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.wallpaper-card {
  position: relative;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08));
  border: 1px solid rgba(102, 126, 234, 0.15);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  // 多层阴影创建立体感
  box-shadow:
    0 2px 4px rgba(102, 126, 234, 0.08),
    0 4px 12px rgba(102, 126, 234, 0.12),
    0 8px 24px rgba(102, 126, 234, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  // 使用 backface-visibility 创建新的合成层，避免动画后的布局抖动
  backface-visibility: hidden;
  // 添加过渡效果，让圆角变化更平滑
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  // Hover 效果
  &:hover {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.12));
    border-color: rgba(102, 126, 234, 0.3);
    // Hover 时阴影更强，立体感更明显
    box-shadow:
      0 4px 8px rgba(102, 126, 234, 0.12),
      0 8px 20px rgba(102, 126, 234, 0.15),
      0 16px 32px rgba(102, 126, 234, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    transform: translateY(-4px);
  }

  // 移动端瀑布流和网格视图更紧凑的圆角
  @include mobile-only {
    &.view-grid,
    &.view-masonry {
      border-radius: var(--radius-sm);
      box-shadow:
        0 1px 3px rgba(102, 126, 234, 0.08),
        0 2px 8px rgba(102, 126, 234, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }
  }
}

.card-image {
  position: relative;
  overflow: hidden;
  background: var(--color-bg-hover);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.4s ease;
    will-change: transform;

    &.is-loaded {
      opacity: 1;
    }

    &.is-error {
      display: none;
    }
  }

  // 瀑布流模式：图片自适应高度，不使用 height: 100%
  .view-masonry & {
    img {
      height: auto;
    }
  }
}

// 热门标签
.hot-badge {
  position: absolute;
  top: $spacing-xs;
  left: $spacing-xs;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: white;
  font-size: 10px;
  font-weight: $font-weight-bold;
  border-radius: $radius-full;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);

  svg {
    width: 12px;
    height: 12px;
    display: none;
  }

  // Top 3 特殊样式
  &--top3 {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
  }
}

.image-skeleton {
  position: absolute;
  inset: 0;
  background: var(--color-bg-hover);
  overflow: hidden;

  .skeleton-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, var(--color-bg-card) 50%, transparent 100%);
    animation: shimmer 1.5s infinite;
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.image-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  color: var(--color-text-muted);

  svg {
    width: 32px;
    height: 32px;
  }

  span {
    font-size: $font-size-xs;
  }
}

.card-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  will-change: opacity;
}

.overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-sm;
  color: white;
}

.overlay-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: $radius-full;
  border: 1px solid rgba(255, 255, 255, 0.3);

  svg {
    width: 28px;
    height: 28px;
  }
}

.overlay-text {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  letter-spacing: 0.5px;
}

.card-info {
  padding: $spacing-md;

  // 移动端瀑布流和网格视图隐藏信息区域
  @include mobile-only {
    .view-grid &,
    .view-masonry & {
      display: none;
    }
  }
}

.card-filename-row {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  margin-bottom: $spacing-xs;
}

.card-filename {
  flex: 1;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0;

  .highlight {
    background: rgba(229, 62, 62, 0.1);
    color: #e53e3e;
    font-weight: $font-weight-semibold;
    padding: 1px 4px;
    border-radius: 3px;
  }
}

// AI 标识徽章
// .ai-badge {
//   display: flex;
//   align-items: center;
//   justify-content: center;
//   flex-shrink: 0;
//   width: 18px;
//   height: 18px;
//   background: linear-gradient(135deg, #667eea, #764ba2);
//   color: white;
//   border-radius: $radius-sm;
//   cursor: help;

//   svg {
//     width: 11px;
//     height: 11px;
//   }
// }

// AI 关键词标签
.card-ai-keywords {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: $spacing-xs;
}

.ai-keyword-tag {
  padding: 2px 6px;
  font-size: 10px;
  font-weight: $font-weight-medium;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
  color: #667eea;
  border-radius: $radius-sm;
  border: 1px solid rgba(102, 126, 234, 0.2);
  white-space: nowrap;

  [data-theme='dark'] & {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
    border-color: rgba(102, 126, 234, 0.3);
  }
}

.card-category {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: $spacing-xs;
  font-size: $font-size-xs;
  color: var(--color-text-secondary);
  font-weight: $font-weight-medium;

  svg {
    width: 12px;
    height: 12px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

// 移动端图片上的分类标签（使用 CSS 媒体查询控制显示，避免 JS hydration 导致的 CLS）
.card-category-badge {
  position: absolute;
  bottom: $spacing-xs;
  left: $spacing-xs;
  right: $spacing-xs;
  z-index: 4;
  display: none; // 默认隐藏
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  font-size: 10px;
  font-weight: $font-weight-medium;
  border-radius: $radius-sm;
  max-width: calc(100% - #{$spacing-xs} * 2);

  // 仅移动端显示（使用媒体查询避免 CLS）
  @include mobile-only {
    display: flex;
  }

  svg {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
  }

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.card-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $spacing-sm;
  font-size: $font-size-xs;
  color: var(--color-text-muted);
  margin-bottom: $spacing-xs;
}

.card-meta-secondary {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  font-size: $font-size-xs;
  color: var(--color-text-muted);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}

.meta-time {
  color: var(--color-text-muted);
}

.meta-format {
  padding: 3px 8px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
  color: #667eea;
  border-radius: $radius-sm;
  font-weight: $font-weight-semibold;
  font-size: 10px;
  border: 1px solid rgba(102, 126, 234, 0.2);

  [data-theme='dark'] & {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%);
    border-color: rgba(102, 126, 234, 0.3);
  }
}

.meta-views {
  color: var(--color-text-muted);

  svg {
    width: 12px;
    height: 12px;
  }
}

.meta-downloads {
  color: var(--color-text-muted);

  svg {
    width: 12px;
    height: 12px;
  }
}

// 列表视图模式
.wallpaper-card.view-list {
  display: flex;
  flex-direction: row;
  align-items: center;

  .card-image {
    flex-shrink: 0;
    // width 和 aspect-ratio 由 listImageStyle 动态控制

    @include mobile-only {
      // 移动端使用正方形图片
      width: 100px !important;
      height: 100px !important;
      border-radius: var(--radius-md);

      img {
        object-fit: cover;
        width: 100%;
        height: 100%;
      }
    }
  }

  .card-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: $spacing-md $spacing-lg;

    @include mobile-only {
      padding: $spacing-sm $spacing-md;
    }
  }

  .card-filename {
    font-size: $font-size-md;
    margin-bottom: $spacing-sm;
    // 列表模式下支持2行省略
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.4;

    @include mobile-only {
      font-size: $font-size-sm;
    }
  }

  .card-meta {
    gap: $spacing-lg;

    @include mobile-only {
      gap: $spacing-md;
      font-size: $font-size-xs;
    }
  }
}

// ========================================
// Bing 壁纸专用样式（高级感设计）
// ========================================

// Bing 日期标签（移动端图片上，使用 CSS 媒体查询控制显示避免 CLS）
.card-bing-badge {
  position: absolute;
  bottom: $spacing-xs;
  left: $spacing-xs;
  z-index: 4;
  display: none; // 默认隐藏
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: linear-gradient(135deg, rgba(0, 120, 212, 0.95), rgba(16, 110, 190, 0.95));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: white;
  font-size: 11px;
  font-weight: $font-weight-semibold;
  border-radius: $radius-md;
  box-shadow: 0 2px 12px rgba(0, 120, 212, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.2);

  // 仅移动端显示（使用媒体查询避免 CLS）
  @include mobile-only {
    display: flex;
  }

  svg {
    width: 12px;
    height: 12px;
  }
}

// Bing 标题样式
.card-bing-title {
  font-size: $font-size-sm;
  font-weight: $font-weight-bold;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: $spacing-sm;
  line-height: 1.5;
  letter-spacing: 0.2px;
}

// Bing 元信息（日期 + 分辨率）
.card-bing-meta {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
  font-size: $font-size-xs;

  .bing-date {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    background: linear-gradient(135deg, rgba(0, 120, 212, 0.12), rgba(16, 110, 190, 0.08));
    color: #0078d4;
    font-weight: $font-weight-semibold;
    border-radius: $radius-md;
    border: 1px solid rgba(0, 120, 212, 0.15);
    transition: all 0.2s ease;

    [data-theme='dark'] & {
      background: linear-gradient(135deg, rgba(0, 120, 212, 0.25), rgba(16, 110, 190, 0.2));
      border-color: rgba(0, 120, 212, 0.3);
      color: #4da6ff;
    }

    svg {
      width: 12px;
      height: 12px;
    }
  }

  .bing-resolution {
    padding: 4px 10px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    font-size: 10px;
    font-weight: $font-weight-bold;
    border-radius: $radius-md;
    box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
    letter-spacing: 0.5px;
  }
}

// Bing 版权信息
.card-bing-copyright {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--color-text-secondary);
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: $radius-md;
  margin-top: 2px;

  [data-theme='dark'] & {
    background: rgba(255, 255, 255, 0.05);
  }

  svg {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    color: var(--color-text-muted);
  }

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }
}
</style>
