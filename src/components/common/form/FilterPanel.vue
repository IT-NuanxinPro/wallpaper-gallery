<script setup>
import { computed, ref } from 'vue'
import BingDatePicker from '@/components/common/form/BingDatePicker.vue'
import CategoryDropdown from '@/components/common/form/CategoryDropdown.vue'
import MobileCategoryDrawer from '@/components/common/navigation/MobileCategoryDrawer.vue'
import AnimatedNumber from '@/components/common/ui/AnimatedNumber.vue'
import { useDevice } from '@/composables/useDevice'
import { useViewMode } from '@/composables/useViewMode'
import { trackFilter } from '@/utils/analytics'
import { FORMAT_OPTIONS, RESOLUTION_OPTIONS, SORT_OPTIONS } from '@/utils/constants'

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

const { isMobileOrTablet } = useDevice()
const { viewMode, setViewMode } = useViewMode()

// 移动端弹窗状态
const showFilterPopup = ref(false) // 格式+排序筛选弹窗
const showCategoryDrawer = ref(false) // 分类选择抽屉

// 临时筛选值（用于弹窗内）
const tempSortBy = ref(props.sortBy)
const tempFormatFilter = ref(props.formatFilter)

// 获取当前年月（用于 Bing 系列默认值判断）
function getCurrentYearMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

// 是否有激活的筛选条件
const hasActiveFilters = computed(() => {
  if (props.formatFilter !== 'all')
    return true
  if (props.resolutionFilter !== 'all')
    return true
  if (props.subcategoryFilter !== 'all')
    return true
  if (props.sortBy !== 'newest')
    return true

  // Bing 系列：当前年月是默认值，不算激活
  if (props.currentSeries === 'bing') {
    const defaultMonth = getCurrentYearMonth()
    return props.categoryFilter !== defaultMonth
  }

  // 其他系列：all 是默认值
  return props.categoryFilter !== 'all'
})

// 视图模式滑动指示器位置
const viewModeSliderPosition = computed(() => {
  switch (viewMode.value) {
    case 'list':
      return 'is-list'
    case 'masonry':
      return 'is-masonry'
    default:
      return 'is-grid'
  }
})

// 移动端视图模式滑动指示器位置（网格和列表两个选项）
const mobileViewModeSliderPosition = computed(() => {
  return viewMode.value === 'list' ? 'is-list' : 'is-grid'
})

