<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AvatarMakerBanner from '@/components/avatar/AvatarMakerBanner.vue'
import AvatarMakerModal from '@/components/avatar/AvatarMakerModal/index.vue'
import DiyAvatarBanner from '@/components/avatar/DiyAvatarBanner.vue'
import AnnouncementBanner from '@/components/common/feedback/AnnouncementBanner.vue'
import BackToTop from '@/components/common/navigation/BackToTop.vue'
import HomeModalHost from '@/components/home/HomeModalHost.vue'
import HotTagsPanel from '@/components/home/HotTagsPanel.vue'
import MobileSeriesNotice from '@/components/home/MobileSeriesNotice.vue'
import FilterPanel from '@/components/wallpaper/filter/index.vue'
import WallpaperGrid from '@/components/wallpaper/WallpaperGrid/index.vue'
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

const route = useRoute()

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
const showMobileSeriesNotice = computed(() => isMobile.value && ['desktop', 'bing'].includes(currentSeries.value))
const isSeriesContentReady = computed(() => wallpaperStore.currentRenderedSeries === currentSeries.value)
const visibleWallpapers = computed(() => isSeriesContentReady.value ? wallpaperStore.wallpapers : [])
const seriesCategoryDefinitions = computed(() => wallpaperStore.getSeriesCategories(currentSeries.value))
const showHotTagsPanel = computed(() => !isVideoSeries.value)

const mobileNoticeContent = computed(() => {
  if (currentSeries.value === 'bing') {
    return {
      eyebrow: '移动端浏览提示',
      title: '每日 Bing 壁纸更适合在电脑端浏览',
      description: '当前页面以宽屏大图为主，推荐在电脑端查看每日 Bing 壁纸，以获得更完整的预览和下载体验。你也可以先前往更适合手机浏览的专区继续挑选。',
    }
  }

  return {
    eyebrow: '移动端浏览提示',
    title: '电脑桌面壁纸更适合在大屏设备浏览',
    description: '当前页面收录的是 4K 电脑桌面壁纸，推荐在电脑或平板上浏览，以获得更完整的构图和预览效果。你也可以先前往手机壁纸或头像专区查看更适合当前设备的内容。',
  }
})

const usePortraitModal = computed(() => ['mobile', 'avatar'].includes(currentSeries.value))
const hideFormatFilter = computed(() => SERIES_CONFIG[currentSeries.value]?.hideFormatFilter === true)
const categoryOptions = computed(() => filterStore.createCategoryOptions(visibleWallpapers.value))
const subcategoryOptions = computed(() => filterStore.createSubcategoryOptions(categoryOptions.value))
const filteredWallpapers = computed(() => filterStore.getFilteredAndSorted(visibleWallpapers.value))
const hotTagLookup = computed(() => {
  const categorySet = new Set()
  const subcategorySet = new Set()

  seriesCategoryDefinitions.value.forEach((category) => {
    if (category?.id || category?.name) {
      categorySet.add(category.id || category.name)
      categorySet.add(category.name || category.id)
    }

    if (Array.isArray(category?.subcategories)) {
      category.subcategories.forEach((subcategory) => {
        subcategorySet.add(subcategory.name)
      })
    }
  })

  return { categorySet, subcategorySet }
})
const hotCategoryTags = computed(() =>
  hotTagsStore.tags
    .filter(tag => hotTagLookup.value.categorySet.has(tag.tag) || hotTagLookup.value.subcategorySet.has(tag.tag))
    .slice(0, 6)
    .map(tag => ({
      ...tag,
      interactionType: 'category',
    })),
)
const hotKeywordTags = computed(() =>
  hotTagsStore.tags
    .filter(tag => !hotTagLookup.value.categorySet.has(tag.tag) && !hotTagLookup.value.subcategorySet.has(tag.tag))
    .slice(0, 8)
    .map(tag => ({
      ...tag,
      interactionType: 'keyword',
    })),
)
const activeHotTag = ref('')
const isHotTagsVisible = ref(false)
const resultCount = computed(() => filteredWallpapers.value.length)
const hasActiveFilters = computed(() => filterStore.hasActiveFilters(currentSeries.value))
const showInteractionSummary = computed(() => authStore.isConfigured && authStore.isAuthenticated)

