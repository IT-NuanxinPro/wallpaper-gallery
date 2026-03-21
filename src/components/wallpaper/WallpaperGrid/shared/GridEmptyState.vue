<script setup>
defineProps({
  alternativeSeries: {
    type: Array,
    default: () => [],
  },
  currentSeries: {
    type: String,
    default: '',
  },
  currentSeriesName: {
    type: String,
    default: '壁纸',
  },
  type: {
    type: String,
    default: 'no-series-data',
  },
})

const emit = defineEmits(['navigate', 'resetFilters'])
</script>

<template>
  <div v-if="type === 'no-series-data'" class="grid-empty series-empty">
    <div class="empty-icon">
      <svg v-if="currentSeries === 'desktop'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
      <svg v-else-if="currentSeries === 'mobile'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
      <svg v-else-if="currentSeries === 'avatar'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    </div>
    <h3>暂无{{ currentSeriesName }}</h3>
    <p>该分类暂时没有内容，敬请期待~</p>
    <div v-if="alternativeSeries.length > 0" class="empty-actions">
      <button
        v-for="series in alternativeSeries"
        :key="series.id"
        class="action-btn"
        @click="emit('navigate', series.id)"
      >
        查看{{ series.name }}
      </button>
    </div>
  </div>

  <div v-else class="grid-empty filter-empty">
    <div class="empty-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
        <path d="M8 8l6 6M14 8l-6 6" />
      </svg>
    </div>
    <h3>没有找到匹配的壁纸</h3>
    <p>尝试调整搜索条件或筛选器</p>
    <div class="empty-actions">
      <button class="action-btn primary" @click="emit('resetFilters')">
        清除筛选条件
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.grid-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-2xl;
  text-align: center;
  animation: fadeIn 0.5s ease;

  .empty-icon {
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-hover);
    border-radius: 50%;
    margin-bottom: $spacing-lg;

    svg {
      width: 48px;
      height: 48px;
      color: var(--color-text-muted);
      opacity: 0.7;
    }
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

  &.series-empty {
    .empty-icon {
      background: linear-gradient(135deg, var(--color-accent-light) 0%, rgba(99, 102, 241, 0.1) 100%);

      svg {
        color: var(--color-accent);
        opacity: 0.8;
      }
    }
  }

  &.filter-empty {
    .empty-icon {
      background: var(--color-bg-secondary);

      svg {
        color: var(--color-text-muted);
      }
    }
  }
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  justify-content: center;
  margin-top: $spacing-sm;
}

.action-btn {
  padding: 10px 20px;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  &:active {
    transform: scale(0.95);
  }

  &.primary {
    color: white;
    background: var(--color-accent);
    border-color: var(--color-accent);

    &:hover {
      background: var(--color-accent-hover);
      border-color: var(--color-accent-hover);
      color: white;
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
