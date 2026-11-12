<script setup>
import { computed, defineAsyncComponent, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MobileCategoryDrawer from '@/components/common/navigation/MobileCategoryDrawer.vue'
import AnimatedNumber from '@/components/common/ui/AnimatedNumber.vue'
import MobileFilterBar from '@/components/wallpaper/filter/mobile/MobileFilterBar.vue'
import MobileFilterPopup from '@/components/wallpaper/filter/mobile/MobileFilterPopup.vue'
import FilterSummary from '@/components/wallpaper/filter/shared/FilterSummary.vue'
import { useDevice } from '@/composables/useDevice'
import { trackFilter } from '@/utils/common/analytics'
import { FORMAT_OPTIONS, RESOLUTION_OPTIONS, SORT_OPTIONS } from '@/utils/config/constants'
import { getDefaultCategoryFilter, hasActiveSeriesFilters } from '@/utils/filter/defaults'

const props = defineProps({
  previewResults: { type: Function, default: () => ({ status: 'loading', count: null }) },
  sortBy: {
    type: String,
    default: 'newest',
  },
  formatFilter: {
    type: String,
    default: 'all',
  },
  resolutionFilter: {
    type: String,
    default: 'all',
  },
  searchQuery: {
    type: String,
    default: '',
  },
  categoryFilter: {
    type: String,
    default: 'all',
  },
  subcategoryFilter: {
    type: String,
    default: 'all',
  },
  categoryOptions: {
    type: Array,
    default: () => [{ value: 'all', label: '全部分类' }],
  },
  // 二级分类选项（根据当前一级分类动态变化）
  subcategoryOptions: {
    type: Array,
    default: () => [{ value: 'all', label: '全部' }],
  },
  resultCount: {
    type: Number,
    default: 0,
  },
  totalCount: {
    type: Number,
    default: 0,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  // 是否隐藏格式筛选（用于 Bing 等格式固定的系列）
  hideFormatFilter: {
    type: Boolean,
    default: false,
  },
  // 当前系列 ID（用于判断是否显示 Bing 日期选择器）
  currentSeries: {
    type: String,
    default: '',
  },
  showInteractionSummary: {
    type: Boolean,
    default: false,
  },
  interactionStats: {
    type: Object,
    default: () => ({ likes: 0, collections: 0 }),
  },
  interactionStatsLoaded: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['clearSearch', 'update:sortBy', 'update:formatFilter', 'update:resolutionFilter', 'update:categoryFilter', 'update:subcategoryFilter', 'reset'])

const { isMobile } = useDevice()
const panelElement = ref(null)
let panelResizeObserver
function updatePanelHeight() {
  const height = isMobile.value ? panelElement.value?.getBoundingClientRect().height : 60
  if (height)
    document.documentElement.style.setProperty('--browse-filter-height', `${Math.ceil(height)}px`)
}
onMounted(() => {
  updatePanelHeight()
  if (typeof ResizeObserver !== 'undefined') {
    panelResizeObserver = new ResizeObserver(updatePanelHeight)
    panelResizeObserver.observe(panelElement.value)
  }
})
onActivated(updatePanelHeight)
watch(isMobile, updatePanelHeight, { flush: 'post' })
onBeforeUnmount(() => {
  panelResizeObserver?.disconnect()
  document.documentElement.style.removeProperty('--browse-filter-height')
})
const isVideoSeries = computed(() => props.currentSeries === 'video')

const DesktopFilterControls = defineAsyncComponent({
  loader: () => import('@/components/wallpaper/filter/desktop/DesktopFilterControls.vue'),
  suspensible: false,
})

// 移动端弹窗状态
const showFilterPopup = ref(false) // 格式+排序筛选弹窗
const showCategoryDrawer = ref(false) // 分类选择抽屉

// 临时筛选值（用于弹窗内）
const tempSortBy = ref(props.sortBy)
const tempFormatFilter = ref(props.formatFilter)
const draftPreview = computed(() => props.previewResults({ sortBy: tempSortBy.value, formatFilter: tempFormatFilter.value }))
const filterChips = computed(() => {
  const chips = []
  const add = (field, value, label) => chips.push({ field, label, value })
  if (props.categoryFilter !== getDefaultCategoryFilter(props.currentSeries))
    add('categoryFilter', props.categoryFilter, getCategoryLabel(props.categoryFilter))
  if (props.subcategoryFilter !== 'all')
    add('subcategoryFilter', props.subcategoryFilter, props.subcategoryFilter)
  if (!isVideoSeries.value && !props.hideFormatFilter && props.formatFilter !== 'all')
    add('formatFilter', props.formatFilter, FORMAT_OPTIONS.find(option => option.value === props.formatFilter)?.label || props.formatFilter)
  if (props.resolutionFilter !== 'all')
    add('resolutionFilter', props.resolutionFilter, RESOLUTION_OPTIONS.find(option => option.value === props.resolutionFilter)?.label || props.resolutionFilter)
  if (props.sortBy !== 'newest')
    add('sortBy', props.sortBy, SORT_OPTIONS.find(option => option.value === props.sortBy)?.label || props.sortBy)
  return chips
})

function removeFilter(field) {
  const defaults = { categoryFilter: getDefaultCategoryFilter(props.currentSeries), subcategoryFilter: 'all', formatFilter: 'all', resolutionFilter: 'all', sortBy: 'newest' }
  emit(`update:${field}`, defaults[field])
  if (field === 'categoryFilter')
    emit('update:subcategoryFilter', 'all')
}
// 是否有激活的筛选条件
const hasActiveFilters = computed(() => {
  return hasActiveSeriesFilters({
    sortBy: props.sortBy,
    formatFilter: props.formatFilter,
    resolutionFilter: props.resolutionFilter,
    categoryFilter: props.categoryFilter,
    subcategoryFilter: props.subcategoryFilter,
    currentSeries: props.currentSeries,
    defaultSort: 'newest',
  })
})

function getCategoryLabel(categoryValue) {
  const matched = props.categoryOptions.find(option => option.value === categoryValue)
  return matched?.label || categoryValue
}

// 当前分类显示文本
const currentCategoryLabel = computed(() => {
  if (props.categoryFilter === 'all') {
    return '分类'
  }
  let label = getCategoryLabel(props.categoryFilter)
  if (props.subcategoryFilter !== 'all') {
    label += ` · ${props.subcategoryFilter}`
  }
  return label
})

// 分类是否激活
const isCategoryActive = computed(() => {
  return props.categoryFilter !== 'all'
})

function handleSortChange(value) {
  emit('update:sortBy', value)
  trackFilter('sort', value)
}

function handleFormatChange(value) {
  emit('update:formatFilter', value)
  trackFilter('format', value)
}

function handleResolutionChange(value) {
  emit('update:resolutionFilter', value)
  trackFilter('resolution', value)
}

// 移动端分类变化处理（来自 MobileCategoryDrawer，不重置子分类，由抽屉组件自行处理）
function handleCategoryChange(value) {
  emit('update:categoryFilter', value)
  // 注意：移动端抽屉会在 handleConfirm 中同时发送父分类和子分类
  // 这里不再强制重置子分类，由抽屉组件管理
  trackFilter('category', value)
}

function handleSubcategoryChange(value) {
  emit('update:subcategoryFilter', value)
  trackFilter('subcategory', value)
}

// 分类变化处理（来自 CategoryDropdown）
function handleCategoryUpdate(value) {
  emit('update:categoryFilter', value)
  trackFilter('category', value)
}

function handleSubcategoryUpdate(value) {
  emit('update:subcategoryFilter', value)
  if (value !== 'all') {
    trackFilter('subcategory', value)
  }
}

function handleReset() {
  emit('update:sortBy', 'newest')
  emit('update:formatFilter', 'all')
  emit('update:resolutionFilter', 'all')
  emit('update:categoryFilter', getDefaultCategoryFilter(props.currentSeries))
  emit('update:subcategoryFilter', 'all')
  emit('reset')
}

// 移动端：打开分类抽屉
function openCategoryDrawer() {
  showCategoryDrawer.value = true
}

// 移动端：分类选择确认
function handleCategoryConfirm() {
  trackFilter('category', props.categoryFilter)
  if (props.subcategoryFilter !== 'all') {
    trackFilter('subcategory', props.subcategoryFilter)
  }
}

// 移动端：打开筛选弹窗（格式+排序）
function openFilterPopup() {
  tempSortBy.value = props.sortBy
  tempFormatFilter.value = props.formatFilter
  showFilterPopup.value = true
}

function closeFilterPopup() {
  showFilterPopup.value = false
}

function applyFilters() {
  emit('update:sortBy', tempSortBy.value)
  emit('update:formatFilter', tempFormatFilter.value)

  if (tempSortBy.value !== props.sortBy) {
    trackFilter('sort', tempSortBy.value)
  }
  if (tempFormatFilter.value !== props.formatFilter) {
    trackFilter('format', tempFormatFilter.value)
  }

  closeFilterPopup()
}

function resetFilters() {
  tempSortBy.value = 'newest'
  tempFormatFilter.value = 'all'
}
</script>

<template>
  <div ref="panelElement" class="filter-panel" :class="{ 'has-filters': hasActiveFilters }">
    <FilterSummary
      :active-search-query="props.searchQuery"
      :active-chips="filterChips"
      :category-filter="categoryFilter"
      :current-series="currentSeries"
      :has-active-filters="hasActiveFilters"
      :is-mobile-or-tablet="isMobile"
      :loading="loading"
      :result-count="resultCount"
      :subcategory-filter="subcategoryFilter"
      :total-count="totalCount"
      @clear-search="emit('clearSearch')"
      @reset="handleReset"
      @remove-filter="removeFilter"
    />

    <div v-if="!isMobile && showInteractionSummary" class="desktop-interaction-summary">
      <article class="summary-chip summary-chip--like">
        <span class="summary-chip__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="m12 21-1.45-1.32C5.4 15.03 2 11.95 2 8.5 2 5.42 4.42 3 7.5 3A5.3 5.3 0 0 1 12 5.09 5.3 5.3 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.45-3.4 6.53-8.55 11.18z" />
          </svg>
        </span>
        <span class="summary-chip__label">已喜欢</span>
        <strong class="summary-chip__value">
          <AnimatedNumber
            v-if="interactionStatsLoaded"
            :value="interactionStats.likes || 0"
            :animate-on-mount="false"
          />
          <span v-else>--</span>
        </strong>
      </article>

      <article class="summary-chip summary-chip--collect">
        <span class="summary-chip__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </span>
        <span class="summary-chip__label">已收藏</span>
        <strong class="summary-chip__value">
          <AnimatedNumber
            v-if="interactionStatsLoaded"
            :value="interactionStats.collections || 0"
            :animate-on-mount="false"
          />
          <span v-else>--</span>
        </strong>
      </article>
    </div>

    <div v-if="!isMobile" class="desktop-filter-slot">
      <DesktopFilterControls
        :category-filter="categoryFilter"
        :category-options="categoryOptions"
        :current-series="currentSeries"
        :format-filter="formatFilter"
        :hide-category-filter="isVideoSeries"
        :hide-format-filter="hideFormatFilter || isVideoSeries"
        :resolution-filter="resolutionFilter"
        :sort-by="sortBy"
        :subcategory-filter="subcategoryFilter"
        @category-update="handleCategoryUpdate"
        @subcategory-update="handleSubcategoryUpdate"
        @format-change="handleFormatChange"
        @resolution-change="handleResolutionChange"
        @sort-change="handleSortChange"
      />
    </div>
    <MobileFilterBar
      v-else
      :current-category-label="currentCategoryLabel"
      :hide-category-filter="isVideoSeries"
      :is-category-active="isCategoryActive"
      :active-count="filterChips.length"
      :category-open="showCategoryDrawer"
      :filter-open="showFilterPopup"
      @open-category="openCategoryDrawer"
      @open-filter="openFilterPopup"
    />
    <!-- 移动端分类选择抽屉（左右分栏） -->
    <MobileCategoryDrawer
      v-if="!isVideoSeries"
      v-model:show="showCategoryDrawer"
      :category-options="categoryOptions"
      :category-filter="categoryFilter"
      :subcategory-filter="subcategoryFilter"
      :preview-results="previewResults"
      @update:category-filter="handleCategoryChange"
      @update:subcategory-filter="handleSubcategoryChange"
      @confirm="handleCategoryConfirm"
    />

    <MobileFilterPopup
      v-model:show="showFilterPopup"
      v-model:temp-format-filter="tempFormatFilter"
      v-model:temp-sort-by="tempSortBy"
      :hide-format-filter="hideFormatFilter || isVideoSeries"
      :preview="draftPreview"
      @close="closeFilterPopup"
      @reset="resetFilters"
      @apply="applyFilters"
    />
  </div>
</template>

<style lang="scss" scoped>
.filter-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px 12px;
  padding: 10px 14px;
  // 吸顶筛选栏使用不透明表面，避免随长列表滚动持续重算模糊。
  background-color: var(--color-bg-card);
  border-radius: $radius-lg;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.08);
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
  margin-bottom: $spacing-lg;

  // 吸顶效果（PC 和移动端通用）
  position: -webkit-sticky;
  position: sticky;
  top: $header-height;
  z-index: 89;

  // 确保 sticky 在各浏览器正常工作
  -webkit-transform: translateZ(0);
  transform: translateZ(0);

  [data-theme='dark'] & {
    background: var(--color-bg-card);
    border-color: rgba(255, 255, 255, 0.08);
  }

  &.has-filters {
    border-color: var(--accent-border-strong);
    background: var(--color-bg-card);
    box-shadow: 0 4px 30px var(--accent-ring);

    [data-theme='dark'] & {
      background: var(--color-bg-card);
      border-color: var(--accent-border);
    }
  }
}

.desktop-filter-slot {
  display: contents;
}

.filter-panel :deep(.filter-left) {
  flex: 0 1 auto;
  min-height: 44px;
  min-width: 0;
  flex-wrap: wrap;
  gap: 6px 10px;
}

.filter-panel :deep(.search-context-wrap) {
  flex-wrap: wrap;
}

.filter-panel :deep(.search-context) {
  white-space: normal;
  overflow-wrap: anywhere;
}

.desktop-interaction-summary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  flex-shrink: 0;
}

