<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import { useDevice } from '@/composables/useDevice'
import { useViewMode } from '@/composables/useViewMode'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { usePopularityStore } from '@/stores/popularity'
import WallpaperCard from '../card/index.vue'
import { useGridAnimations } from './composables/useGridAnimations'
import { PAGE_SIZE, useGridPagination } from './composables/useGridPagination'
import { useGridTouchMode } from './composables/useGridTouchMode'
import GridEmptyState from './shared/GridEmptyState.vue'
import GridLoadingState from './shared/GridLoadingState.vue'

const props = defineProps({
  wallpapers: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  searchQuery: {
    type: String,
    default: '',
  },
  // 原始壁纸总数（未筛选前）
  totalCount: {
    type: Number,
    default: 0,
  },
  // 是否有筛选条件激活
  hasFilters: {
    type: Boolean,
    default: false,
  },
  // 热门数据（从父组件传入，避免重复请求）
  popularityData: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['select', 'resetFilters'])

const router = useRouter()
const { currentSeries, currentSeriesConfig, availableSeriesOptions } = useWallpaperType()
const { viewMode, setViewMode } = useViewMode()
const { isMobile, isMobileOrTablet } = useDevice()
const popularityStore = usePopularityStore()

// 获取热门排名、下载次数和访问量（直接走 store O(1) 查询）
function getPopularRank(filename) {
  return popularityStore.getPopularRank(filename)
}

function getDownloadCount(filename) {
  return popularityStore.getDownloadCount(filename)
}

function getViewCount(filename) {
  return popularityStore.getViewCount(filename)
}

const gridRef = ref(null)
const wrapperRef = ref(null)
const displayViewMode = ref(viewMode.value)

// 定时器引用集合（用于组件卸载时清理）
const timers = new Set()

const wallpapersRef = computed(() => props.wallpapers)
const {
  displayedItems,
  handleScroll,
  isLoadingMore,
  pauseScrollLoad,
  resetDisplayCount,
  resumeScrollLoad,
} = useGridPagination({
  timers,
  wallpapers: wallpapersRef,
})

// 空状态类型判断
const emptyStateType = computed(() => {
  if (props.loading && props.wallpapers.length === 0)
    return 'loading'
  if (props.wallpapers.length === 0) {
    // 如果有筛选条件或搜索词，说明是筛选后无结果
    if (props.hasFilters || props.searchQuery) {
      return 'no-filter-results'
    }
    // 否则是系列本身没有数据
    return 'no-series-data'
  }
  return null
})

// 当前系列的名称
const currentSeriesName = computed(() => {
  return currentSeriesConfig.value?.name || '壁纸'
})

const aspectType = computed(() => {
  const ratio = currentSeriesConfig.value?.aspectRatio || '16/10'
  const [w, h] = ratio.split('/').map(Number)
  if (w < h)
    return 'portrait' // 竖屏
  if (w === h)
    return 'square' // 正方形
  return 'landscape'
})

// 获取其他可用系列（用于快捷跳转）
const alternativeSeries = computed(() => {
  return availableSeriesOptions.value.filter(opt => opt.id !== currentSeries.value)
})

const allowListMode = computed(() => currentSeries.value !== 'video')

watch(currentSeries, (series) => {
  if (series === 'video' && viewMode.value !== 'grid') {
    setViewMode('grid')
  }
}, { immediate: true })

// 跳转到其他系列
function navigateToSeries(seriesId) {
  router.push(`/${seriesId}`)
}

// 重置筛选条件
function handleResetFilters() {
  emit('resetFilters')
}

const {
  handleTouchEnd,
  handleTouchMove,
  handleTouchStart,
} = useGridTouchMode({
  allowListMode,
  isMobileOrTablet,
  setViewMode,
  viewMode,
})

const {
  animateCardsIn,
  cleanupGridAnimations,
  initializeGridAnimations,
  isAnimating,
  lockWrapperHeight,
  releaseWrapperHeight,
  warmupFlip,
} = useGridAnimations({
  displayViewMode,
  displayedItems,
  gridRef,
  isMobileOrTablet,
  timers,
  viewMode,
  wrapperRef,
})

// 初始加载动画
onMounted(() => {
  // 添加滚动监听
  window.addEventListener('scroll', handleScroll)
  initializeGridAnimations()
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  // 清除所有未完成的定时器
  timers.forEach(timer => clearTimeout(timer))
  timers.clear()

  cleanupGridAnimations()
})

watch(() => props.loading, (isLoading, wasLoading) => {
  if (isLoading && !wasLoading && props.wallpapers.length > 0) {
    lockWrapperHeight()
    return
  }

  if (!isLoading && wasLoading) {
    releaseWrapperHeight()

    if (props.wallpapers.length > 0) {
      nextTick(() => {
        animateCardsIn()
      })
    }
  }
})

watch(isAnimating, (animating) => {
  if (animating) {
    pauseScrollLoad()
  }
  else {
    resumeScrollLoad()
  }
})

// 监听 wallpapers 变化（筛选/搜索/分类切换时）
// 使用标记防止重复动画
let animationPending = false

function hasSameLeadingItems(listA, listB, count = PAGE_SIZE) {
  if (!Array.isArray(listA) || !Array.isArray(listB)) {
    return false
  }

  const limit = Math.min(count, listA.length, listB.length)
  if (limit === 0) {
    return false
  }

  for (let i = 0; i < limit; i++) {
    if (listA[i]?.id !== listB[i]?.id) {
      return false
    }
  }

  return true
}

watch(() => props.wallpapers, async (newVal, oldVal) => {
  // 防止重复触发
  if (animationPending) {
    return
  }

  // 如果是后台数据追加（长度增加但前面的元素不变），不触发重置
  const isBackgroundAppend = oldVal
    && oldVal.length > 0
    && newVal
    && newVal.length > oldVal.length
    && oldVal.length >= PAGE_SIZE
    && hasSameLeadingItems(newVal, oldVal)

  // 后台追加数据时，不需要重置显示数量
  if (isBackgroundAppend) {
    return
  }

  animationPending = true

  // 重置显示数量（仅在非后台追加时）
  resetDisplayCount()

  // 首次加载（从无到有）
  if (!oldVal || oldVal.length === 0) {
    await nextTick()
    // 首次加载也执行入场动画
    if (newVal && newVal.length > 0) {
      animateCardsIn()
    }
    else {
      warmupFlip()
    }
    animationPending = false
    return
  }

  // 数据相同，不触发动画
  if (newVal === oldVal || (newVal?.length === oldVal?.length && hasSameLeadingItems(newVal, oldVal))) {
    animationPending = false
    return
  }

  // 分类切换/筛选（从有到有）：保留容器，直接对新卡片做入场动画，避免闪屏
  await nextTick()
  animateCardsIn()
  animationPending = false
}, { deep: false })

function handleSelect(wallpaper) {
  emit('select', wallpaper)
}

// 骨架屏数量
const skeletonCount = computed(() => isMobile.value ? 6 : 12)
</script>

<template>
  <div ref="wrapperRef" class="wallpaper-grid-wrapper">
    <GridLoadingState
      v-if="loading"
      :aspect-type="aspectType"
      :current-series-name="currentSeriesName"
      :display-view-mode="displayViewMode"
      :is-mobile-or-tablet="isMobileOrTablet"
      :skeleton-count="skeletonCount"
    />

    <GridEmptyState
      v-else-if="emptyStateType"
      :alternative-series="alternativeSeries"
      :current-series="currentSeries"
      :current-series-name="currentSeriesName"
      :type="emptyStateType"
      @navigate="navigateToSeries"
      @reset-filters="handleResetFilters"
    />

    <!-- Grid -->
    <template v-else>
      <!-- 壁纸网格（网格、列表） -->
      <div
        ref="gridRef"
        class="wallpaper-grid"
        :class="[`view-${displayViewMode}`, `aspect-${aspectType}`, { 'is-animating': isAnimating }]"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <WallpaperCard
          v-for="(wallpaper, index) in displayedItems"
          :key="wallpaper.id"
          :wallpaper="wallpaper"
          :index="index"
          :search-query="searchQuery"
          :view-mode="displayViewMode"
          :aspect-ratio="currentSeriesConfig?.aspectRatio || '16/10'"
          :popular-rank="getPopularRank(wallpaper.filename)"
          :download-count="getDownloadCount(wallpaper.filename)"
          :view-count="getViewCount(wallpaper.filename)"
          @click="handleSelect"
        />
      </div>

      <!-- 加载中提示（滚动加载） -->
      <div v-if="isLoadingMore" class="mobile-load-more">
        <div class="loading-more">
          <LoadingSpinner size="sm" />
          <span>加载中...</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.wallpaper-grid-wrapper {
  min-height: 400px;
  overflow-x: hidden; // 防止动画时出现横向滚动条
  transition: min-height 0.22s ease;
}

// ========================================
// 移动端加载更多
// ========================================
.mobile-load-more {
  padding: $spacing-lg 0;
  text-align: center;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  color: var(--color-text-muted);
  font-size: $font-size-sm;
}

.wallpaper-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: var(--grid-gap);
  transition: opacity 0.15s ease;
  // 防止动画后的布局重排影响
  contain: layout style;

  // 移动端更紧凑的间距
  @include mobile-only {
    gap: $spacing-sm;
  }
  // 动画进行中禁用 hover 效果，避免干扰
  &.is-animating {
    pointer-events: none;
  }

  // 网格视图（默认）
  &.view-grid {
    // 移动端两列
    grid-template-columns: repeat(2, 1fr);

    @include respond-to('md') {
      grid-template-columns: repeat(3, 1fr);
    }

    @include respond-to('lg') {
      grid-template-columns: repeat(4, 1fr);
    }

    @include respond-to('xl') {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  // 列表视图
  &.view-list {
    grid-template-columns: 1fr;
    gap: $spacing-md;
  }

  // 正方形壁纸（头像）网格优化
  &.view-grid.aspect-square {
    // 移动端保持2列
    grid-template-columns: repeat(2, 1fr);

    @include respond-to('md') {
      grid-template-columns: repeat(4, 1fr);
    }

    @include respond-to('lg') {
      grid-template-columns: repeat(5, 1fr);
    }

    @include respond-to('xl') {
      grid-template-columns: repeat(6, 1fr);
    }
  }
}
</style>
