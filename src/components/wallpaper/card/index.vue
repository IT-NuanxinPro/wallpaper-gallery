<script setup>
import { computed, ref, watch } from 'vue'
import { useDevice } from '@/composables/useDevice'
import { buildWallpaperImageFallbackUrls, formatBingDate, formatFileSize, formatRelativeTime, getDisplayFilename, highlightText } from '@/utils/common/format'
import { VIDEO_USAGE_SHORT_LABELS } from '@/utils/config/constants'
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

const imageLoaded = ref(false)
const imageError = ref(false)
const imageCandidateIndex = ref(0)
const isMediaHovered = ref(false)

const primaryImageUrl = computed(() => {
  if (props.wallpaper?.mediaType === 'video') {
    return props.wallpaper.thumbnailUrl || props.wallpaper.previewUrl || props.wallpaper.url
  }

  return props.wallpaper.previewUrl || props.wallpaper.thumbnailUrl || props.wallpaper.url
})
const candidateImageUrls = computed(() => buildWallpaperImageFallbackUrls({
  ...props.wallpaper,
  thumbnailUrl: props.wallpaper.thumbnailUrl,
  previewUrl: props.wallpaper.previewUrl,
  url: props.wallpaper.url,
}, { preferThumbnail: true }))

const thumbnailUrl = computed(() => {
  return candidateImageUrls.value[imageCandidateIndex.value] || primaryImageUrl.value
})

watch(() => props.wallpaper?.id, () => {
  imageCandidateIndex.value = 0
  imageLoaded.value = false
  imageError.value = false
})