.summary-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 132px;
  padding: 7px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.26);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.48),
    0 6px 18px rgba(15, 23, 42, 0.05);

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.72);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow:
      inset 0 1px 0 rgba(191, 219, 254, 0.05),
      0 8px 20px rgba(2, 8, 23, 0.18);
  }
}

.summary-chip__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 10px;
  flex-shrink: 0;

  svg {
    width: 16px;
    height: 16px;
  }
}

.summary-chip__label {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: $font-weight-semibold;
  white-space: nowrap;
}

.summary-chip__value {
  margin-left: auto;
  color: var(--color-text-primary);
  font-size: 18px;
  font-weight: $font-weight-bold;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.summary-chip--like {
  .summary-chip__icon {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.12);
  }
}

.summary-chip--collect {
  .summary-chip__icon {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.14);
  }
}

@media (min-width: 768px) and (max-width: 1280px) {
  .desktop-interaction-summary {
    gap: 8px;
  }

  .summary-chip {
    min-width: 120px;
    padding: 7px 10px;
  }

  .summary-chip__label {
    font-size: 11px;
  }

  .summary-chip__value {
    font-size: 16px;
  }
}

// 响应式
@include mobile-only {
  .filter-panel {
    // 移动端改为 fixed 定位，与导航栏融合
    position: fixed;
    z-index: 95;
    left: 0;
    right: 0;
    top: $header-height;
    border-radius: 0;
    border-left: none;
    border-right: none;
    border-top: none;
    margin-bottom: 0;
    padding: $spacing-sm $spacing-md;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    // 移除 sticky 相关的 hack
    -webkit-transform: none;
    transform: none;
    // 主操作保持首行，已应用条件独占下一行，避免挤压触摸入口。
    flex-wrap: wrap;
    align-items: center;

    :deep(.filter-left) {
      display: contents;
    }
    :deep(.result-count) {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    :deep(.filter-right-mobile) {
      order: 2;
    }
    :deep(.filter-chips) {
      order: 3;
      flex: 1 1 calc(100% - 88px);
      max-width: calc(100% - 88px);
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
    }
    :deep(.filter-chip) {
      flex-shrink: 0;
    }
    :deep(.filtered-hint) {
      display: none;
    }
    :deep(.reset-btn) {
      order: 4;
      margin-left: auto;
      min-height: 32px;
    }

    [data-theme='dark'] & {
      background: rgba(15, 23, 42, 0.95);
    }
  }
}
</style>