let hotTagsRevealTimer = null

const routeSyncReady = ref(false)
const { syncSeriesFromRoute } = useHomeSeriesSync(route, seriesStore, routeSyncReady)
syncSeriesFromRoute()

const { error, handleReload, loading } = useHomeDataLoader({
  currentSeries,
  showMobileSeriesNotice,
  filterStore,
  hotTagsStore,
  popularityStore,
  seriesStore,
  syncSeriesFromRoute,
  wallpaperStore,
})

const isHotTagsDataStable = computed(() =>
  hotTagsStore.currentSeries === currentSeries.value
  && wallpaperStore.currentRenderedSeries === currentSeries.value
  && !hotTagsStore.loading
  && !wallpaperStore.loading
  && !wallpaperStore.isBackgroundLoading
  && !loading.value,
)

routeSyncReady.value = true

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

watch(
  [currentSeries, isHotTagsDataStable],
  ([, stable]) => {
    if (hotTagsRevealTimer) {
      clearTimeout(hotTagsRevealTimer)
      hotTagsRevealTimer = null
    }

    if (!stable) {
      isHotTagsVisible.value = false
      activeHotTag.value = ''
      return
    }

    hotTagsRevealTimer = window.setTimeout(() => {
      isHotTagsVisible.value = true
      hotTagsRevealTimer = null
    }, 320)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (hotTagsRevealTimer) {
    clearTimeout(hotTagsRevealTimer)
    hotTagsRevealTimer = null
  }
})

const {
  close,
  currentWallpaper,
  handleNextWallpaper,
  handlePrevWallpaper,
  handleSelectWallpaper,
  isOpen,
} = useWallpaperNavigator(wallpaperStore)

function handleReset() {
  filterStore.resetFilters(filterStore.sortBy, currentSeries.value)
  activeHotTag.value = ''
}

function handleClearSearch() {
  filterStore.clearSearch()
  filterStore.clearExactSearch()
  if (currentSeries.value === 'bing') {
    filterStore.categoryFilter = getDefaultCategoryFilter(currentSeries.value)
    filterStore.subcategoryFilter = 'all'
  }
  activeHotTag.value = ''
}

function resetNonSearchFilters() {
  filterStore.formatFilter = 'all'
  filterStore.resolutionFilter = 'all'
}

function applyTagAsCategory(tag) {
  const matchedCategory = categoryOptions.value.find(option =>
    option.value !== 'all' && (option.value === tag || option.label === tag),
  )

  if (matchedCategory) {
    filterStore.clearSearch()
    filterStore.clearExactSearch()
    resetNonSearchFilters()
    filterStore.categoryFilter = matchedCategory.value
    filterStore.subcategoryFilter = 'all'
    return true
  }

  const matchedParentCategory = categoryOptions.value.find(option =>
    option.value !== 'all'
    && Array.isArray(option.subcategories)
    && option.subcategories.some(subcategory => subcategory.name === tag),
  )

  if (matchedParentCategory) {
    filterStore.clearSearch()
    filterStore.clearExactSearch()
    resetNonSearchFilters()
    filterStore.categoryFilter = matchedParentCategory.value
    filterStore.subcategoryFilter = tag
    return true
  }

  return false
}

function normalizeBingMonthTag(tag) {
  const matched = tag.match(/^(\d{4})\s+(\d{2})$/)
  if (!matched) {
    return ''
  }

  return `${matched[1]}-${matched[2]}`
}

function extractBingTagYears(tagItem) {
  const years = new Set()
  const monthCategory = normalizeBingMonthTag(tagItem?.tag || '')

  if (monthCategory) {
    years.add(Number.parseInt(monthCategory.slice(0, 4), 10))
  }

  if (Array.isArray(tagItem?.topWallpapers)) {
    tagItem.topWallpapers.forEach((filename) => {
      const matched = String(filename).match(/bing-(\d{4})-\d{2}-\d{2}\.jpg/i)
      if (matched) {
        years.add(Number.parseInt(matched[1], 10))
      }
    })
  }

  return [...years].filter(Number.isInteger)
}

function isBingMonthTag(tag) {
  return Boolean(normalizeBingMonthTag(tag))
}

