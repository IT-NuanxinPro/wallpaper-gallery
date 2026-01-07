<script setup>
/**
 * 热门壁纸轮播组件
 * 左侧大图轮播 + 右侧热门排行榜
 * 后续可升级为 3D 效果
 */
import { Autoplay, Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDevice } from '@/composables/useDevice'

// Swiper 样式
import 'swiper/css'
import 'swiper/css/pagination'

const props = defineProps({
  series: {
    type: String,
    default: 'desktop',
  },
  wallpapers: {
    type: Array,
    default: () => [],
  },
  popularityData: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select'])

const { isMobile } = useDevice()

// Swiper 实例引用
const swiperRef = ref(null)

// 排行榜动画状态
const rankingAnimated = ref(false)

// 轮播图图片加载状态 Map
const carouselImageLoaded = ref({})

// 排行榜图片加载状态 Map
const rankingImageLoaded = ref({})

// 定时器集合（用于清理）
const timers = new Set()

// Swiper 配置
const swiperModules = [Autoplay, Pagination]

// 轮播图列表（取前5张）- 必须有热门数据才显示，避免闪烁
const carouselList = computed(() => {
  // 必须同时有热门数据和壁纸数据才显示
  if (props.popularityData?.length && props.wallpapers?.length) {
    return props.popularityData
      .slice(0, 5)
      .map((stat) => {
        const wallpaper = props.wallpapers.find(w => w.filename === stat.filename)
        if (wallpaper) {
          return {
            ...wallpaper,
            downloadCount: stat.download_count || 0,
            viewCount: stat.view_count || 0,
            popularityScore: stat.popularity_score || 0,
          }
        }
        return null
      })
      .filter(Boolean)
  }

  // 没有热门数据时返回空数组，显示骨架屏
  return []
})

// 右侧排行榜列表（取前5名）- 必须有热门数据才显示，避免闪烁
const rankingList = computed(() => {
  // 必须同时有热门数据和壁纸数据才显示
  if (props.popularityData?.length && props.wallpapers?.length) {
    return props.popularityData
      .slice(0, 5)
      .map((stat, index) => {
        const wallpaper = props.wallpapers.find(w => w.filename === stat.filename)
        if (wallpaper) {
          return {
            ...wallpaper,
            rank: index + 1,
            downloadCount: stat.download_count || 0,
            viewCount: stat.view_count || 0,
          }
        }
        return null
      })
      .filter(Boolean)
  }

  // 没有热门数据时返回空数组，显示骨架屏
  return []
})

// 监听数据变化，触发动画
watch(rankingList, (newList) => {
  if (newList.length > 0) {
    rankingAnimated.value = false
    const timer = setTimeout(() => {
      rankingAnimated.value = true
      timers.delete(timer)
    }, 100)
    timers.add(timer)
  }
}, { immediate: true })

// 监听轮播图列表变化，重置加载状态（只在列表项的 id 真正变化时）
watch(carouselList, (newList, oldList) => {
  const newIds = newList.map(w => w.id).join(',')
  const oldIds = oldList?.map(w => w.id).join(',') || ''
  if (newIds !== oldIds) {
    carouselImageLoaded.value = {}
  }
})

// 监听排行榜列表变化，重置加载状态（只在列表项的 id 真正变化时）
watch(rankingList, (newList, oldList) => {
  const newIds = newList.map(w => w.id).join(',')
  const oldIds = oldList?.map(w => w.id).join(',') || ''
  if (newIds !== oldIds) {
    rankingImageLoaded.value = {}
  }
})

onMounted(() => {
  if (rankingList.value.length > 0) {
    const timer = setTimeout(() => {
      rankingAnimated.value = true
      timers.delete(timer)
    }, 300)
    timers.add(timer)
  }
})

// 组件卸载时清理所有定时器
onUnmounted(() => {
  timers.forEach(timer => clearTimeout(timer))
  timers.clear()
})

// Swiper 初始化回调
function onSwiper(swiper) {
  swiperRef.value = swiper
}

// 鼠标进入暂停自动播放
function handleMouseEnter() {
  if (swiperRef.value?.autoplay) {
    swiperRef.value.autoplay.stop()
  }
}

// 鼠标离开恢复自动播放
function handleMouseLeave() {
  if (swiperRef.value?.autoplay) {
    swiperRef.value.autoplay.start()
  }
}

function handleClick(wallpaper) {
  emit('select', wallpaper)
}

// 轮播图图片加载完成
function handleCarouselImageLoad(id) {
  carouselImageLoaded.value[id] = true
}

// 排行榜图片加载完成
function handleRankingImageLoad(id) {
  rankingImageLoaded.value[id] = true
}

// 检查轮播图图片是否已加载
function isCarouselImageLoaded(id) {
  return !!carouselImageLoaded.value[id]
}

// 检查排行榜图片是否已加载
function isRankingImageLoaded(id) {
  return !!rankingImageLoaded.value[id]
}

// 格式化数字
function formatNumber(num) {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
}
</script>

<template>
  <!-- Loading skeleton - 热门数据未加载完成时显示骨架屏 -->
  <div v-if="carouselList.length === 0" class="popular-section popular-section--loading">
    <div class="popular-section__header">
      <div class="skeleton-badge" />
    </div>
    <div class="popular-section__content">
      <div class="skeleton-carousel">
        <div class="skeleton-image" />
      </div>
      <div class="skeleton-ranking">
        <div v-for="i in 5" :key="i" class="skeleton-item" />
      </div>
    </div>
  </div>

  <!-- 有数据时显示（即使热门数据还在加载，也显示默认内容） -->
  <div
    v-else-if="carouselList.length > 0"
    class="popular-section"
  >
    <div class="popular-section__header">
      <div class="popular-section__badge">
        <span>🔥 热门壁纸</span>
      </div>
    </div>

    <div class="popular-section__content">
      <!-- 左侧轮播图 -->
      <div
        class="popular-carousel"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <Swiper
          :modules="swiperModules"
          :slides-per-view="1"
          :space-between="0"
          :loop="true"
          :speed="600"
          :autoplay="{
            delay: 4000,
            disableOnInteraction: false,
          }"
          :pagination="{
            clickable: true,
            el: '.swiper-pagination',
          }"
          class="popular-swiper"
          @swiper="onSwiper"
        >
          <SwiperSlide
            v-for="wallpaper in carouselList"
            :key="wallpaper.id"
          >
            <div
              class="popular-slide"
              @click="handleClick(wallpaper)"
            >
              <!-- 轮播图骨架屏 -->
              <div v-if="!isCarouselImageLoaded(wallpaper.id)" class="slide-skeleton">
                <div class="skeleton-shimmer" />
                <div class="skeleton-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
              </div>
              <img
                :src="wallpaper.previewUrl || wallpaper.thumbnailUrl"
                :alt="wallpaper.filename"
                class="popular-slide__image"
                :class="{ 'is-loaded': isCarouselImageLoaded(wallpaper.id) }"
                @load="handleCarouselImageLoad(wallpaper.id)"
              >
            </div>
          </SwiperSlide>
        </Swiper>
        <div class="swiper-pagination" />
      </div>

      <!-- 右侧排行榜（手机端隐藏） -->
      <div v-if="!isMobile" class="popular-ranking">
        <div class="popular-ranking__header">
          <span>🏆 排行榜</span>
        </div>
        <div class="popular-ranking__list">
          <div
            v-for="(item, index) in rankingList"
            :key="item.id"
            class="ranking-item"
            :class="{ 'ranking-item--animated': rankingAnimated }"
            :style="{ '--delay': `${index * 0.12}s` }"
            @click="handleClick(item)"
          >
            <div class="ranking-item__thumb-wrapper">
              <!-- 排行榜缩略图骨架屏 -->
              <div v-if="!isRankingImageLoaded(item.id)" class="thumb-skeleton">
                <div class="skeleton-shimmer" />
              </div>
              <img
                :src="item.thumbnailUrl"
                :alt="item.filename"
                class="ranking-item__thumb"
                :class="{ 'is-loaded': isRankingImageLoaded(item.id) }"
                @load="handleRankingImageLoad(item.id)"
              >
              <div class="ranking-item__rank" :class="`ranking-item__rank--${item.rank}`">
                {{ item.rank }}
              </div>
            </div>
            <div class="ranking-item__info">
              <div class="ranking-item__title">
                {{ item.title || item.filename }}
              </div>
              <div class="ranking-item__stats">
                <span class="ranking-item__stat">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  {{ formatNumber(item.viewCount) }}
                </span>
                <span class="ranking-item__stat">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  {{ formatNumber(item.downloadCount) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popular-section {
  margin-bottom: $spacing-xl;
}

.popular-section__header {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-md;
}

.popular-section__badge {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-xs $spacing-md;
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: white;
  border-radius: $radius-full;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
}

.popular-section__content {
  display: flex;
  gap: $spacing-lg;

  @include mobile-only {
    flex-direction: column;
  }
}

// 左侧轮播图
.popular-carousel {
  flex: 1;
  min-width: 0;
  position: relative;
  border-radius: $radius-lg;
  overflow: hidden;
}

.popular-swiper {
  width: 100%;
  border-radius: $radius-lg;
  overflow: hidden;
}

.popular-slide {
  position: relative;
  cursor: pointer;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--color-bg-secondary);
}

.popular-slide__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition:
    transform 0.5s ease,
    opacity 0.4s ease;
  opacity: 0;

  &.is-loaded {
    opacity: 1;
  }

  .popular-slide:hover & {
    transform: scale(1.05);
  }
}

