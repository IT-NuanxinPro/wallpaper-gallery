<script setup>
import ViewModeToggle from '@/components/wallpaper/filter/shared/ViewModeToggle.vue'

defineProps({
  currentCategoryLabel: {
    type: String,
    default: '分类',
  },
  hideCategoryFilter: {
    type: Boolean,
    default: false,
  },
  isCategoryActive: {
    type: Boolean,
    default: false,
  },
  viewMode: {
    type: String,
    default: 'grid',
  },
  allowListMode: {
    type: Boolean,
    default: true,
  },
  hideViewMode: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['openCategory', 'openFilter', 'viewModeChange'])
</script>

<template>
  <div class="filter-right-mobile">
    <ViewModeToggle v-if="!hideViewMode" :mode="viewMode" :allow-list-mode="allowListMode" mobile @change="$emit('viewModeChange', $event)" />

    <button
      v-if="!hideCategoryFilter"
      class="category-btn"
      :class="{ 'is-active': isCategoryActive }"
      @click="$emit('openCategory')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 6h16M4 12h16M4 18h7" />
      </svg>
      <span class="category-btn-text">{{ currentCategoryLabel }}</span>
      <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <button class="filter-btn filter-btn-compact" @click="$emit('openFilter')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.filter-right-mobile {
  display: flex;
  align-items: center;
  gap: 10px;
}

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
    background: var(--accent-gradient);
    box-shadow: 0 2px 10px var(--accent-shadow);

    svg {
      color: white;
    }
  }

  &:active {
    transform: scale(0.95);
  }
}

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
    width: 20px;
    height: 20px;
  }
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
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
    color: var(--color-accent);
  }

  &:hover {
    background: var(--accent-surface);
    border-color: var(--accent-border-strong);
  }

  &:active {
    transform: scale(0.95);
  }
}

@include mobile-only {
  .filter-right-mobile {
    flex-shrink: 0;
  }
}
</style>
