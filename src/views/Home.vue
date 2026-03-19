<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AvatarMakerBanner from '@/components/avatar/AvatarMakerBanner.vue'
import AvatarMakerModal from '@/components/avatar/AvatarMakerModal/index.vue'
import DiyAvatarBanner from '@/components/avatar/DiyAvatarBanner.vue'
import AnnouncementBanner from '@/components/common/feedback/AnnouncementBanner.vue'
import FilterPanel from '@/components/common/form/FilterPanel.vue'
import BackToTop from '@/components/common/navigation/BackToTop.vue'
import PortraitWallpaperModal from '@/components/wallpaper/PortraitWallpaperModal/index.vue'
import WallpaperGrid from '@/components/wallpaper/WallpaperGrid/index.vue'
import WallpaperModal from '@/components/wallpaper/WallpaperModal/index.vue'

import { isMobileDevice } from '@/composables/useDevice'
// Composables
import { useModal } from '@/composables/useModal'
// Pinia Stores
import { useFilterStore } from '@/stores/filter'
import { usePopularityStore } from '@/stores/popularity'
import { useSeriesStore } from '@/stores/series'
import { useWallpaperStore } from '@/stores/wallpaper'
// Constants
import { SERIES_CONFIG } from '@/utils/constants'

const route = useRoute()

// ========================================
// Stores
// ========================================
const seriesStore = useSeriesStore()
const wallpaperStore = useWallpaperStore()
const popularityStore = usePopularityStore()
const filterStore = useFilterStore()

// ========================================
// 初始化标记（防止重复加载）
// ========================================
const isInitialized = ref(false)
const isLoading = ref(false)

// ========================================
// Computed
// ========================================

// 当前系列
const currentSeries = computed(() => seriesStore.currentSeries)
const isMobile = computed(() => isMobileDevice())
const showMobileSeriesNotice = computed(() => isMobile.value && ['desktop', 'bing'].includes(currentSeries.value))

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

// 是否使用竖屏弹窗
const usePortraitModal = computed(() => ['mobile', 'avatar'].includes(currentSeries.value))

// 是否隐藏格式筛选（Bing 系列格式固定为 JPG）
const hideFormatFilter = computed(() => SERIES_CONFIG[currentSeries.value]?.hideFormatFilter === true)

// 整体加载状态
const loading = computed(() => isLoading.value || wallpaperStore.loading || popularityStore.loading)

// 错误状态
const error = computed(() => wallpaperStore.error)

// 分类选项
const categoryOptions = computed(() =>
  filterStore.createCategoryOptions(wallpaperStore.wallpapers),
)

// 二级分类选项
const subcategoryOptions = computed(() =>
  filterStore.createSubcategoryOptions(categoryOptions.value),
)

// 筛选和排序后的壁纸列表
const filteredWallpapers = computed(() =>
  filterStore.getFilteredAndSorted(wallpaperStore.wallpapers),
)

// 结果数量
const resultCount = computed(() => filteredWallpapers.value.length)

// 是否有激活的筛选条件
const hasActiveFilters = computed(() => filterStore.hasActiveFilters(currentSeries.value))

// ========================================
// Modal Management
// ========================================
const { isOpen, currentData, open, close, updateData } = useModal()

const currentWallpaper = computed(() => currentData.value)

function handleSelectWallpaper(wallpaper) {
  open(wallpaper)
}

function handlePrevWallpaper() {
  if (!currentWallpaper.value)
    return
  const prev = wallpaperStore.getPrevWallpaper(currentWallpaper.value.id)
  if (prev) {
    updateData(prev)
  }
}

function handleNextWallpaper() {
  if (!currentWallpaper.value)
    return
  const next = wallpaperStore.getNextWallpaper(currentWallpaper.value.id)
  if (next) {
    updateData(next)
  }
}

// ========================================
// Data Loading
// ========================================

/**
 * 加载系列数据（防止重复加载）
 */
