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

// 是否需要客户端分页（Bing 系列或筛选模式）
const needsClientPagination = computed(() => {
  return wallpaperStore.isFilterMode || SERIES_CONFIG[currentSeries.value]?.isDaily
})

// 筛选和排序后的壁纸列表
// 客户端分页模式：对全量数据筛选
// 服务端分页模式：对当前页数据筛选
const filteredWallpapers = computed(() => {
  const options = {
    skipCategoryFilter: wallpaperStore.isFilterMode,
  }

  if (needsClientPagination.value) {
    // 客户端分页：对全量数据进行筛选
    // Bing 系列使用 wallpapers（存储全量数据）
    // 筛选模式使用 filterModeAllData
    const sourceData = wallpaperStore.isFilterMode
      ? wallpaperStore.filterModeAllData
      : wallpaperStore.wallpapers
    return filterStore.getFilteredAndSorted(sourceData, options)
  }

  // 服务端分页：对当前页数据筛选
  return filterStore.getFilteredAndSorted(wallpaperStore.wallpapers, options)
})

// 分页后的数据（客户端分页模式下进行分页）
const paginatedWallpapers = computed(() => {
  if (!needsClientPagination.value) {
    // 服务端分页：直接返回筛选后的当前页数据
    return filteredWallpapers.value
  }

  // 客户端分页：对筛选后的全量数据进行分页
  // 移动端需要显示从第1页到当前页的所有数据（无限滚动）
  // PC端只显示当前页
  if (isMobileDevice()) {
    // 移动端：返回从第1页到当前页的所有数据
    const endIdx = wallpaperStore.currentPage * wallpaperStore.pageSize
    return filteredWallpapers.value.slice(0, endIdx)
  }
  else {
    // PC端：只返回当前页数据
    const startIdx = (wallpaperStore.currentPage - 1) * wallpaperStore.pageSize
    const endIdx = startIdx + wallpaperStore.pageSize
    return filteredWallpapers.value.slice(startIdx, endIdx)
  }
})

// 总页数（客户端分页模式下基于筛选后的数据计算）
const effectiveTotalPages = computed(() => {
  if (!needsClientPagination.value) {
    return wallpaperStore.totalPages
  }
  return Math.ceil(filteredWallpapers.value.length / wallpaperStore.pageSize) || 1
})

// 总数（客户端分页模式下基于筛选后的数据）
const effectiveTotal = computed(() => {
  if (!needsClientPagination.value) {
    return wallpaperStore.expectedTotal
  }
  return filteredWallpapers.value.length
})

// 结果数量（筛选后的总数）
const resultCount = computed(() => filteredWallpapers.value.length)

// 是否有激活的筛选条件
const hasActiveFilters = computed(() => filterStore.hasActiveFilters())

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
 * 获取当前月份（YYYY-MM 格式）
 */
function getCurrentMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * 加载系列数据（防止重复加载）
 * 系列切换时清空所有筛选条件，走各自系列的默认逻辑
 */
async function loadSeriesData(series) {
  if (!series || isLoading.value)
    return

  isLoading.value = true

  try {
    // 系列切换时，清空所有筛选条件
    filterStore.subcategoryFilter = 'all'
    filterStore.formatFilter = 'all'
    filterStore.resolutionFilter = 'all'
    filterStore.clearCategoryCache()
    filterStore.setDefaultSortBySeries(series)

    const isBingSeries = SERIES_CONFIG[series]?.isDaily

    // 先加载数据
    await Promise.all([
      wallpaperStore.initSeriesPaginated(series),
      popularityStore.fetchPopularityData(series),
    ])

    // 数据加载完成后，设置分类筛选的默认值
    // Bing 系列：当前月份（从 store 同步）
    // 其他系列：全部分类
    if (isBingSeries) {
      filterStore.categoryFilter = wallpaperStore.currentFilterCategory || getCurrentMonth()
    }
    else {
      filterStore.categoryFilter = 'all'
    }
  }
  finally {
    isLoading.value = false
  }
}

// ========================================
// Filter Actions
// ========================================

