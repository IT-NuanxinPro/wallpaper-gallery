<script setup>
import { gsap } from 'gsap'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useDevice } from '@/composables/useDevice'
import { IMAGE_PROXY } from '@/utils/constants'
import { formatFileSize, getDisplayFilename, highlightText } from '@/utils/format'

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

// 直接使用 JSON 中的 thumbnailUrl，如果加载失败则使用代理服务
const thumbnailUrl = computed(() => {
  if (useProxy.value) {
    // 使用代理服务生成缩略图
    return `${IMAGE_PROXY.BASE_URL}?url=${encodeURIComponent(props.wallpaper.url)}&w=${IMAGE_PROXY.THUMB_WIDTH}&q=${IMAGE_PROXY.THUMB_QUALITY}&output=${IMAGE_PROXY.FORMAT}`
  }
  return props.wallpaper.thumbnailUrl || props.wallpaper.url
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

// 组件卸载时清除定时器
onUnmounted(() => {
  if (cacheCheckTimer) {
    clearTimeout(cacheCheckTimer)
    cacheCheckTimer = null
  }
})

const formattedSize = computed(() => formatFileSize(props.wallpaper.size))
const fileFormat = computed(() => {
  const ext = props.wallpaper.filename.split('.').pop()?.toUpperCase() || ''
  return ext
})

// 显示用的文件名（去除分类前缀）
const displayFilename = computed(() => getDisplayFilename(props.wallpaper.filename))

// 高亮文件名（对显示名称进行高亮）
const highlightedFilename = computed(() => {
  return highlightText(displayFilename.value, props.searchQuery)
})

// 计算卡片图片样式 - 动态宽高比
const cardImageStyle = computed(() => {
  if (props.viewMode === 'masonry')
    return {} // 瀑布流不固定比例
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
        loading="lazy"
        :class="{ 'is-loaded': imageLoaded, 'is-error': imageError }"
        @load="handleImageLoad"
        @error="handleImageError"
      >

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
      <p class="card-filename" :title="displayFilename">
        <template v-for="(part, idx) in highlightedFilename" :key="idx">
          <span v-if="part.highlight" class="highlight">{{ part.text }}</span>
          <span v-else>{{ part.text }}</span>
        </template>
      </p>
      <div class="card-meta">
        <span class="meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          {{ formattedSize }}
        </span>
        <span class="meta-item meta-format">
          {{ fileFormat }}
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.wallpaper-card {
  position: relative;
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  will-change: transform, box-shadow;
  // 添加过渡效果，让圆角变化更平滑
  transition: border-radius 0.4s ease;

  // 移动端瀑布流和网格视图更紧凑的圆角
  @include mobile-only {
    &.view-grid,
    &.view-masonry {
      border-radius: var(--radius-sm);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
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
  backdrop-filter: blur(8px);

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

.card-filename {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: $spacing-xs;

  .highlight {
    background: rgba(229, 62, 62, 0.1);
    color: #e53e3e;
    font-weight: $font-weight-semibold;
    padding: 1px 4px;
    border-radius: 3px;
  }
}

.card-meta {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  font-size: $font-size-xs;
  color: var(--color-text-muted);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;

  svg {
    width: 12px;
    height: 12px;
  }
}

.meta-format {
  padding: 2px 6px;
  background: var(--color-bg-hover);
  border-radius: $radius-sm;
  font-weight: $font-weight-medium;
  font-size: 10px;
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
</style>