async function loadSeriesData(series) {
  if (!series || isLoading.value || showMobileSeriesNotice.value)
    return

  isLoading.value = true

  try {
    // 设置默认排序方式
    filterStore.setDefaultSortBySeries(series)

    // 并行加载壁纸数据和热门数据
    await Promise.all([
      wallpaperStore.initSeries(series),
      popularityStore.fetchPopularityData(series),
    ])
  }
  finally {
    isLoading.value = false
  }
}

// ========================================
// Filter Actions
// ========================================

function handleReset() {
  filterStore.resetFilters(filterStore.sortBy, currentSeries.value)
}

function handleReload() {
  wallpaperStore.initSeries(currentSeries.value, true)
}

// ========================================
// Avatar Maker Modal
// ========================================
const isAvatarMakerOpen = ref(false)

function handleAvatarMakerClick() {
  isAvatarMakerOpen.value = true
}

function handleAvatarMakerClose() {
  isAvatarMakerOpen.value = false
}

// ========================================
// Lifecycle & Watchers
// ========================================

// 监听路由变化，切换系列（仅在初始化后生效）
watch(() => route.meta?.series, (newSeries, oldSeries) => {
  if (!isInitialized.value)
    return
  if (newSeries && newSeries !== oldSeries) {
    seriesStore.initFromRoute(newSeries)
  }
})

// 监听系列变化，重新加载数据（仅在初始化后生效）
watch(currentSeries, async (newSeries, oldSeries) => {
  if (!isInitialized.value)
    return
  if (newSeries && newSeries !== oldSeries) {
    await loadSeriesData(newSeries)
  }
})

// 监听 Bing 系列的月份筛选变化，按需加载对应年份数据
watch(() => filterStore.categoryFilter, async (newValue) => {
  if (!isInitialized.value || currentSeries.value !== 'bing' || showMobileSeriesNotice.value)
    return

  // 检查是否是年月格式（YYYY-MM）
  if (newValue && /^\d{4}-\d{2}$/.test(newValue)) {
    const year = Number.parseInt(newValue.split('-')[0])
    // 按需加载该年份的数据
    await wallpaperStore.loadBingYear(year)
  }
})

// 初始化（只执行一次）
onMounted(async () => {
  const routeSeries = route.meta?.series
  if (routeSeries) {
    seriesStore.currentSeries = routeSeries
  }
  else if (!seriesStore.currentSeries) {
    seriesStore.initSeries()
  }

  // 加载数据
  await loadSeriesData(seriesStore.currentSeries)

  // 标记初始化完成
  isInitialized.value = true
})
</script>

<template>
  <div class="home-page">
    <div class="container">
      <!-- Announcement Banner -->
      <AnnouncementBanner />

      <div v-if="showMobileSeriesNotice" class="series-notice-card">
        <div class="series-notice-card__badge">
          {{ mobileNoticeContent.eyebrow }}
        </div>

        <div class="series-notice-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="4" y="3" width="16" height="18" rx="3" />
            <path d="M9 7h6" />
            <path d="M12 17h.01" />
          </svg>
        </div>

        <h1 class="series-notice-card__title">
          {{ mobileNoticeContent.title }}
        </h1>

        <p class="series-notice-card__description">
          {{ mobileNoticeContent.description }}
        </p>

        <div class="series-notice-card__actions">
          <RouterLink class="series-notice-card__button series-notice-card__button--primary" to="/mobile">
            去手机壁纸
          </RouterLink>
          <RouterLink class="series-notice-card__button series-notice-card__button--secondary" to="/avatar">
            去头像专区
          </RouterLink>
        </div>
      </div>

      <template v-else>
        <!-- DIY 头像工具入口 - 仅头像系列且 PC 端显示 -->
        <div v-if="currentSeries === 'avatar'" class="avatar-banners">
          <DiyAvatarBanner />
          <AvatarMakerBanner v-if="!isMobile" @click="handleAvatarMakerClick" />
        </div>

        <!-- Filter Panel -->
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

        <!-- Error State -->
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

        <!-- Wallpaper Grid -->
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

    <!-- Modal - 根据系列类型选择弹窗 -->
    <!-- 横屏弹窗：电脑壁纸 -->
    <WallpaperModal
      v-if="!usePortraitModal && !showMobileSeriesNotice"
      :wallpaper="currentWallpaper"
      :is-open="isOpen"
      @close="close"
      @prev="handlePrevWallpaper"
      @next="handleNextWallpaper"
    />

    <!-- 竖屏弹窗：手机壁纸、头像 -->
    <PortraitWallpaperModal
      v-else-if="!showMobileSeriesNotice"
      :wallpaper="currentWallpaper"
      :is-open="isOpen"
      @close="close"
      @prev="handlePrevWallpaper"
      @next="handleNextWallpaper"
    />

    <!-- Back to Top -->
    <BackToTop />

    <!-- Avatar Maker Modal - 头像自制弹窗 -->
    <AvatarMakerModal
      :is-open="isAvatarMakerOpen"
      @close="handleAvatarMakerClose"
    />
  </div>
