<script setup>
import { computed, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import AvatarMakerBanner from '@/components/avatar/AvatarMakerBanner.vue'
import DiyAvatarBanner from '@/components/avatar/DiyAvatarBanner.vue'
import { defineAsyncModal } from '@/components/common/feedback/defineAsyncModal'
import BackToTop from '@/components/common/navigation/BackToTop.vue'
import HomeModalHost from '@/components/home/HomeModalHost.vue'
import FilterPanel from '@/components/wallpaper/filter/index.vue'
import WallpaperGrid from '@/components/wallpaper/WallpaperGrid/index.vue'
import { handleBrowseRouteLeave } from '@/composables/home/browseRouteGuard'
import { useBrowseState, validateBrowseQuery } from '@/composables/home/useBrowseState'
import { useHomeDataLoader } from '@/composables/home/useHomeDataLoader'
import { useHomeSeriesSync } from '@/composables/home/useHomeSeriesSync'
import { useWallpaperNavigator } from '@/composables/home/useWallpaperNavigator'
import { useDevice } from '@/composables/useDevice'
import { useAuthStore } from '@/stores/auth'
import { useFilterStore } from '@/stores/filter'
import { useHotTagsStore } from '@/stores/hotTags'
import { useInteractionStore } from '@/stores/interaction'
import { usePopularityStore } from '@/stores/popularity'
import { useSeriesStore } from '@/stores/series'
import { useWallpaperStore } from '@/stores/wallpaper'
import { SERIES_CONFIG } from '@/utils/config/constants'
import { getDefaultCategoryFilter } from '@/utils/filter/defaults'
import { canDisplayLatestSlice } from '@/utils/filter/firstScreen'
import { rememberBrowseReturn } from '@/utils/wallpaper/browseReturn'

const route = useRoute()
const router = useRouter()
const AvatarMakerModal = defineAsyncModal(() => import('@/components/avatar/AvatarMakerModal/index.vue'))

const seriesStore = useSeriesStore()
const wallpaperStore = useWallpaperStore()
const popularityStore = usePopularityStore()
const hotTagsStore = useHotTagsStore()
const filterStore = useFilterStore()
const { isMobile } = useDevice()
const interactionStore = useInteractionStore()
const authStore = useAuthStore()

const currentSeries = computed(() => seriesStore.currentSeries)
const isVideoSeries = computed(() => currentSeries.value === 'video')
const isSeriesContentReady = computed(() => wallpaperStore.currentRenderedSeries === currentSeries.value)
const visibleWallpapers = computed(() => !isSeriesContentReady.value ? [] : currentSeries.value === 'video' ? wallpaperStore.wallpapers.filter(item => item.category === 'desktop') : wallpaperStore.wallpapers)
const seriesCategoryDefinitions = computed(() => wallpaperStore.getSeriesCategories(currentSeries.value))
const displayTotal = computed(() => isVideoSeries.value ? (wallpaperStore.isDataComplete && isSeriesContentReady.value ? visibleWallpapers.value.length : seriesCategoryDefinitions.value.find(category => (category.id || category.name) === 'desktop')?.count || visibleWallpapers.value.length) : wallpaperStore.displayTotal)

const usePortraitModal = computed(() => ['mobile', 'avatar'].includes(currentSeries.value))
const hideFormatFilter = computed(() => SERIES_CONFIG[currentSeries.value]?.hideFormatFilter === true)
const categoryOptions = computed(() => {
  if (wallpaperStore.isDataComplete || !seriesCategoryDefinitions.value.length)
    return filterStore.createCategoryOptions(visibleWallpapers.value)

  // 分类索引已包含完整计数，不能用最新切片推导分类选项。
  const categories = seriesCategoryDefinitions.value.map(category => ({
    value: category.id || category.name,
    label: filterStore.getCategoryLabel(category.id || category.name),
    count: category.count,
    subcategories: category.subcategories || [],
  }))
  return isVideoSeries.value
    ? categories
    : [{ value: 'all', label: '全部分类', count: wallpaperStore.displayTotal }, ...categories]
})
const subcategoryOptions = computed(() => filterStore.createSubcategoryOptions(categoryOptions.value))
const selectedBingYear = computed(() => currentSeries.value === 'bing'
  && /^\d{4}-\d{2}$/.test(filterStore.categoryFilter)
  ? Number.parseInt(filterStore.categoryFilter.slice(0, 4))
  : null)
const areSelectedResultsComplete = computed(() => selectedBingYear.value === null
  ? wallpaperStore.isDataComplete
  : wallpaperStore.isBingYearLoaded(selectedBingYear.value))
const waitingForCompleteResults = computed(() => isSeriesContentReady.value
  && !areSelectedResultsComplete.value
  && !canDisplayLatestSlice({
    currentSeries: currentSeries.value,
    sortBy: filterStore.sortBy,
    searchQuery: filterStore.searchQuery || filterStore.debouncedQuery,
    exactSearchValue: filterStore.exactSearchValue,
    formatFilter: filterStore.formatFilter,
    resolutionFilter: filterStore.resolutionFilter,
    categoryFilter: filterStore.categoryFilter,
    subcategoryFilter: filterStore.subcategoryFilter,
  }))
const filteredWallpapers = computed(() => waitingForCompleteResults.value
  ? []
  : filterStore.getFilteredAndSorted(visibleWallpapers.value))
const resultCount = computed(() => filteredWallpapers.value.length)
const hasActiveFilters = computed(() => filterStore.hasActiveFilters(currentSeries.value))
const statsNotice = computed(() => {
  if (popularityStore.currentSeries !== currentSeries.value || popularityStore.loading)
    return ''
  if (popularityStore.snapshotError)
    return popularityStore.snapshotError
  const metadata = popularityStore.statsMetadata
  const period = filterStore.sortBy === 'weekly-hot' ? 'week' : filterStore.sortBy === 'monthly-hot' ? 'month' : null
  if (!period)
    return metadata?.stale ? '统计数据待更新，当前显示上次记录' : ''
  if (!metadata?.[`${period}Available`])
    return '当前期间统计待更新，暂按最新壁纸展示'
  const start = new Date(metadata.periodStartedAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })
  const updated = new Date(metadata.exportedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
  return `按北京时间${period === 'week' ? '本周' : '本月'}互动排序 · 期间统计自 ${start} 开始记录 · 更新于 ${updated}`
})
const showInteractionSummary = computed(() => authStore.isConfigured && authStore.isAuthenticated)

const routeSyncReady = ref(false)
const { syncSeriesFromRoute } = useHomeSeriesSync(route, seriesStore, routeSyncReady)
syncSeriesFromRoute()

const { error, handleReload: reloadSeriesData, loading } = useHomeDataLoader({
  currentSeries,
  filterStore,
  hotTagsStore,
  popularityStore,
  seriesStore,
  syncSeriesFromRoute,
  wallpaperStore,
})

const gridLoading = computed(() => loading.value
  || (waitingForCompleteResults.value && !wallpaperStore.backgroundError))
const visibleError = computed(() => error.value
  || (waitingForCompleteResults.value ? wallpaperStore.backgroundError : null))

routeSyncReady.value = true

watch(() => filterStore.sortBy, (sortBy) => {
  if (['weekly-hot', 'monthly-hot'].includes(sortBy))
    void popularityStore.fetchPopularityData(currentSeries.value)
})

// 用户登录后，预取当前系列的交互数据（喜欢/收藏）
watch(
  [currentSeries, () => authStore.isAuthenticated],
  async ([series, isAuth]) => {
    if (isAuth && series) {
      await Promise.allSettled([
        interactionStore.prefetchForSeries(series),
        interactionStore.loadStats(),
      ])
    }
  },
  { immediate: true },
)

const restoredBingYear = computed(() => {
  if (currentSeries.value !== 'bing' || filterStore.categoryFilter !== 'all')
    return null
  const state = validateBrowseQuery(route.query, { series: 'bing' })
  const image = state.image || state.exact
  return image ? Number(image.slice('bing:bing-'.length, 'bing:bing-'.length + 4)) : null
})
watch([restoredBingYear, isSeriesContentReady], ([year, ready]) => {
  if (year && ready)
    void wallpaperStore.loadBingYear(year)
}, { immediate: true })
const navigationReady = computed(() => isSeriesContentReady.value
  && areSelectedResultsComplete.value
  && (restoredBingYear.value === null || wallpaperStore.isBingYearLoaded(restoredBingYear.value))
  && (filterStore.searchQuery === filterStore.debouncedQuery || Boolean(filterStore.exactSearchValue))
  && (!['popular', 'downloads', 'views', 'weekly-hot', 'monthly-hot'].includes(filterStore.sortBy) || !popularityStore.loading))
const gridRef = ref(null)
const navigator = useWallpaperNavigator(() => filteredWallpapers.value, { resultsReady: navigationReady })
const {
  close,
  currentWallpaper,
  handleNextWallpaper,
  handlePrevWallpaper,
  handleSelectWallpaper,
  isOpen,
} = navigator
const { minimumDisplayCount, onDisplayCountChange, restoreFromRoute, savePosition, leave } = useBrowseState({
  route,
  router,
  filterStore,
  currentSeries,
  results: filteredWallpapers,
  resultsReady: navigationReady,
  categories: categoryOptions,
  categoriesReady: computed(() => isSeriesContentReady.value && wallpaperStore.isDataComplete),
  gridReady: computed(() => Boolean(gridRef.value)),
  navigator,
})
onBeforeRouteLeave((to) => {
  rememberBrowseReturn(route.fullPath)
  handleBrowseRouteLeave(to, { savePosition, leave })
})

function handleReload() {
  reloadSeriesData()
  // 加载器会重置系列默认值，重试时仍以当前 URL 的浏览条件为准。
  void restoreFromRoute()
}

function handleReset() {
  // 周/月热门同时限定上传时间，清除筛选时也需要解除该限制。
  const defaultSort = ['weekly-hot', 'monthly-hot'].includes(filterStore.sortBy) ? 'newest' : filterStore.sortBy
  filterStore.resetFilters(defaultSort, currentSeries.value)
}

function handleClearSearch() {
  filterStore.clearSearch()
  filterStore.clearExactSearch()
  if (currentSeries.value === 'bing') {
    filterStore.categoryFilter = getDefaultCategoryFilter(currentSeries.value)
    filterStore.subcategoryFilter = 'all'
  }
}

const isAvatarMakerOpen = ref(false)

function handleAvatarMakerClick() {
  isAvatarMakerOpen.value = true
}

function handleAvatarMakerClose() {
  isAvatarMakerOpen.value = false
}
</script>

<template>
  <div class="home-page">
    <div class="home-content">
      <div :data-browse-ready="isSeriesContentReady && !gridLoading && !visibleError ? 'ready' : 'loading'">
        <div v-if="currentSeries === 'avatar' && !isMobile" class="avatar-banners">
          <DiyAvatarBanner />
          <AvatarMakerBanner @click="handleAvatarMakerClick" />
        </div>

        <FilterPanel
          v-model:sort-by="filterStore.sortBy"
          v-model:format-filter="filterStore.formatFilter"
          v-model:resolution-filter="filterStore.resolutionFilter"
          v-model:category-filter="filterStore.categoryFilter"
          v-model:subcategory-filter="filterStore.subcategoryFilter"
          :category-options="categoryOptions"
          :search-query="filterStore.searchQuery"
          :subcategory-options="subcategoryOptions"
          :result-count="resultCount"
          :total-count="displayTotal"
          :loading="loading || !areSelectedResultsComplete"
          :hide-format-filter="hideFormatFilter"
          :current-series="currentSeries"
          :show-interaction-summary="showInteractionSummary"
          :interaction-stats="interactionStore.stats"
          :interaction-stats-loaded="interactionStore.statsLoaded"
          @clear-search="handleClearSearch"
          @reset="handleReset"
        />

        <p v-if="statsNotice" class="stats-notice" role="status">
          {{ statsNotice }}
        </p>

        <div v-if="visibleError" class="error-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <h3>加载失败</h3>
          <p>{{ visibleError }}</p>
          <button class="series-action-button series-action-button--primary" @click="handleReload">
            重新加载
          </button>
        </div>

        <WallpaperGrid
          v-else
          ref="gridRef"
          :wallpapers="filteredWallpapers"
          :loading="gridLoading"
          :search-query="filterStore.searchQuery"
          :total-count="displayTotal"
          :has-filters="hasActiveFilters"
          :popularity-data="popularityStore.allTimeData"
          :minimum-display-count="minimumDisplayCount"
          @display-count-change="onDisplayCountChange"
          @select="handleSelectWallpaper"
          @navigate="savePosition"
          @reset-filters="handleReset"
        />

        <div
          v-if="isSeriesContentReady && !visibleError && !areSelectedResultsComplete"
          class="series-load-status"
          role="status"
          aria-live="polite"
        >
          <template v-if="wallpaperStore.backgroundError">
            <span>{{ wallpaperStore.backgroundError }}</span>
            <button type="button" @click="handleReload">
              重新加载
            </button>
          </template>
          <span v-else>正在加载其余壁纸…</span>
        </div>
      </div>
    </div>

    <HomeModalHost
      v-if="currentWallpaper"
      :wallpaper="currentWallpaper"
      :is-open="isOpen"
      :use-portrait-modal="usePortraitModal"
      @close="close"
      @prev="handlePrevWallpaper"
      @next="handleNextWallpaper"
    />

    <BackToTop />

    <AvatarMakerModal
      v-if="isAvatarMakerOpen"
      :is-open="isAvatarMakerOpen"
      @close="handleAvatarMakerClose"
    />
  </div>
</template>

<style lang="scss" scoped>
.home-page {
  padding: 0;
}

.series-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
  padding: $spacing-sm $spacing-lg;
  border: none;
  border-radius: $radius-full;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    background-color var(--transition-fast);

  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  &--primary {
    color: #fff;
    background: var(--accent-gradient);
    box-shadow: 0 12px 24px var(--accent-shadow);

    &:hover {
      background: var(--accent-gradient-hover);
      box-shadow: 0 16px 30px var(--accent-shadow-strong);
    }
  }
}