const formattedSize = computed(() => formatFileSize(props.wallpaper.size))
const fileFormat = computed(() => props.wallpaper.filename.split('.').pop()?.toUpperCase() || '')
const relativeTime = computed(() => formatRelativeTime(props.wallpaper.createdAt))
const isVideoWallpaper = computed(() => props.wallpaper?.mediaType === 'video')
const displayFilename = computed(() => {
  if (props.wallpaper.displayTitle) {
    return props.wallpaper.displayTitle.replace(/\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|tif|ico|heic|heif|mp4|webm|mov|m4v)$/i, '')
  }
  return getDisplayFilename(props.wallpaper.filename)
})
const aiKeywords = computed(() => props.wallpaper.keywords?.slice(0, 3) || [])
const highlightedFilename = computed(() => highlightText(displayFilename.value, props.searchQuery))
const categoryDisplay = computed(() => {
  if (isVideoWallpaper.value) {
    const usageLabel = VIDEO_USAGE_SHORT_LABELS[props.wallpaper?.usage] || props.wallpaper?.usage || props.wallpaper?.category || ''
    const topic = props.wallpaper?.topic || props.wallpaper?.subcategory || '通用'
    return usageLabel ? `${usageLabel} / ${topic}` : topic
  }

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
  if (isVideoWallpaper.value) {
    const usageLabel = VIDEO_USAGE_SHORT_LABELS[props.wallpaper?.usage] || props.wallpaper?.usage || ''
    if (usageLabel) {
      parts.push(usageLabel)
    }
  }
  else if (categoryDisplay.value) {
    parts.push(categoryDisplay.value)
  }
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

const computedAspectRatio = computed(() => {
  if (isVideoWallpaper.value) {
    if (props.wallpaper?.usage === 'mobile') {
      return '9/16'
    }
    if (props.wallpaper?.usage === 'social-cover') {
      return '9/16'
    }
    return '16/9'
  }

  return props.aspectRatio
})
const normalizedAspectRatio = computed(() => computedAspectRatio.value.replace('/', ' / '))
const cardImageStyle = computed(() => ({ aspectRatio: normalizedAspectRatio.value }))

function handleImageLoad() {
  imageLoaded.value = true
  imageError.value = false
  emit('imageLoad')
}

function handleImageError() {
  if (imageCandidateIndex.value < candidateImageUrls.value.length - 1) {
    imageCandidateIndex.value += 1
    imageLoaded.value = false
    imageError.value = false
  }
  else {
    imageError.value = true
    imageLoaded.value = true
  }
}

function handleClick() {
  emit('click', props.wallpaper)
}

function handleMouseEnter() {
  if (!isMobile.value)
    isMediaHovered.value = true
}

function handleMouseLeave() {
  isMediaHovered.value = false
}
</script>

<template>
  <div
    class="wallpaper-card"
    :class="{ 'is-media-hovered': isMediaHovered }"
  >
    <WallpaperCardMedia
      :bing-date="bingDate"
      :category-display="categoryDisplay"
      :image-alt="imageAlt"
      :image-error="imageError"
      :image-loaded="imageLoaded"
      :index="index"
      :is-bing-wallpaper="isBingWallpaper"
      :is-video-wallpaper="isVideoWallpaper"
      :is-mobile="isMobile"
      :popular-rank="popularRank"
      :style="cardImageStyle"
      :thumbnail-url="thumbnailUrl"
      @click="handleClick"
      @load="handleImageLoad"
      @error="handleImageError"
      @hover-enter="handleMouseEnter"
      @hover-leave="handleMouseLeave"
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
      :is-video-wallpaper="isVideoWallpaper"
      :relative-time="relativeTime"
      :view-count="viewCount"
      :wallpaper-copyright="wallpaper.copyright || ''"
    />
  </div>
</template>

<style lang="scss" scoped>
.wallpaper-card {
  position: relative;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(239, 246, 255, 0.86)),
    radial-gradient(circle at top left, rgba(var(--color-accent-rgb), 0.18), transparent 58%),
    radial-gradient(circle at bottom right, rgba(var(--color-accent-secondary-rgb), 0.12), transparent 56%);
  border: 1px solid var(--accent-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow:
    0 14px 30px rgba(37, 99, 235, 0.08),
    0 24px 48px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.58);
  transition:
    transform 180ms ease-out,
    background 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    border-radius 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &::before {
    content: '';
    position: absolute;
    inset: 1px;
    border-radius: inherit;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0));
    pointer-events: none;
    z-index: 0;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    opacity: 0;
    z-index: 0;
    transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  > * {
    position: relative;
    z-index: 1;
  }

  [data-theme='dark'] & {
    background:
      linear-gradient(180deg, rgba(9, 16, 30, 0.98), rgba(6, 11, 22, 0.96)),
      linear-gradient(145deg, rgba(96, 165, 250, 0.14), rgba(14, 165, 233, 0.06) 42%, rgba(2, 6, 23, 0) 68%);
    border-color: rgba(96, 165, 250, 0.22);
    box-shadow:
      0 22px 44px rgba(2, 8, 23, 0.42),
      0 10px 24px rgba(37, 99, 235, 0.1),
      inset 0 1px 0 rgba(191, 219, 254, 0.09),
      inset 0 -1px 0 rgba(15, 23, 42, 0.52);

    &::before {
      background: linear-gradient(180deg, rgba(191, 219, 254, 0.1), rgba(255, 255, 255, 0));
    }

    &::after {
      opacity: 1;
      background:
        radial-gradient(circle at 14% 12%, rgba(96, 165, 250, 0.16), transparent 24%),
        radial-gradient(circle at 84% 88%, rgba(14, 165, 233, 0.12), transparent 26%);
    }
  }

  @media (hover: hover) and (pointer: fine) {
    &.is-media-hovered {
      transform: translateY(-4px);

      :deep(.card-overlay) {
        opacity: 1;
      }

      :deep(.card-image img) {
        transform: scale(1.035);
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &.is-media-hovered {
      transform: none;

      :deep(.card-image img) {
        transform: none;
      }
    }
  }

  &.is-media-hovered {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(219, 234, 254, 0.9)),
      radial-gradient(circle at top left, rgba(var(--color-accent-rgb), 0.24), transparent 52%),
      radial-gradient(circle at bottom right, rgba(var(--color-accent-secondary-rgb), 0.16), transparent 52%);
    border-color: var(--accent-border-strong);
    box-shadow:
      0 18px 36px rgba(37, 99, 235, 0.12),
      0 28px 56px rgba(15, 23, 42, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.66);
    transform: translateY(-4px);

    [data-theme='dark'] & {
      background:
        linear-gradient(180deg, rgba(11, 20, 36, 0.99), rgba(8, 14, 27, 0.96)),
        linear-gradient(145deg, rgba(96, 165, 250, 0.2), rgba(14, 165, 233, 0.1) 40%, rgba(2, 6, 23, 0) 66%);
      border-color: rgba(147, 197, 253, 0.26);
      box-shadow:
        0 28px 54px rgba(2, 8, 23, 0.46),
        0 14px 32px rgba(37, 99, 235, 0.14),
        inset 0 1px 0 rgba(191, 219, 254, 0.12),
        inset 0 -1px 0 rgba(15, 23, 42, 0.56);
    }
  }

  @include mobile-only {
    &.view-grid {
      border-radius: var(--radius-sm);
      box-shadow:
        0 10px 20px rgba(15, 23, 42, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.44);

      [data-theme='dark'] & {
        box-shadow:
          0 14px 26px rgba(2, 8, 23, 0.3),
          inset 0 1px 0 rgba(191, 219, 254, 0.06);
      }
    }
  }
}
</style>
