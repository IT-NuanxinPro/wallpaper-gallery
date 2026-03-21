<script setup>
import { computed, ref } from 'vue'
import MobileCategoryDrawer from '@/components/common/navigation/MobileCategoryDrawer.vue'
import DesktopFilterControls from '@/components/wallpaper/filter/desktop/DesktopFilterControls.vue'
import MobileFilterBar from '@/components/wallpaper/filter/mobile/MobileFilterBar.vue'
import MobileFilterPopup from '@/components/wallpaper/filter/mobile/MobileFilterPopup.vue'
import FilterSummary from '@/components/wallpaper/filter/shared/FilterSummary.vue'
import { useDevice } from '@/composables/useDevice'
import { useViewMode } from '@/composables/useViewMode'
import { trackFilter } from '@/utils/common/analytics'
import { hasActiveSeriesFilters } from '@/utils/filter/defaults'

const props = defineProps({
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
})

const emit = defineEmits(['update:sortBy', 'update:formatFilter', 'update:resolutionFilter', 'update:categoryFilter', 'update:subcategoryFilter', 'reset'])

const { isMobile } = useDevice()
const { viewMode, setViewMode } = useViewMode()

// 移动端弹窗状态
const showFilterPopup = ref(false) // 格式+排序筛选弹窗
const showCategoryDrawer = ref(false) // 分类选择抽屉

// 临时筛选值（用于弹窗内）
const tempSortBy = ref(props.sortBy)
const tempFormatFilter = ref(props.formatFilter)

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

// 当前分类显示文本
const currentCategoryLabel = computed(() => {
  if (props.categoryFilter === 'all') {
    return '分类'
  }
  let label = props.categoryFilter
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
  emit('update:categoryFilter', 'all')
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
  <div class="filter-panel" :class="{ 'has-filters': hasActiveFilters }">
    <FilterSummary
      :current-series="currentSeries"
      :has-active-filters="hasActiveFilters"
      :is-mobile-or-tablet="isMobile"
      :loading="loading"
      :result-count="resultCount"
      :total-count="totalCount"
      @reset="handleReset"
    />

    <DesktopFilterControls
      v-if="!isMobile"
      :category-filter="categoryFilter"
      :category-options="categoryOptions"
      :current-series="currentSeries"
      :format-filter="formatFilter"
      :hide-format-filter="hideFormatFilter"
      :resolution-filter="resolutionFilter"
      :sort-by="sortBy"
      :subcategory-filter="subcategoryFilter"
      :view-mode="viewMode"
      @view-mode-change="setViewMode"
      @category-update="handleCategoryUpdate"
      @subcategory-update="handleSubcategoryUpdate"
      @format-change="handleFormatChange"
      @resolution-change="handleResolutionChange"
      @sort-change="handleSortChange"
    />

    <MobileFilterBar
      v-else
      :current-category-label="currentCategoryLabel"
      :is-category-active="isCategoryActive"
      :view-mode="viewMode"
      @view-mode-change="setViewMode"
      @open-category="openCategoryDrawer"
      @open-filter="openFilterPopup"
    />

    <!-- 移动端分类选择抽屉（左右分栏） -->
    <MobileCategoryDrawer
      v-model:show="showCategoryDrawer"
      :category-options="categoryOptions"
      :category-filter="categoryFilter"
      :subcategory-filter="subcategoryFilter"
      @update:category-filter="handleCategoryChange"
      @update:subcategory-filter="handleSubcategoryChange"
      @confirm="handleCategoryConfirm"
    />

    <MobileFilterPopup
      v-model:show="showFilterPopup"
      v-model:temp-format-filter="tempFormatFilter"
      v-model:temp-sort-by="tempSortBy"
      :hide-format-filter="hideFormatFilter"
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
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  padding: $spacing-md $spacing-lg;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: $radius-lg;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.08);
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: $spacing-lg;

  // 吸顶效果（PC 和移动端通用）
  position: -webkit-sticky;
  position: sticky;
  top: $header-height;
  z-index: 99;

  // 确保 sticky 在各浏览器正常工作
  -webkit-transform: translateZ(0);
  transform: translateZ(0);

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.75);
    border-color: rgba(255, 255, 255, 0.08);
  }

  &.has-filters {
    border-color: rgba(102, 126, 234, 0.3);
    background: rgba(255, 255, 255, 0.8);
    box-shadow: 0 4px 30px rgba(102, 126, 234, 0.15);

    [data-theme='dark'] & {
      background: rgba(15, 23, 42, 0.85);
      border-color: rgba(102, 126, 234, 0.25);
    }
  }
}

// 响应式
@include mobile-only {
  .filter-panel {
    // 移动端改为 fixed 定位，与导航栏融合
    position: fixed;
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
    // 移动端强制不换行
    flex-wrap: nowrap;

    [data-theme='dark'] & {
      background: rgba(15, 23, 42, 0.95);
    }
  }
}
</style>