// 激活的筛选数量（不含分类，分类单独显示）
const activeFilterCount = computed(() => {
  let count = 0
  if (props.formatFilter !== 'all')
    count++
  if (props.sortBy !== 'newest')
    count++
  return count
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
    <div class="filter-left">
      <span class="result-count">
        <template v-if="loading">
          加载中...
        </template>
        <template v-else>
          共 <AnimatedNumber :value="resultCount" class="count-value" /> 张壁纸
          <span v-if="hasActiveFilters && resultCount !== totalCount" class="filtered-hint">
            (筛选自 <AnimatedNumber :value="totalCount" :duration="0.4" /> 张)
          </span>
        </template>
      </span>

      <!-- PC 端重置按钮 -->
      <Transition name="fade">
        <button
          v-if="hasActiveFilters && !isMobileOrTablet"
          class="reset-btn"
          @click="handleReset"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          重置
        </button>
      </Transition>
    </div>

    <!-- PC 端筛选项 -->
    <div v-if="!isMobileOrTablet" class="filter-right">
      <!-- View Mode Toggle -->
      <div class="view-mode-toggle">
        <!-- 滑动指示器 -->
        <div class="view-mode-slider" :class="viewModeSliderPosition" />
        <button
          class="view-mode-btn"
          :class="{ 'is-active': viewMode === 'grid' }"
          aria-label="网格视图"
          @click="setViewMode('grid')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
        </button>
        <button
          class="view-mode-btn"
          :class="{ 'is-active': viewMode === 'list' }"
          aria-label="列表视图"
          @click="setViewMode('list')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </button>
        <button
          class="view-mode-btn"
          :class="{ 'is-active': viewMode === 'masonry' }"
          aria-label="瀑布流视图"
          @click="setViewMode('masonry')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="10" />
            <rect x="14" y="3" width="7" height="6" />
            <rect x="3" y="16" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" />
          </svg>
        </button>
      </div>

      <div class="filter-divider" />

      <!-- Bing 日期选择器 -->
      <div v-if="currentSeries === 'bing'" class="filter-item">
        <span class="filter-label">日期</span>
        <BingDatePicker
          :model-value="categoryFilter"
          @update:model-value="handleCategoryUpdate"
        />
      </div>

      <!-- 其他系列的分类筛选器 -->
      <div v-else class="filter-item">
        <span class="filter-label">分类</span>
        <CategoryDropdown
          :category-options="categoryOptions"
          :category-filter="categoryFilter"
          :subcategory-filter="subcategoryFilter"
          @update:category-filter="handleCategoryUpdate"
          @update:subcategory-filter="handleSubcategoryUpdate"
        />
      </div>

      <!-- Format Filter -->
      <div v-if="!hideFormatFilter" class="filter-item">
        <span class="filter-label">格式</span>
        <el-select
          :model-value="formatFilter"
          placeholder="全部格式"
          size="default"
          style="width: 140px"
          @change="handleFormatChange"
        >
          <el-option
            v-for="option in FORMAT_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>

      <!-- Resolution Filter (仅电脑壁纸系列显示) -->
      <div v-if="currentSeries === 'desktop'" class="filter-item">
        <span class="filter-label">分辨率</span>
        <el-select
          :model-value="resolutionFilter"
          placeholder="全部分辨率"
          size="default"
          style="width: 140px"
          @change="handleResolutionChange"
        >
          <el-option
            v-for="option in RESOLUTION_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>

      <!-- Sort -->
      <div class="filter-item">
        <span class="filter-label">排序</span>
        <el-select
          :model-value="sortBy"
          placeholder="排序方式"
          size="default"
          style="width: 160px"
          @change="handleSortChange"
        >
          <el-option
            v-for="option in SORT_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>
    </div>

    <!-- 移动端视图切换 + 分类按钮 + 筛选按钮 -->
    <div v-else class="filter-right-mobile">
      <!-- 视图模式切换（网格/列表） -->
      <div class="view-mode-toggle-mobile">
        <div class="view-mode-slider-mobile" :class="mobileViewModeSliderPosition" />
        <button
          class="view-mode-btn-mobile"
          :class="{ 'is-active': viewMode === 'grid' || viewMode === 'masonry' }"
          aria-label="网格视图"
          @click="setViewMode('grid')"
        >
          <!-- 网格图标 -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
        </button>
        <button
          class="view-mode-btn-mobile"
          :class="{ 'is-active': viewMode === 'list' }"
          aria-label="列表视图"
          @click="setViewMode('list')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </button>
      </div>

      <!-- 分类按钮（独立出来，点击打开左右分栏抽屉） -->
      <button
        class="category-btn"
        :class="{ 'is-active': isCategoryActive }"
        @click="openCategoryDrawer"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 6h16M4 12h16M4 18h7" />
        </svg>
        <span class="category-btn-text">{{ currentCategoryLabel }}</span>
        <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <!-- 筛选按钮（格式+排序） -->
      <button class="filter-btn filter-btn-compact" @click="openFilterPopup">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span v-if="activeFilterCount > 0" class="filter-badge">{{ activeFilterCount }}</span>
      </button>
    </div>

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

    <!-- 移动端筛选弹窗（格式+排序） -->
    <van-popup
      v-model:show="showFilterPopup"
      position="bottom"
      round
      class="filter-popup-dark"
      :close-on-click-overlay="true"
      :lock-scroll="true"
      :duration="0.3"
      safe-area-inset-bottom
    >
      <div class="popup-content">
        <!-- 弹窗头部 -->
        <div class="popup-header">
          <button class="popup-reset" @click="resetFilters">
            重置
          </button>
          <span class="popup-title">筛选</span>
          <button class="popup-close" @click="closeFilterPopup">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- 筛选选项 -->
        <div class="popup-body">
          <!-- 格式 -->
          <div v-if="!hideFormatFilter" class="filter-group">
            <h3 class="group-title">
              格式
            </h3>
            <div class="option-grid">
              <button
                v-for="option in FORMAT_OPTIONS"
                :key="option.value"
                class="option-btn"
                :class="{ 'is-active': tempFormatFilter === option.value }"
                @click="tempFormatFilter = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <!-- 排序 -->
          <div class="filter-group">
            <h3 class="group-title">
              排序
            </h3>
            <div class="option-grid">
              <button
                v-for="option in SORT_OPTIONS"
                :key="option.value"
                class="option-btn"
                :class="{ 'is-active': tempSortBy === option.value }"
                @click="tempSortBy = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- 确认按钮 -->
        <div class="popup-footer">
          <button class="confirm-btn" @click="applyFilters">
            确认筛选
          </button>
        </div>
      </div>
    </van-popup>
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

.filter-left {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.result-count {
  font-size: $font-size-sm;
  color: var(--color-text-secondary);

  .count-value {
    display: inline-block;
    color: var(--color-text-primary);
    font-weight: $font-weight-bold;
    font-size: $font-size-md;
    min-width: 24px;
    text-align: center;
    transition:
      transform 0.3s ease,
      color 0.3s ease;
  }
}

.filtered-hint {
  color: var(--color-text-muted);
  font-size: $font-size-xs;
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: $radius-lg;
  cursor: pointer;
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-color: transparent;
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
  }

  &:active {
    transform: scale(0.95);
  }
}

.filter-right {
  display: flex;
  align-items: center;
  gap: $spacing-lg;
}

.view-mode-toggle {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: $radius-lg;
  padding: 4px;
  position: relative;

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(255, 255, 255, 0.08);
  }
}

.view-mode-slider {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: $radius-md;
  box-shadow: 0 2px 10px rgba(102, 126, 234, 0.4);
  transition: transform 350ms cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 0;

  &.is-list {
    transform: translateX(32px);
  }

  &.is-masonry {
    transform: translateX(64px);
  }
}

.view-mode-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: $radius-md;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 1;

  svg {
    width: 18px;
    height: 18px;
    transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  &:hover {
    color: var(--color-text-primary);

    svg {
      transform: scale(1.1);
    }
  }

  &.is-active {
    color: white;
  }
}

.filter-divider {
  width: 1px;
  height: 24px;
  background: var(--color-border);
}

.filter-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;

  // Element Plus Select 组件高级感样式
  :deep(.el-select) {
    --el-select-border-color-hover: rgba(102, 126, 234, 0.4);

    .el-select__wrapper {
      background: rgba(255, 255, 255, 0.6) !important;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 0, 0, 0.08) !important;
      border-radius: 10px !important;
      box-shadow: none !important;
      transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1) !important;
      padding: 0 14px !important;
      height: 38px !important;

      [data-theme='dark'] & {
        background: rgba(15, 23, 42, 0.6) !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
      }

      &:hover {
        border-color: rgba(102, 126, 234, 0.4) !important;
      }

      &.is-focused {
        border-color: rgba(102, 126, 234, 0.6) !important;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
      }
    }

    .el-select__selection {
      .el-select__selected-item {
        color: var(--color-text-primary) !important;
        font-size: 14px !important;
      }
    }

    .el-select__placeholder {
      color: var(--color-text-muted) !important;
    }

    .el-select__suffix {
      .el-icon {
        color: var(--color-text-muted) !important;
        transition: all 250ms !important;
      }
    }

    &.is-focus .el-select__suffix .el-icon {
      transform: rotate(180deg);
      color: #667eea !important;
    }
  }
}

