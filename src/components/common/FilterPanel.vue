<script setup>
import { computed, ref } from 'vue'
import { useDevice } from '@/composables/useDevice'
import { useViewMode } from '@/composables/useViewMode'
import { FORMAT_OPTIONS, SORT_OPTIONS } from '@/utils/constants'

const props = defineProps({
  sortBy: {
    type: String,
    default: 'newest',
  },
  formatFilter: {
    type: String,
    default: 'all',
  },
  categoryFilter: {
    type: String,
    default: 'all',
  },
  categoryOptions: {
    type: Array,
    default: () => [{ value: 'all', label: '全部分类' }],
  },
  resultCount: {
    type: Number,
    default: 0,
  },
  totalCount: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['update:sortBy', 'update:formatFilter', 'update:categoryFilter', 'reset'])

const { isMobile } = useDevice()
const { viewMode, setViewMode } = useViewMode()

// 移动端筛选弹窗状态
const showFilterPopup = ref(false)

// 临时筛选值（用于弹窗内）
const tempSortBy = ref(props.sortBy)
const tempFormatFilter = ref(props.formatFilter)
const tempCategoryFilter = ref(props.categoryFilter)
const tempViewMode = ref(viewMode.value)

// 是否有激活的筛选条件
const hasActiveFilters = computed(() => {
  return props.formatFilter !== 'all' || props.categoryFilter !== 'all' || props.sortBy !== 'newest'
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

// 移动端视图模式滑动指示器位置（只有瀑布流和列表两个选项）
const mobileViewModeSliderPosition = computed(() => {
  return viewMode.value === 'list' ? 'is-list' : 'is-masonry'
})

// 激活的筛选数量
const activeFilterCount = computed(() => {
  let count = 0
  if (props.formatFilter !== 'all')
    count++
  if (props.categoryFilter !== 'all')
    count++
  if (props.sortBy !== 'newest')
    count++
  return count
})

function handleSortChange(value) {
  emit('update:sortBy', value)
}

function handleFormatChange(value) {
  emit('update:formatFilter', value)
}

function handleCategoryChange(value) {
  emit('update:categoryFilter', value)
}

function handleReset() {
  emit('update:sortBy', 'newest')
  emit('update:formatFilter', 'all')
  emit('update:categoryFilter', 'all')
  emit('reset')
}

// 移动端弹窗操作
function openFilterPopup() {
  // 同步当前值到临时值
  tempSortBy.value = props.sortBy
  tempFormatFilter.value = props.formatFilter
  tempCategoryFilter.value = props.categoryFilter
  tempViewMode.value = viewMode.value
  showFilterPopup.value = true
}

function closeFilterPopup() {
  showFilterPopup.value = false
}

function applyFilters() {
  emit('update:sortBy', tempSortBy.value)
  emit('update:formatFilter', tempFormatFilter.value)
  emit('update:categoryFilter', tempCategoryFilter.value)
  setViewMode(tempViewMode.value)
  closeFilterPopup()
}

function resetFilters() {
  tempSortBy.value = 'newest'
  tempFormatFilter.value = 'all'
  tempCategoryFilter.value = 'all'
  // 移动端默认视图为瀑布流
  tempViewMode.value = isMobile.value ? 'masonry' : 'grid'
}
</script>

<template>
  <div class="filter-panel" :class="{ 'has-filters': hasActiveFilters }">
    <div class="filter-left">
      <span class="result-count">
        共 <strong class="count-value">{{ resultCount }}</strong> 张壁纸
        <span v-if="resultCount !== totalCount" class="filtered-hint">
          (筛选自 {{ totalCount }} 张)
        </span>
      </span>

      <!-- PC 端重置按钮 -->
      <Transition name="fade">
        <button
          v-if="hasActiveFilters && !isMobile"
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
    <div v-if="!isMobile" class="filter-right">
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

      <!-- Category Filter -->
      <div class="filter-item">
        <span class="filter-label">分类</span>
        <el-select
          :model-value="categoryFilter"
          placeholder="全部分类"
          size="default"
          style="width: 120px"
          @change="handleCategoryChange"
        >
          <el-option
            v-for="option in categoryOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>

      <!-- Format Filter -->
      <div class="filter-item">
        <span class="filter-label">格式</span>
        <el-select
          :model-value="formatFilter"
          placeholder="全部格式"
          size="default"
          style="width: 120px"
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

      <!-- Sort -->
      <div class="filter-item">
        <span class="filter-label">排序</span>
        <el-select
          :model-value="sortBy"
          placeholder="排序方式"
          size="default"
          style="width: 130px"
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

    <!-- 移动端视图切换 + 筛选按钮 -->
    <div v-else class="filter-right-mobile">
      <!-- 视图模式切换 - 即时生效（移动端只有瀑布流和列表两种模式） -->
      <div class="view-mode-toggle-mobile">
        <div class="view-mode-slider-mobile" :class="mobileViewModeSliderPosition" />
        <button
          class="view-mode-btn-mobile"
          :class="{ 'is-active': viewMode === 'masonry' || viewMode === 'grid' }"
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

      <!-- 筛选按钮 (紧凑) -->
      <button class="filter-btn filter-btn-compact" @click="openFilterPopup">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span v-if="activeFilterCount > 0" class="filter-badge">{{ activeFilterCount }}</span>
      </button>
    </div>

    <!-- 移动端筛选弹窗 - 使用 Teleport 确保层级 -->
    <Teleport to="body">
      <van-popup
        v-model:show="showFilterPopup"
        position="bottom"
        round
        :style="{ maxHeight: '80%' }"
        class="filter-popup"
        :teleport="null"
        :close-on-click-overlay="true"
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
            <!-- 分类 -->
            <div class="filter-group">
              <h3 class="group-title">
                分类
              </h3>
              <div class="option-grid">
                <button
                  v-for="option in categoryOptions"
                  :key="option.value"
                  class="option-btn"
                  :class="{ 'is-active': tempCategoryFilter === option.value }"
                  @click="tempCategoryFilter = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <!-- 格式 -->
            <div class="filter-group">
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
    </Teleport>
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
  background: var(--color-bg-secondary);
  border-radius: $radius-lg;
  border: 1px solid var(--color-border);
  transition: all 0.3s ease;
  margin-bottom: $spacing-lg;

  // 吸顶效果（PC 和移动端通用）
  position: -webkit-sticky; // iOS Safari 兼容
  position: sticky;
  top: $header-height; // 固定在导航栏下方（72px）
  z-index: 99; // 低于 AppHeader 的 100

  // 确保 sticky 在各浏览器正常工作
  -webkit-transform: translateZ(0);
  transform: translateZ(0);

  &.has-filters {
    border-color: var(--color-accent-light);
    background: linear-gradient(135deg, var(--color-bg-secondary) 0%, rgba(99, 102, 241, 0.03) 100%);
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
  padding: 6px 12px;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: var(--color-accent);
  background: var(--color-accent-light);
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.25s ease;

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover {
    background: var(--color-accent);
    color: white;
    transform: scale(1.05);
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
  background: var(--color-bg-hover);
  border-radius: $radius-md;
  padding: 4px;
  position: relative;
}

.view-mode-slider {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 32px;
  height: 32px;
  background: var(--color-bg-card);
  border-radius: $radius-sm;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
  border-radius: $radius-sm;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
  transition: color 0.2s ease;
  position: relative;
  z-index: 1;

  svg {
    width: 18px;
    height: 18px;
    transition: transform 0.2s ease;
  }

  &:hover {
    color: var(--color-text-primary);

    svg {
      transform: scale(1.1);
    }
  }

  &.is-active {
    color: var(--color-accent);
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
  gap: $spacing-sm;
}

// 移动端视图模式切换
.view-mode-toggle-mobile {
  display: flex;
  align-items: center;
  background: var(--color-bg-hover);
  border-radius: $radius-sm;
  padding: 2px;
  position: relative;
  height: 32px;
}

.view-mode-slider-mobile {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 28px;
  height: 28px;
  background: var(--color-bg-card);
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 0;

  // 移动端只有两个位置：瀑布流（默认）和列表
  &.is-masonry {
    transform: translateX(0);
  }

  &.is-list {
    transform: translateX(28px);
  }
}

.view-mode-btn-mobile {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  cursor: pointer;
  position: relative;
  z-index: 1;
  color: var(--color-text-muted);
  transition: color 0.2s ease;

  svg {
    width: 16px;
    height: 16px;
  }

  &.is-active {
    color: var(--color-accent);
  }
}

// 紧凑版筛选按钮
.filter-btn-compact {
  padding: 6px 10px;
  min-width: 36px;
  height: 32px;

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
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  position: relative;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;

  svg {
    width: 16px;
    height: 16px;
    color: var(--color-accent);
  }

  &:active {
    transform: scale(0.95);
    background: var(--color-bg-hover);
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
  background: var(--color-accent);
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
}

// 弹窗样式
.filter-popup {
  :deep(.van-popup) {
    background: var(--color-bg-primary);
  }
}

.popup-content {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.popup-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.popup-reset {
  padding: 6px 12px;
  font-size: 14px;
  color: var(--color-text-muted);
  background: transparent;

  &:active {
    color: var(--color-accent);
  }
}

.popup-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--color-text-muted);
  background: transparent;

  svg {
    width: 20px;
    height: 20px;
  }
}

.popup-body {
  padding: 16px;
  max-height: 50vh;
  overflow-y: auto;
}

.filter-group {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

.group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.option-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.option-btn {
  padding: 10px 16px;
  font-size: 14px;
  color: var(--color-text-secondary);
  background: var(--color-bg-hover);
  border-radius: 8px;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.95);
  }

  &.is-active {
    color: var(--color-accent);
    background: var(--color-accent-light);
    font-weight: 500;
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
  border-top: 1px solid var(--color-border);
}

.confirm-btn {
  width: 100%;
  padding: 14px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: var(--color-accent);
  border-radius: 10px;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.98);
    background: var(--color-accent-hover);
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
    padding: $spacing-sm $spacing-md;
    margin-bottom: $spacing-md;
  }

  .filter-left {
    flex-wrap: wrap;
  }
}
</style>
