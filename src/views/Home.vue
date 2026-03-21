<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import AvatarMakerBanner from '@/components/avatar/AvatarMakerBanner.vue'
import AvatarMakerModal from '@/components/avatar/AvatarMakerModal/index.vue'
import DiyAvatarBanner from '@/components/avatar/DiyAvatarBanner.vue'
import AnnouncementBanner from '@/components/common/feedback/AnnouncementBanner.vue'
import BackToTop from '@/components/common/navigation/BackToTop.vue'
import HomeModalHost from '@/components/home/HomeModalHost.vue'
import MobileSeriesNotice from '@/components/home/MobileSeriesNotice.vue'
import FilterPanel from '@/components/wallpaper/filter/index.vue'
import WallpaperGrid from '@/components/wallpaper/WallpaperGrid/index.vue'
import { useHomeDataLoader } from '@/composables/home/useHomeDataLoader'
import { useHomeSeriesSync } from '@/composables/home/useHomeSeriesSync'
import { useWallpaperNavigator } from '@/composables/home/useWallpaperNavigator'
import { useDevice } from '@/composables/useDevice'
import { useFilterStore } from '@/stores/filter'
import { usePopularityStore } from '@/stores/popularity'
import { useSeriesStore } from '@/stores/series'
import { useWallpaperStore } from '@/stores/wallpaper'
import { SERIES_CONFIG } from '@/utils/config/constants'

const route = useRoute()

const seriesStore = useSeriesStore()
const wallpaperStore = useWallpaperStore()
const popularityStore = usePopularityStore()
const filterStore = useFilterStore()
const { isMobile } = useDevice()

const currentSeries = computed(() => seriesStore.currentSeries)
const showMobileSeriesNotice = computed(() => isMobile.value && ['desktop', 'bing'].includes(currentSeries.value))
const isSeriesContentReady = computed(() => wallpaperStore.currentRenderedSeries === currentSeries.value)
const visibleWallpapers = computed(() => isSeriesContentReady.value ? wallpaperStore.wallpapers : [])

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
const resultCount = computed(() => filteredWallpapers.value.length)
const hasActiveFilters = computed(() => filterStore.hasActiveFilters(currentSeries.value))

const routeSyncReady = ref(false)
const { syncSeriesFromRoute } = useHomeSeriesSync(route, seriesStore, routeSyncReady)
syncSeriesFromRoute()

const { error, handleReload, loading } = useHomeDataLoader({
  currentSeries,
  showMobileSeriesNotice,
  filterStore,
  popularityStore,
  seriesStore,
  syncSeriesFromRoute,
  wallpaperStore,
})

routeSyncReady.value = true

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
        <div v-if="currentSeries === 'avatar'" class="avatar-banners">
          <DiyAvatarBanner />
          <AvatarMakerBanner v-if="!isMobile" @click="handleAvatarMakerClick" />
        </div>

        <FilterPanel
          v-model:sort-by="filterStore.sortBy"
          v-model:format-filter="filterStore.formatFilter"
          v-model:resolution-filter="filterStore.resolutionFilter"
          v-model:category-filter="filterStore.categoryFilter"
          v-model:subcategory-filter="filterStore.subcategoryFilter"
          :category-options="categoryOptions"
          :subcategory-options="subcategoryOptions"
          :result-count="resultCount"
          :total-count="wallpaperStore.displayTotal"
          :loading="loading"
          :hide-format-filter="hideFormatFilter"
          :current-series="currentSeries"
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
    background: var(--color-accent);
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