.avatar-banners {
  display: flex;
  gap: $spacing-lg;
  margin-bottom: $spacing-xl;

  > :deep(.diy-avatar-banner),
  > :deep(.avatar-maker-banner) {
    flex: 1;
    min-width: 0;
    margin-bottom: 0;
  }

  @include mobile-only {
    flex-direction: column;
    gap: $spacing-md;
    margin-bottom: $spacing-md;

    > :deep(.diy-avatar-banner),
    > :deep(.avatar-maker-banner) {
      flex: none;
      width: 100%;
    }
  }
}

.series-load-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  padding: $spacing-lg 0;
  color: var(--color-text-secondary);
  font-size: $font-size-sm;

  button {
    padding: $spacing-sm $spacing-md;
    border: 1px solid var(--color-border);
    border-radius: $radius-md;
    background: var(--color-bg-card);
    color: var(--color-accent);
    cursor: pointer;

    &:hover {
      background: var(--color-bg-hover);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }
}

.stats-notice {
  margin: -4px 0 16px;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-2xl;
  text-align: center;

  svg {
    width: 64px;
    height: 64px;
    color: var(--color-error);
    margin-bottom: $spacing-lg;
  }

  h3 {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: var(--color-text-primary);
    margin-bottom: $spacing-sm;
  }

  p {
    font-size: $font-size-sm;
    color: var(--color-text-muted);
    margin-bottom: $spacing-lg;
  }
}
</style>