.filter-label {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
  white-space: nowrap;
}

// 移动端筛选按钮
.filter-right-mobile {
  display: flex;
  align-items: center;
  gap: 10px;
}

// 移动端分类按钮
.category-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  max-width: 110px;
  height: 38px;
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(255, 255, 255, 0.08);
  }

  svg:first-child {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .category-btn-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .arrow-icon {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    opacity: 0.5;
  }

  &.is-active {
    color: white;
    border-color: transparent;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 2px 10px rgba(102, 126, 234, 0.4);

    svg {
      color: white;
    }
  }

  &:active {
    transform: scale(0.95);
  }
}

// 移动端视图模式切换
.view-mode-toggle-mobile {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 3px;
  position: relative;
  height: 38px;

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(255, 255, 255, 0.08);
  }
}

.view-mode-slider-mobile {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 9px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
  transition: transform 350ms cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 0;

  &.is-grid {
    transform: translateX(0);
  }

  &.is-list {
    transform: translateX(32px);
  }
}

.view-mode-btn-mobile {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  cursor: pointer;
  position: relative;
  z-index: 1;
  color: var(--color-text-muted);
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 16px;
    height: 16px;
  }

  &.is-active {
    color: white;
  }
}

// 紧凑版筛选按钮
.filter-btn-compact {
  padding: 0;
  min-width: 38px;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 16px;
    height: 16px;
  }
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  position: relative;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(255, 255, 255, 0.08);
  }

  svg {
    width: 16px;
    height: 16px;
    color: #667eea;
  }

  &:hover {
    background: rgba(102, 126, 234, 0.1);
    border-color: rgba(102, 126, 234, 0.3);
  }

  &:active {
    transform: scale(0.95);
  }
}