// 轮播图骨架屏
.slide-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg-hover) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;

  .skeleton-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.08) 50%, transparent 100%);
    animation: shimmer 2s infinite;
  }

  .skeleton-icon {
    z-index: 2;
    color: var(--color-text-muted);
    opacity: 0.4;

    svg {
      width: 48px;
      height: 48px;
      animation: pulse 2s ease-in-out infinite;
    }
  }
}

.swiper-pagination {
  position: absolute;
  bottom: $spacing-md;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  justify-content: center;
  gap: $spacing-xs;

  :deep(.swiper-pagination-bullet) {
    width: 24px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.4);
    opacity: 1;
    transition: all 0.3s ease;
  }

  :deep(.swiper-pagination-bullet-active) {
    width: 40px;
    background: white;
  }
}

// 右侧排行榜
.popular-ranking {
  width: 280px;
  flex-shrink: 0;
  background: var(--color-bg-secondary);
  border-radius: $radius-lg;
  padding: $spacing-md;
  display: flex;
  flex-direction: column;

  @include mobile-only {
    width: 100%;
  }
}

.popular-ranking__header {
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
  margin-bottom: $spacing-sm;
}

.popular-ranking__list {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: $spacing-sm;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-xs;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--color-bg-primary);
  flex: 1;
  opacity: 0;
  transform: translateX(20px);

  &--animated {
    animation: slideInRight 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    animation-delay: var(--delay);
  }

  &:hover {
    background: var(--color-bg-hover);

    .ranking-item__thumb {
      transform: scale(1.05);
    }
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.ranking-item__thumb-wrapper {
  position: relative;
  width: 90px;
  aspect-ratio: 16 / 9;
  border-radius: $radius-sm;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-bg-hover);
}

