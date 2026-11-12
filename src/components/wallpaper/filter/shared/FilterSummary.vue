<script setup>
import { computed } from 'vue'
import AnimatedNumber from '@/components/common/ui/AnimatedNumber.vue'

const props = defineProps({
  activeChips: { type: Array, default: () => [] },
  activeSearchQuery: {
    type: String,
    default: '',
  },
  categoryFilter: {
    type: String,
    default: 'all',
  },
  currentSeries: {
    type: String,
    default: '',
  },
  hasActiveFilters: {
    type: Boolean,
    default: false,
  },
  isMobileOrTablet: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  subcategoryFilter: {
    type: String,
    default: 'all',
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

defineEmits(['clearSearch', 'reset', 'removeFilter'])

const categoryLabel = computed(() => {
  if (props.currentSeries === 'video') {
    return '电脑'
  }

  return props.categoryFilter
})

const resultLabel = computed(() => {
  if (props.currentSeries === 'avatar') {
    return '头像'
  }

  if (props.currentSeries === 'mobile') {
    return '手机壁纸'
  }

  if (props.currentSeries === 'video') {
    return '电脑动态壁纸'
  }

  return '壁纸'
})

const showFilteredHint = computed(() => {
  if (!props.hasActiveFilters || props.resultCount === props.totalCount) {
    return false
  }

  return true
})
</script>

<template>
  <div class="filter-left">
    <span class="result-count" aria-hidden="true">
      <template v-if="loading">
        加载中...
      </template>
      <template v-else>
        共 <AnimatedNumber :value="resultCount" :animate-on-mount="false" :duration="0.16" class="count-value" /> 张{{ resultLabel }}
        <span v-if="showFilteredHint" class="filtered-hint">
          (筛选自 <AnimatedNumber :value="totalCount" :animate-on-mount="false" :duration="0.16" /> 张)
        </span>
      </template>
    </span>
    <span class="filter-status" role="status" aria-live="polite" aria-atomic="true">{{ loading ? '正在更新壁纸结果' : `找到 ${resultCount} 张${resultLabel}` }}</span>

    <div v-if="activeChips.length || (activeSearchQuery && isMobileOrTablet)" class="filter-chips" aria-label="已应用筛选条件">
      <button v-if="activeSearchQuery && isMobileOrTablet" type="button" class="filter-chip" :aria-label="`清除搜索：${activeSearchQuery}`" @click="$emit('clearSearch')">
        <span>“{{ activeSearchQuery }}”</span><span aria-hidden="true">×</span>
      </button>
      <button v-for="chip in activeChips" :key="chip.field" type="button" class="filter-chip" :aria-label="`移除筛选：${chip.label}`" @click="$emit('removeFilter', chip.field)">
        <span>{{ chip.label }}</span><span aria-hidden="true">×</span>
      </button>
    </div>

    <div v-if="activeSearchQuery && !isMobileOrTablet" class="search-context-wrap">
      <span
        class="search-context"
        :class="{ 'search-context--stacked': categoryFilter !== 'all' || subcategoryFilter !== 'all' }"
      >
        <template v-if="categoryFilter !== 'all' && subcategoryFilter !== 'all'">
          在 {{ categoryLabel }} / {{ subcategoryFilter }} 中搜索 “{{ activeSearchQuery }}”
        </template>
        <template v-else-if="categoryFilter !== 'all'">
          在 {{ categoryLabel }} 中搜索 “{{ activeSearchQuery }}”
        </template>
        <template v-else>
          搜索 “{{ activeSearchQuery }}”
        </template>
      </span>

      <button class="clear-search-btn" @click="$emit('clearSearch')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
        清空搜索
      </button>
    </div>

    <Transition name="fade">
      <button
        v-if="hasActiveFilters"
        class="reset-btn"
        @click="$emit('reset')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        重置
      </button>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
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

.search-context {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: $radius-full;
  font-size: $font-size-xs;
  color: var(--color-accent);
  background: var(--accent-surface);
  border: 1px solid var(--accent-border);
  white-space: nowrap;
}

.search-context-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.mobile-search-chip {
  display: none;
}

.clear-search-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: $radius-full;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  color: var(--color-text-secondary);
  background: var(--accent-surface);
  border: 1px solid var(--accent-border);
  white-space: nowrap;
  transition: all 220ms ease;

  [data-theme='dark'] & {
    background: var(--accent-surface-strong);
    border-color: var(--accent-border-strong);
  }

  svg {
    width: 12px;
    height: 12px;
  }

  &:hover {
    color: #fff;
    background: var(--accent-gradient);
    border-color: transparent;
    box-shadow: 0 8px 18px var(--accent-shadow);
  }
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  color: var(--color-accent);
  background: var(--accent-surface);
  border: 1px solid var(--accent-border);
  border-radius: $radius-lg;
  cursor: pointer;
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover {
    background: var(--accent-gradient);
    border-color: transparent;
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--accent-shadow);
  }

  &:active {
    transform: scale(0.95);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

@include mobile-only {
  .filter-left {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    gap: 6px;
    flex-wrap: nowrap;
    align-items: center;

    .result-count {
      flex-shrink: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .clear-search-btn {
      min-height: 34px;
      padding: 0 12px;
      color: var(--color-accent);
      background: var(--accent-surface);
      border-color: var(--accent-border-strong);
      box-shadow: 0 4px 12px var(--accent-ring);
    }
  }

  .mobile-search-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    max-width: 128px;
    height: 30px;
    padding: 0 10px;
    border: 1px solid var(--accent-border);
    border-radius: $radius-full;
    background: var(--accent-surface);
    color: var(--color-accent);
    flex-shrink: 1;

    svg {
      width: 11px;
      height: 11px;
      flex-shrink: 0;
    }
  }

  .mobile-search-chip__label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: $font-weight-semibold;
  }
}
</style>

<style scoped>
.filter-status {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 32px;
  max-width: 180px;
  padding: 5px 9px;
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  color: var(--color-accent);
  background: var(--accent-surface);
  font-size: 12px;
}
.filter-chip span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 767px) {
  .filter-chip {
    min-height: 36px;
  }
}
</style>
