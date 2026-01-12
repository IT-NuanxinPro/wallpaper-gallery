<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import { DEVICE_SERIES, SERIES_CONFIG } from '@/utils/constants'

const route = useRoute()
const router = useRouter()

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
  if (!series || isLoading.value)
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

// 初始化（只执行一次）
onMounted(async () => {
  // 如果路由带有系列参数，先检查设备兼容性
  const routeSeries = route.meta?.series
  if (routeSeries) {
    // 检查当前系列是否对当前设备可用
    const deviceType = isMobileDevice() ? 'mobile' : 'desktop'
    const availableSeries = DEVICE_SERIES[deviceType] || DEVICE_SERIES.desktop

    // 如果当前系列对设备不可用，等待路由守卫重定向
    // 不加载数据，避免显示不兼容的内容
    if (!availableSeries.includes(routeSeries)) {
      console.log(`[Home] 系列 "${routeSeries}" 对设备类型 "${deviceType}" 不可用，等待重定向...`)
      // 主动重定向到正确的系列（兜底保护）
      const defaultSeries = deviceType === 'mobile' ? 'mobile' : 'desktop'
      router.replace(`/${defaultSeries}`)
      return
    }

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

      <!-- DIY 头像工具入口 - 仅头像系列显示 -->
      <DiyAvatarBanner v-if="currentSeries === 'avatar'" />

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
        <button class="btn btn--primary" @click="handleReload">
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
    </div>

    <!-- Modal - 根据系列类型选择弹窗 -->
    <!-- 横屏弹窗：电脑壁纸 -->
    <WallpaperModal
      v-if="!usePortraitModal"
      :wallpaper="currentWallpaper"
      :is-open="isOpen"
      @close="close"
      @prev="handlePrevWallpaper"
      @next="handleNextWallpaper"
    />

    <!-- 竖屏弹窗：手机壁纸、头像 -->
    <PortraitWallpaperModal
      v-else
      :wallpaper="currentWallpaper"
      :is-open="isOpen"
      @close="close"
      @prev="handlePrevWallpaper"
      @next="handleNextWallpaper"
    />

    <!-- Back to Top -->
    <BackToTop />
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