.ranking-item__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition:
    transform 0.3s ease,
    opacity 0.4s ease;
  opacity: 0;

  &.is-loaded {
    opacity: 1;
  }
}

// 排行榜缩略图骨架屏
.thumb-skeleton {
  position: absolute;
  inset: 0;
  background: var(--color-bg-hover);
  z-index: 1;

  .skeleton-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.08) 50%, transparent 100%);
    animation: shimmer 1.5s infinite;
  }
}

.ranking-item__rank {
  position: absolute;
  top: 0;
  left: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: $font-weight-bold;
  border-radius: 0 0 $radius-sm 0;
  color: white;
  background: rgba(0, 0, 0, 0.5);

  &--1 {
    background: linear-gradient(135deg, #ffd700, #ffb800);
  }

  &--2 {
    background: linear-gradient(135deg, #c0c0c0, #a8a8a8);
  }

  &--3 {
    background: linear-gradient(135deg, #cd7f32, #b87333);
  }
}

.ranking-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.ranking-item__title {
  font-size: $font-size-sm;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
  font-weight: $font-weight-medium;
}

.ranking-item__stats {
  display: flex;
  gap: $spacing-sm;
}

.ranking-item__stat {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--color-text-muted);

  svg {
    width: 11px;
    height: 11px;
  }
}

// Skeleton styles
.popular-section--loading {
  .skeleton-carousel {
    flex: 1;
    border-radius: $radius-lg;
    overflow: hidden;
  }

  .skeleton-image {
    aspect-ratio: 16 / 9;
    background: linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg-hover) 100%);
    animation: pulse 2s ease-in-out infinite;
  }

  .skeleton-ranking {
    width: 280px;
    background: var(--color-bg-secondary);
    border-radius: $radius-lg;
    padding: $spacing-md;
  }

  .skeleton-item {
    height: 40px;
    background: var(--color-bg-tertiary);
    border-radius: $radius-md;
    margin-bottom: $spacing-sm;
    animation: pulse 2s ease-in-out infinite;

    &:last-child {
      margin-bottom: 0;
    }
  }
}

.popular-section__content {
  .skeleton-carousel,
  .skeleton-ranking {
    @include mobile-only {
      width: 100%;
    }
  }
}

.skeleton-badge {
  width: 120px;
  height: 28px;
  background: var(--color-bg-secondary);
  border-radius: $radius-full;
  animation: pulse 2s ease-in-out infinite;
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

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
</style>
