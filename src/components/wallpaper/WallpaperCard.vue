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
  popularRank: {
    type: Number,
    default: 0,
  },
  downloadCount: {
    type: Number,
    default: 0,
  },
  viewCount: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['click', 'imageLoad'])
const { isMobile } = useDevice()

const cardRef = ref(null)
const imageRef = ref(null)
const imageLoaded = ref(false)
const imageError = ref(false)
const useProxy = ref(false)

let cacheCheckTimer = null
let gsapTargets = []

const thumbnailUrl = computed(() => {
  if (useProxy.value) {
    return `${IMAGE_PROXY.BASE_URL}?url=${encodeURIComponent(props.wallpaper.url)}&w=${IMAGE_PROXY.THUMB_WIDTH}&q=${IMAGE_PROXY.THUMB_QUALITY}&output=${IMAGE_PROXY.FORMAT}`
  }
  return props.wallpaper.previewUrl || props.wallpaper.thumbnailUrl || props.wallpaper.url
})

onMounted(() => {
  cacheCheckTimer = setTimeout(() => {
    if (imageRef.value && imageRef.value.complete && imageRef.value.naturalWidth > 0) {
      imageLoaded.value = true
    }
  }, 0)
})

onUnmounted(() => {
  if (cacheCheckTimer) {
    clearTimeout(cacheCheckTimer)
    cacheCheckTimer = null
  }

  if (gsapTargets.length > 0) {
    gsapTargets.forEach(target => gsap.killTweensOf(target))
    gsapTargets = []
  }

  if (cardRef.value) {
    gsap.killTweensOf(cardRef.value)
  }
})

const formattedSize = computed(() => formatFileSize(props.wallpaper.size))
const fileFormat = computed(() => props.wallpaper.filename.split('.').pop()?.toUpperCase() || '')
const relativeTime = computed(() => formatRelativeTime(props.wallpaper.createdAt))
const displayFilename = computed(() => {
  if (props.wallpaper.displayTitle) {
    return props.wallpaper.displayTitle.replace(/\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|tif|ico|heic|heif)$/i, '')
  }
  return getDisplayFilename(props.wallpaper.filename)
})
const aiKeywords = computed(() => props.wallpaper.keywords?.slice(0, 3) || [])
const highlightedFilename = computed(() => highlightText(displayFilename.value, props.searchQuery))
const categoryDisplay = computed(() => {
  const { category, subcategory } = props.wallpaper
  if (!category)
    return ''
  return subcategory ? `${category} / ${subcategory}` : category
})

const isBingWallpaper = computed(() => props.wallpaper?.isBing === true)
const bingTitle = computed(() => props.wallpaper?.title || '')

const imageAlt = computed(() => {
  if (isBingWallpaper.value && props.wallpaper.title)
    return `${props.wallpaper.title} - Bing每日壁纸`
  const parts = [displayFilename.value]
  if (categoryDisplay.value)
    parts.push(categoryDisplay.value)
  if (aiKeywords.value.length > 0)
    parts.push(aiKeywords.value.join(' '))
  return `${parts.join(' - ')} 高清壁纸`
})
const bingDate = computed(() => props.wallpaper?.date ? formatBingDate(props.wallpaper.date) : '')
const bingCopyright = computed(() => {
  if (!props.wallpaper?.copyright)
    return ''
  const copyright = props.wallpaper.copyright
  const parenIndex = copyright.indexOf('(')
  return parenIndex > 0 ? copyright.substring(0, parenIndex).trim() : copyright
})

const normalizedAspectRatio = computed(() => props.aspectRatio.replace('/', ' / '))
const cardImageStyle = computed(() => ({ aspectRatio: normalizedAspectRatio.value }))

const listImageStyle = computed(() => {
  if (isMobile.value) {
    return {
      width: '100px',
      height: '100px',
      aspectRatio: '1 / 1',
    }
  }
  const [w, h] = props.aspectRatio.split('/').map(Number)
  const ratio = w / h
  const baseWidth = ratio >= 1 ? 200 : 120
  return {
    width: `${baseWidth}px`,
    aspectRatio: normalizedAspectRatio.value,
  }
})

