<script setup>
import AnimatedNumber from '@/components/common/ui/AnimatedNumber.vue'

defineProps({
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

defineEmits(['clearSearch', 'reset'])
</script>

<template>
  <div class="filter-left">
    <span class="result-count">
      <template v-if="loading">
        加载中...
      </template>
      <template v-else>
        共 <AnimatedNumber :value="resultCount" class="count-value" /> 张{{ currentSeries === 'avatar' ? '头像' : currentSeries === 'mobile' ? '手机壁纸' : '壁纸' }}
        <span v-if="hasActiveFilters && resultCount !== totalCount" class="filtered-hint">
          (筛选自 <AnimatedNumber :value="totalCount" :duration="0.4" /> 张)
        </span>
      </template>
    </span>

    <button
      v-if="activeSearchQuery && isMobileOrTablet"
      class="mobile-search-chip"
      type="button"
      @click="$emit('clearSearch')"
    >
      <span class="mobile-search-chip__label">“{{ activeSearchQuery }}”</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>

    <div v-else-if="activeSearchQuery" class="search-context-wrap">
      <span
        class="search-context"
        :class="{ 'search-context--stacked': categoryFilter !== 'all' || subcategoryFilter !== 'all' }"
      >
        <template v-if="categoryFilter !== 'all' && subcategoryFilter !== 'all'">
          在 {{ categoryFilter }} / {{ subcategoryFilter }} 中搜索 “{{ activeSearchQuery }}”
        </template>
        <template v-else-if="categoryFilter !== 'all'">
          在 {{ categoryFilter }} 中搜索 “{{ activeSearchQuery }}”
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
        v-if="hasActiveFilters && !isMobileOrTablet"
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
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.16);
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
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.18);
  white-space: nowrap;
  transition: all 220ms ease;

  [data-theme='dark'] & {
    background: rgba(102, 126, 234, 0.16);
    border-color: rgba(102, 126, 234, 0.26);
  }

  svg {
    width: 12px;
    height: 12px;
  }

  &:hover {
    color: #fff;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-color: transparent;
    box-shadow: 0 8px 18px rgba(102, 126, 234, 0.24);
  }
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
      color: #667eea;
      background: rgba(102, 126, 234, 0.12);
      border-color: rgba(102, 126, 234, 0.22);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.12);
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
    border: 1px solid rgba(102, 126, 234, 0.18);
    border-radius: $radius-full;
    background: rgba(102, 126, 234, 0.1);
    color: #667eea;
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