function handleReset() {
  // 重置所有筛选条件到各系列的默认值
  const isBingSeries = SERIES_CONFIG[currentSeries.value]?.isDaily

  // 清空其他筛选条件
  filterStore.subcategoryFilter = 'all'
  filterStore.formatFilter = 'all'
  filterStore.resolutionFilter = 'all'

  if (isBingSeries) {
    // Bing 系列：重置到当前月份
    const currentMonth = getCurrentMonth()
    filterStore.categoryFilter = currentMonth
    // watch 会自动调用 switchToFilterMode
  }
  else {
    // 其他系列：重置到全部分类
    filterStore.categoryFilter = 'all'
    // watch 会自动调用 exitFilterMode
  }
}

function handleReload() {
  wallpaperStore.initSeriesPaginated(currentSeries.value, true)
}

// ========================================
// Pagination Actions
// ========================================

/**
 * PC 端分页切换（支持客户端分页模式）
 */
function handlePageChange(page) {
  if (needsClientPagination.value) {
    // 客户端分页：直接更新页码，paginatedWallpapers 会自动计算
    wallpaperStore.currentPage = page
  }
  else {
    wallpaperStore.goToPage(page)
  }
}

/**
 * 移动端加载下一页（支持客户端分页模式）
 */
function handleLoadNextPage() {
  if (needsClientPagination.value) {
    // 客户端分页：直接更新页码
    if (wallpaperStore.currentPage < effectiveTotalPages.value) {
      wallpaperStore.currentPage++
    }
  }
  else {
    wallpaperStore.loadNextPage()
  }
}

/**
 * 切换每页显示条数
 */
function handleSizeChange(size) {
  // 计算当前第一条数据的索引，尽量保持位置
  const firstItemIndex = (wallpaperStore.currentPage - 1) * wallpaperStore.pageSize
  // 更新 pageSize
  wallpaperStore.pageSize = size
  // 计算新的页码
  const newPage = Math.floor(firstItemIndex / size) + 1
  wallpaperStore.currentPage = Math.max(1, Math.min(newPage, effectiveTotalPages.value))
}

// ========================================
// Lifecycle & Watchers
// ========================================

// 监听分类筛选变化，切换数据源
watch(() => filterStore.categoryFilter, async (newCategory, oldCategory) => {
  if (!isInitialized.value || newCategory === oldCategory) {
    return
  }

  const isBingSeries = SERIES_CONFIG[currentSeries.value]?.isDaily

  if (newCategory === 'all') {
    if (isBingSeries) {
      // Bing 系列选择"全部月份"时，显示全量数据（带分页）
      await wallpaperStore.switchToFilterMode('all')
    }
    else {
      // 其他系列选择"全部"时，退出筛选模式，恢复分页数据
      if (wallpaperStore.isFilterMode) {
        await wallpaperStore.exitFilterMode()
      }
    }
  }
  else {
    // 选择具体分类/月份时，切换到筛选模式
    await wallpaperStore.switchToFilterMode(newCategory)
  }
})

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

// 监听筛选条件变化，重置页码（筛选模式下）
watch(
  () => [filterStore.formatFilter, filterStore.resolutionFilter, filterStore.sortBy],
  () => {
    if (wallpaperStore.isFilterMode && wallpaperStore.currentPage !== 1) {
      wallpaperStore.currentPage = 1
    }
  },
)

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
        :total-count="effectiveTotal"
        :page-count="paginatedWallpapers.length"
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
        :wallpapers="paginatedWallpapers"
        :loading="loading"
        :search-query="filterStore.searchQuery"
        :total-count="effectiveTotal"
        :has-filters="hasActiveFilters"
        :popularity-data="popularityStore.allTimeData"
        :current-page="wallpaperStore.currentPage"
        :total-pages="effectiveTotalPages"
        :page-size="wallpaperStore.pageSize"
        :has-next-page="wallpaperStore.currentPage < effectiveTotalPages"
        :expected-total="effectiveTotal"
        @select="handleSelectWallpaper"
        @reset-filters="handleReset"
        @page-change="handlePageChange"
        @load-next-page="handleLoadNextPage"
        @size-change="handleSizeChange"
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
