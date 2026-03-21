<script setup>
import AnimatedNumber from '@/components/common/ui/AnimatedNumber.vue'

defineProps({
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
  resultCount: {
    type: Number,
    default: 0,
  },
  totalCount: {
    type: Number,
    default: 0,
  },
})

defineEmits(['reset'])
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

    .result-count {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}
</style>
