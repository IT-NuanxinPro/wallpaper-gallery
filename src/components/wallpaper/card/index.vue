<script setup>
import { gsap } from 'gsap'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useDevice } from '@/composables/useDevice'
import { formatBingDate, formatFileSize, formatRelativeTime, getDisplayFilename, highlightText } from '@/utils/common/format'
import { IMAGE_PROXY } from '@/utils/config/constants'
import WallpaperCardInfo from './shared/WallpaperCardInfo.vue'
import WallpaperCardMedia from './shared/WallpaperCardMedia.vue'

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
    <WallpaperCardMedia
      :bing-date="bingDate"
      :category-display="categoryDisplay"
      :image-alt="imageAlt"
      :image-error="imageError"
      :image-loaded="imageLoaded"
      :image-ref="imageRef"
      :index="index"
      :is-bing-wallpaper="isBingWallpaper"
      :is-mobile="isMobile"
      :popular-rank="popularRank"
      :style="viewMode === 'list' ? listImageStyle : cardImageStyle"
      :thumbnail-url="thumbnailUrl"
      :view-mode="viewMode"
      @load="handleImageLoad"
      @error="handleImageError"
    />

    <WallpaperCardInfo
      :ai-keywords="aiKeywords"
      :bing-copyright="bingCopyright"
      :bing-date="bingDate"
      :bing-title="bingTitle"
      :category-display="categoryDisplay"
      :display-filename="displayFilename"
      :download-count="downloadCount"
      :file-format="fileFormat"
      :formatted-size="formattedSize"
      :highlighted-filename="highlightedFilename"
      :is-bing-wallpaper="isBingWallpaper"
      :relative-time="relativeTime"
      :view-count="viewCount"
      :view-mode="viewMode"
      :wallpaper-copyright="wallpaper.copyright || ''"
    />
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

.wallpaper-card.view-list {
  display: flex;
  flex-direction: row;
  align-items: center;
}
</style>
