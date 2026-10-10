<script setup>
import BingDatePicker from '@/components/wallpaper/filter/fields/BingDatePicker.vue'
import CategoryDropdown from '@/components/wallpaper/filter/fields/CategoryDropdown.vue'
import { FORMAT_OPTIONS, RESOLUTION_OPTIONS, SORT_OPTIONS } from '@/utils/config/constants'

defineProps({
  categoryFilter: {
    type: String,
    default: 'all',
  },
  categoryOptions: {
    type: Array,
    default: () => [],
  },
  currentSeries: {
    type: String,
    default: '',
  },
  formatFilter: {
    type: String,
    default: 'all',
  },
  hideFormatFilter: {
    type: Boolean,
    default: false,
  },
  hideCategoryFilter: {
    type: Boolean,
    default: false,
  },
  resolutionFilter: {
    type: String,
    default: 'all',
  },
  sortBy: {
    type: String,
    default: 'newest',
  },
  subcategoryFilter: {
    type: String,
    default: 'all',
  },
})

defineEmits([
  'categoryUpdate',
  'formatChange',
  'resolutionChange',
  'sortChange',
  'subcategoryUpdate',
])
</script>

<template>
  <div class="filter-right">
    <div v-if="currentSeries === 'bing'" class="filter-item filter-item--date">
      <span class="filter-label">日期</span>
      <BingDatePicker
        :model-value="categoryFilter"
        @update:model-value="$emit('categoryUpdate', $event)"
      />
    </div>

    <div v-else-if="!hideCategoryFilter" class="filter-item filter-item--category">
      <span class="filter-label">分类</span>
      <CategoryDropdown
        :category-options="categoryOptions"
        :category-filter="categoryFilter"
        :subcategory-filter="subcategoryFilter"
        @update:category-filter="$emit('categoryUpdate', $event)"
        @update:subcategory-filter="$emit('subcategoryUpdate', $event)"
      />
    </div>

    <div v-if="!hideFormatFilter" class="filter-item filter-item--format">
      <span class="filter-label">格式</span>
      <el-select
        :model-value="formatFilter"
        placeholder="全部格式"
        size="default"
        @change="$emit('formatChange', $event)"
      >
        <el-option
          v-for="option in FORMAT_OPTIONS"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
    </div>

    <div v-if="currentSeries === 'desktop'" class="filter-item filter-item--resolution">
      <span class="filter-label">分辨率</span>
      <el-select
        :model-value="resolutionFilter"
        placeholder="全部分辨率"
        size="default"
        @change="$emit('resolutionChange', $event)"
      >
        <el-option
          v-for="option in RESOLUTION_OPTIONS"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
    </div>

    <div class="filter-item filter-item--sort">
      <span class="filter-label">排序</span>
      <el-select
        :model-value="sortBy"
        placeholder="排序方式"
        size="default"
        @change="$emit('sortChange', $event)"
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
</template>

<style lang="scss" scoped>
.filter-right {
  display: flex;
  align-items: center;
  gap: 12px 16px;
  flex: 1 1 760px;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  min-width: 0;
  flex: 1 1 150px;
  max-width: 200px;

  :deep(.el-select) {
    width: 100%;
    min-width: 0;
    flex: 1;
    --el-select-border-color-hover: var(--accent-border-strong);

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
        border-color: var(--accent-border-strong) !important;
      }

      &.is-focused {
        border-color: var(--accent-border-strong) !important;
        box-shadow: none !important;
      }
    }

    .el-select__selection .el-select__selected-item {
      color: var(--color-text-primary) !important;
      font-size: 14px !important;
    }

    .el-select__placeholder {
      color: var(--color-text-muted) !important;
    }

    .el-select__suffix .el-icon {
      color: var(--color-text-muted) !important;
      transition: all 250ms !important;
    }

    &.is-focus .el-select__suffix .el-icon {
      transform: rotate(180deg);
      color: var(--color-accent) !important;
    }
  }
}

.filter-label {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
  white-space: nowrap;
  flex-shrink: 0;
}

.filter-item--date {
  flex: 0 0 196px;
}

.filter-item--category {
  flex-basis: 180px;
  max-width: 220px;

  :deep(.category-dropdown) {
    flex: 1;
    width: 100%;
    min-width: 0;
  }

  :deep(.dropdown-trigger) {
    width: 100%;
    min-width: 0;
  }
}

.filter-item--format {
  flex-basis: 130px;
  max-width: 166px;
}

.filter-item--sort {
  flex-basis: 180px;
  max-width: 220px;
}

@media (max-width: 1180px) {
  .filter-right {
    gap: 10px 12px;
  }
}
</style>
