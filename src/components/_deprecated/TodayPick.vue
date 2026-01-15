<script setup>
import { gsap } from 'gsap'
import { computed, onMounted, ref } from 'vue'
import { trackTodayPickClick } from '@/utils/analytics'

const props = defineProps({
  wallpapers: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['select'])

const containerRef = ref(null)
const imageLoaded = ref(false)
const imageError = ref(false)

// 根据日期计算今日壁纸
const todayWallpaper = computed(() => {
  if (!props.wallpapers.length)
    return null

  const today = new Date()
  const startOfYear = new Date(today.getFullYear(), 0, 0)
  const diff = today - startOfYear
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  const index = dayOfYear % props.wallpapers.length

  return props.wallpapers[index]
})

// 今日精选使用预览图（原图仅通过下载获取）
const imageUrl = computed(() => {
  if (!todayWallpaper.value)
    return ''
  return todayWallpaper.value.previewUrl || todayWallpaper.value.url
})

function handleClick() {
  if (todayWallpaper.value) {
    // 追踪今日精选点击
    trackTodayPickClick(todayWallpaper.value)
    emit('select', todayWallpaper.value)
  }
}

function handleImageLoad() {
  imageLoaded.value = true
  imageError.value = false
}

function handleImageError() {
  imageError.value = true
  // 保持 imageLoaded 为 false，让骨架屏继续显示，避免空出一大块
  imageLoaded.value = false
}

onMounted(() => {
  if (containerRef.value) {
    gsap.fromTo(
      containerRef.value,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.2 },
    )
  }
})
</script>

<template>
  <div v-if="todayWallpaper" ref="containerRef" class="today-pick">
    <div class="today-pick__header">
      <div class="today-pick__badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span>今日精选</span>
      </div>
      <span class="today-pick__date">{{ new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }) }}</span>
    </div>

    <div class="today-pick__content" @click="handleClick">
      <!-- Skeleton - 图片未加载成功时一直显示，避免空出一大块 -->
      <div v-if="!imageLoaded" class="image-skeleton">
        <div class="skeleton-shimmer" />
        <div class="skeleton-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <span>加载中...</span>
        </div>
      </div>

      <!-- Image -->
      <img
        v-show="imageLoaded && !imageError"
        :src="imageUrl"
        :alt="todayWallpaper.filename"
        width="1920"
        height="1080"
        class="today-pick__image"
        :class="{ 'is-loaded': imageLoaded }"
        @load="handleImageLoad"
        @error="handleImageError"
      >

      <!-- Overlay on hover -->
      <!-- <div class="today-pick__overlay">
        <div class="overlay-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M11 8v6M8 11h6" />
          </svg>
        </div>
        <span>查看大图</span>
      </div> -->
    </div>
  </div>
</template>

<style lang="scss" scoped>
.today-pick {
  margin-bottom: $spacing-xl;
  opacity: 0;
}

.today-pick__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-md;
}

.today-pick__badge {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-xs $spacing-md;
  background: linear-gradient(135deg, var(--color-accent), #a855f7);
  color: white;
  border-radius: $radius-full;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;

  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
    stroke: none;
  }
}

.today-pick__date {
  font-size: $font-size-sm;
  color: var(--color-text-muted);
}

.today-pick__content {
  position: relative;
  aspect-ratio: 21 / 9;
  min-height: 200px;
  border-radius: $radius-lg;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  background: var(--color-bg-secondary);

  @include mobile-only {
    min-height: 150px;
    aspect-ratio: 16 / 9;
  }

  // &:hover {
  //   .today-pick__overlay {
  //     opacity: 1;
  //   }

  //   .today-pick__image {
  //     transform: scale(1.03);
  //   }
  // }
}

.today-pick__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;

  &.is-loaded {
    opacity: 1;
  }
}

.image-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg-hover) 100%);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;

  .skeleton-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%);
    animation: shimmer 2s infinite;
  }

  .skeleton-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-sm;
    color: var(--color-text-muted);
    opacity: 0.6;
    z-index: 1;

    svg {
      width: 48px;
      height: 48px;
      animation: pulse 2s ease-in-out infinite;
    }

    span {
      font-size: $font-size-sm;
      animation: pulse 2s ease-in-out infinite;
    }
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.3;
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
    width: 48px;
    height: 48px;
  }

  span {
    font-size: $font-size-sm;
  }
}

.today-pick__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  background: rgba(0, 0, 0, 0.4);
  color: white;
  opacity: 0;
  transition: opacity 0.3s ease;

  .overlay-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: $radius-full;
    backdrop-filter: blur(8px);

    svg {
      width: 32px;
      height: 32px;
    }
  }

  span {
    font-size: $font-size-md;
    font-weight: $font-weight-medium;
  }
}
</style>