</template>

<style lang="scss" scoped>
.home-page {
  padding: $spacing-md 0 $spacing-2xl;

  // 移动端：为 fixed 的筛选栏预留空间
  @include mobile-only {
    padding-top: calc($spacing-md + 52px); // 52px 为筛选栏高度
  }
}

.series-notice-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: $spacing-2xl;
  margin-top: $spacing-lg;
  border-radius: $radius-xl;
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.08), rgba(99, 102, 241, 0.02)), var(--color-bg-secondary);
  border: 1px solid rgba(99, 102, 241, 0.14);
  box-shadow: var(--shadow-md);

  @include mobile-only {
    padding: $spacing-xl $spacing-lg;
    margin-top: $spacing-md;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: $spacing-xs $spacing-md;
    margin-bottom: $spacing-md;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-accent);
    background: rgba(99, 102, 241, 0.1);
    border-radius: $radius-full;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    margin-bottom: $spacing-lg;
    color: var(--color-accent);
    background: rgba(99, 102, 241, 0.1);
    border-radius: $radius-full;

    svg {
      width: 32px;
      height: 32px;
    }
  }

  &__title {
    max-width: 520px;
    margin-bottom: $spacing-md;
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    color: var(--color-text-primary);
    line-height: 1.4;

    @include mobile-only {
      font-size: $font-size-lg;
    }
  }

  &__description {
    max-width: 620px;
    margin-bottom: $spacing-xl;
    font-size: $font-size-md;
    color: var(--color-text-secondary);
    line-height: 1.8;

    @include mobile-only {
      margin-bottom: $spacing-lg;
      font-size: $font-size-sm;
    }
  }

  &__actions {
    display: flex;
    gap: $spacing-md;

    @include mobile-only {
      width: 100%;
      flex-direction: column;
    }
  }

  &__button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 144px;
    padding: $spacing-sm $spacing-xl;
    border-radius: $radius-full;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    text-decoration: none;
    transition:
      transform var(--transition-fast),
      box-shadow var(--transition-fast),
      background-color var(--transition-fast),
      color var(--transition-fast),
      border-color var(--transition-fast);

    @include mobile-only {
      width: 100%;
    }

    &:hover {
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    &--primary {
      color: #fff;
      background: var(--color-accent);
    }

    &--secondary {
      color: var(--color-text-primary);
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
    }
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

// 头像系列入口卡片容器
.avatar-banners {
  display: flex;
  gap: $spacing-lg;
  margin-bottom: $spacing-xl;

  // PC 端：两个卡片各占 50%
  > :deep(.diy-avatar-banner),
  > :deep(.avatar-maker-banner) {
    flex: 1;
    min-width: 0; // 防止 flex 子元素溢出
    margin-bottom: 0; // 移除单独的 margin-bottom，由容器统一控制
  }

  // 移动端：垂直堆叠
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