async function ensureBingHotTagData(tagItem) {
  if (currentSeries.value !== 'bing') {
    return ''
  }

  const monthCategory = normalizeBingMonthTag(tagItem?.tag || '')
  const years = extractBingTagYears(tagItem)

  if (years.length > 0) {
    await Promise.all(years.map(year => wallpaperStore.loadBingYear(year)))
  }

  return monthCategory
}

async function handleHotTagSelect(tagItem) {
  const tag = tagItem?.tag || ''
  if (!tag) {
    return
  }

  const bingMonthCategory = await ensureBingHotTagData(tagItem)
  const normalizedTag = bingMonthCategory || tag

  if (applyTagAsCategory(normalizedTag)) {
    activeHotTag.value = tag
    return
  }

  if (
    currentSeries.value === 'bing'
    && !isBingMonthTag(tag)
    && Array.isArray(tagItem?.topWallpapers)
    && tagItem.topWallpapers.length === 1
  ) {
    const exactFilename = tagItem.topWallpapers[0]
    filterStore.clearSearch()
    filterStore.clearExactSearch()
    resetNonSearchFilters()
    filterStore.categoryFilter = 'all'
    filterStore.subcategoryFilter = 'all'
    filterStore.setExactSearch(tag, exactFilename)
    activeHotTag.value = tag
    return
  }

  filterStore.clearExactSearch()
  resetNonSearchFilters()
  filterStore.categoryFilter = getDefaultCategoryFilter(currentSeries.value)
  filterStore.subcategoryFilter = 'all'
  filterStore.searchQuery = tag
  activeHotTag.value = tag
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
    <div class="container">
      <AnnouncementBanner />

      <MobileSeriesNotice
        v-if="showMobileSeriesNotice"
        :content="mobileNoticeContent"
      />

      <template v-else>
        <div v-if="currentSeries === 'avatar' && !isMobile" class="avatar-banners">
          <DiyAvatarBanner />
          <AvatarMakerBanner @click="handleAvatarMakerClick" />
        </div>

        <HotTagsPanel
          v-if="showHotTagsPanel"
          :is-mobile="isMobile"
          :category-tags="isHotTagsVisible ? hotCategoryTags : []"
          :keyword-tags="isHotTagsVisible ? hotKeywordTags : []"
          :loading="!isHotTagsVisible"
          :active-tag="activeHotTag"
          :current-series="currentSeries"
          @select="handleHotTagSelect"
        />

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
          :total-count="wallpaperStore.displayTotal"
          :loading="loading"
          :hide-format-filter="hideFormatFilter"
          :current-series="currentSeries"
          :show-interaction-summary="showInteractionSummary"
          :interaction-stats="interactionStore.stats"
          :interaction-stats-loaded="interactionStore.statsLoaded"
          @clear-search="handleClearSearch"
          @reset="handleReset"
        />

        <div v-if="error" class="error-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <h3>加载失败</h3>
          <p>{{ error }}</p>
          <button class="series-action-button series-action-button--primary" @click="handleReload">
            重新加载
          </button>
        </div>

        <WallpaperGrid
          v-else
          :wallpapers="filteredWallpapers"
          :loading="loading"
          :search-query="filterStore.searchQuery"
          :total-count="wallpaperStore.displayTotal"
          :has-filters="hasActiveFilters"
          :popularity-data="popularityStore.allTimeData"
          @select="handleSelectWallpaper"
          @reset-filters="handleReset"
        />
      </template>
    </div>

    <HomeModalHost
      :wallpaper="currentWallpaper"
      :is-open="isOpen"
      :use-portrait-modal="usePortraitModal"
      :show-mobile-series-notice="showMobileSeriesNotice"
      @close="close"
      @prev="handlePrevWallpaper"
      @next="handleNextWallpaper"
    />

    <BackToTop />

    <AvatarMakerModal
      :is-open="isAvatarMakerOpen"
      @close="handleAvatarMakerClose"
    />
  </div>
</template>

<style lang="scss" scoped>
.home-page {
  padding: $spacing-md 0 $spacing-2xl;

  @include mobile-only {
    padding-top: calc($spacing-md + 52px);
  }
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