.filter-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

// 弹窗样式
.popup-content {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.95);
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;

  [data-theme='dark'] & {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
}

.popup-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.popup-reset {
  padding: 6px 12px;
  font-size: 14px;
  color: #667eea;
  background: transparent;
  font-weight: 500;
  transition: opacity 200ms;

  &:active {
    opacity: 0.7;
  }
}

.popup-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: var(--color-text-muted);
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 50%;
  transition: all 250ms;

  [data-theme='dark'] & {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.08);
  }

  svg {
    width: 18px;
    height: 18px;
  }

  &:active {
    background: rgba(102, 126, 234, 0.15);
    color: #667eea;
  }
}

.popup-body {
  padding: 20px 16px;
}

.filter-group {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.group-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.option-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.option-btn {
  padding: 12px 18px;
  font-size: 14px;
  color: var(--color-text-secondary);
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  [data-theme='dark'] & {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.08);
  }

  &:active {
    transform: scale(0.95);
  }

  &.is-active {
    color: white;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-color: transparent;
    font-weight: 600;
    box-shadow: 0 2px 10px rgba(102, 126, 234, 0.4);
  }
}

.view-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
  padding: 12px 8px;

  svg {
    width: 22px;
    height: 22px;
  }

  span {
    font-size: 12px;
  }
}

.view-mode-grid {
  display: flex;
  gap: 8px;
}

.popup-footer {
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: transparent;

  [data-theme='dark'] & {
    border-top-color: rgba(255, 255, 255, 0.08);
  }
}

.confirm-btn {
  width: 100%;
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    transform: translateY(-1px);
  }

  &:active {
    transform: scale(0.98);
    box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
  }
}

// 动画
.fade-enter-active,
.fade-leave-active {
  transition: all 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
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

  .filter-left {
    flex: 1;
    min-width: 0;
    overflow: hidden;

    .result-count {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .filter-right-mobile {
    flex-shrink: 0;
  }
}
</style>

<!-- 全局样式：用于 Teleport 到 body 的弹窗暗色模式 -->
<style lang="scss">
// 移动端筛选弹窗样式（van-popup 被 teleport 到 body，需要全局样式）
.van-popup.filter-popup-dark {
  background: rgba(255, 255, 255, 0.95) !important;
}

[data-theme='dark'] .van-popup.filter-popup-dark {
  background: rgba(15, 23, 42, 0.98) !important;

  .popup-content {
    background: transparent;
  }

  .popup-header {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  .popup-close {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.08);
  }

  .option-btn {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.08);

    &.is-active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-color: transparent;
    }
  }

  .popup-footer {
    border-top-color: rgba(255, 255, 255, 0.08);
  }
}
</style>