function handleImageLoad() {
  imageLoaded.value = true
  imageError.value = false
  emit('imageLoad')
}

function handleImageError() {
  if (!useProxy.value) {
    useProxy.value = true
    imageLoaded.value = false
  }
  else {
    imageError.value = true
    imageLoaded.value = true
  }
}

function handleClick() {
  emit('click', props.wallpaper)
}

function handleMouseEnter(e) {
  if (isMobile.value)
    return

  const card = e.currentTarget
  const overlay = card.querySelector('.card-overlay')
  const img = card.querySelector('.card-image img')

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
        :alt="imageAlt"
        width="800"
        height="600"
        loading="lazy"
        :fetchpriority="index < 6 ? 'high' : 'auto'"
        :class="{ 'is-loaded': imageLoaded, 'is-error': imageError }"
        @load="handleImageLoad"
        @error="handleImageError"
      >

      <!-- 分类标签 -->
      <div v-if="categoryDisplay && viewMode === 'grid' && !isBingWallpaper" class="card-category-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span>{{ categoryDisplay }}</span>
      </div>

      <!-- Bing 壁纸日期标签 -->
      <div v-if="isBingWallpaper && viewMode === 'grid'" class="card-bing-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{{ bingDate }}</span>
      </div>

      <!-- Overlay on hover -->
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
      <template v-if="isBingWallpaper">
        <p class="card-filename card-bing-title" :title="bingTitle">
          {{ bingTitle }}
        </p>
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
        <div v-if="bingCopyright" class="card-bing-copyright" :title="wallpaper.copyright">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M14.83 14.83a4 4 0 1 1 0-5.66" />
          </svg>
          <span>{{ bingCopyright }}</span>
        </div>
      </template>

      <template v-else>
        <div class="card-filename-row">
          <p class="card-filename" :title="displayFilename">
            <template v-for="(part, idx) in highlightedFilename" :key="idx">
              <span v-if="part.highlight" class="highlight">{{ part.text }}</span>
              <span v-else>{{ part.text }}</span>
            </template>
          </p>
        </div>

        <div v-if="aiKeywords.length > 0" class="card-ai-keywords">
          <span v-for="keyword in aiKeywords" :key="keyword" class="ai-keyword-tag">
            {{ keyword }}
          </span>
        </div>

        <div v-if="categoryDisplay" class="card-category">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>{{ categoryDisplay }}</span>
        </div>
        <div class="card-meta">
          <span class="meta-item">{{ formattedSize }}</span>
          <span v-if="viewCount > 0" class="meta-item meta-views">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {{ formatNumber(viewCount) }}
          </span>
          <span v-if="downloadCount > 0" class="meta-item meta-downloads">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            {{ formatNumber(downloadCount) }}
          </span>
        </div>
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
  box-shadow:
    0 2px 4px rgba(102, 126, 234, 0.08),
    0 4px 12px rgba(102, 126, 234, 0.12),
    0 8px 24px rgba(102, 126, 234, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  backface-visibility: hidden;
  transition:
    background 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    border-radius 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.12));
    border-color: rgba(102, 126, 234, 0.3);
    box-shadow:
      0 4px 8px rgba(102, 126, 234, 0.12),
      0 8px 20px rgba(102, 126, 234, 0.15),
      0 16px 32px rgba(102, 126, 234, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    transform: translateY(-4px);
  }

  @include mobile-only {
    &.view-grid {
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
}

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

  @include mobile-only {
    .view-grid & {
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

.card-category-badge {
  position: absolute;
  bottom: $spacing-xs;
  left: $spacing-xs;
  right: $spacing-xs;
  z-index: 4;
  display: none;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  font-size: 10px;
  font-weight: $font-weight-medium;
  border-radius: $radius-sm;
  max-width: calc(100% - #{$spacing-xs} * 2);

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

.wallpaper-card.view-list {
  display: flex;
  flex-direction: row;
  align-items: center;

  .card-image {
    flex-shrink: 0;

    @include mobile-only {
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

.card-bing-badge {
  position: absolute;
  bottom: $spacing-xs;
  left: $spacing-xs;
  z-index: 4;
  display: none;
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
