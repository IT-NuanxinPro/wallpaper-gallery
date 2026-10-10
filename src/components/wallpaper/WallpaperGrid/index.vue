<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import { useDevice } from '@/composables/useDevice'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { usePopularityStore } from '@/stores/popularity'
import WallpaperCard from '../card/index.vue'
import { PAGE_SIZE, useGridPagination } from './composables/useGridPagination'
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
const { isMobile } = useDevice()
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

const wallpapersRef = computed(() => props.wallpapers)
const {
  displayedItems,
  handleScroll,
  isLoadingMore,
  resetDisplayCount,
} = useGridPagination({
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

// 跳转到其他系列
function navigateToSeries(seriesId) {
  router.push(`/${seriesId}`)
}

// 重置筛选条件
function handleResetFilters() {
  emit('resetFilters')
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

// 监听 wallpapers 变化（筛选/搜索/分类切换时）

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

watch(() => props.wallpapers, (newVal, oldVal) => {
  // 追加数据不重置已展开列表；筛选和切系列直接显示最终结果。
  const isAppend = oldVal?.length >= PAGE_SIZE
    && newVal.length > oldVal.length
    && hasSameLeadingItems(newVal, oldVal)
  if (!isAppend && !(newVal.length === oldVal?.length && hasSameLeadingItems(newVal, oldVal))) {
    resetDisplayCount()
  }
})

function handleSelect(wallpaper) {
  emit('select', wallpaper)
}

// 骨架屏数量
const skeletonCount = computed(() => isMobile.value ? 6 : 12)
</script>

<template>
  <div class="wallpaper-grid-wrapper" :aria-busy="loading">
    <GridLoadingState
      v-if="loading && wallpapers.length === 0"
      :aspect-type="aspectType"
      :current-series-name="currentSeriesName"
      :is-mobile="isMobile"
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
      <!-- 卡片布局 -->
      <div
        class="wallpaper-grid"
        :class="[`aspect-${aspectType}`]"
      >
        <div
          v-for="(wallpaper, index) in displayedItems"
          :key="wallpaper.id"
          class="wallpaper-grid-item"
        >
          <WallpaperCard
            :wallpaper="wallpaper"
            :index="index"
            :search-query="searchQuery"
            :aspect-ratio="currentSeriesConfig?.aspectRatio || '16/10'"
            :popular-rank="getPopularRank(wallpaper.filename)"
            :download-count="getDownloadCount(wallpaper.filename)"
            :view-count="getViewCount(wallpaper.filename)"
            @click="handleSelect"
          />
        </div>
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
  overflow-x: clip;
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

.wallpaper-grid-item {
  position: relative;
  min-width: 0;

  :deep(.wallpaper-card) {
    height: 100%;
  }
}

.wallpaper-grid {
  display: grid;
  gap: var(--grid-gap);
  transition: opacity 0.15s ease;
  // 防止动画后的布局重排影响
  contain: layout style;

  // 移动端更紧凑的间距
  @include mobile-only {
    gap: $spacing-sm;
  }

  // 移动端两列，随屏幕宽度增加列数。
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @include respond-to('md') {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @include respond-to('lg') {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  @include respond-to('xl') {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  // 正方形壁纸（头像）网格优化
  &.aspect-square {
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
