<script setup>
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'

defineProps({
  aspectType: {
    type: String,
    default: 'landscape',
  },
  currentSeriesName: {
    type: String,
    default: '壁纸',
  },
  displayViewMode: {
    type: String,
    default: 'grid',
  },
  isMobileOrTablet: {
    type: Boolean,
    default: false,
  },
  skeletonCount: {
    type: Number,
    default: 6,
  },
})
</script>

<template>
  <div class="loading-state">
    <div v-if="isMobileOrTablet" class="mobile-loading-hint">
      <LoadingSpinner size="md" />
      <p class="loading-text">
        正在加载{{ currentSeriesName }}...
      </p>
    </div>

    <div class="wallpaper-grid skeleton-grid" :class="[`view-${displayViewMode}`, `aspect-${aspectType}`]">
      <div v-for="n in skeletonCount" :key="n" class="skeleton-card">
        <div class="skeleton-image">
          <div class="skeleton-shimmer" />
        </div>
        <div v-if="!isMobileOrTablet" class="skeleton-info">
          <div class="skeleton-title" />
          <div class="skeleton-meta" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.loading-state {
  position: relative;
}

.skeleton-grid {
  animation: fadeIn 0.3s ease;
}

.skeleton-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

  @include mobile-only {
    border-radius: var(--radius-sm);
  }
}

.skeleton-image {
  position: relative;
  width: 100%;
  aspect-ratio: 9 / 16;
  background: var(--color-bg-hover);
  overflow: hidden;

  .aspect-landscape & {
    aspect-ratio: 16 / 10;
  }

  .aspect-square & {
    aspect-ratio: 1 / 1;
  }
}

.skeleton-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, var(--color-bg-card) 50%, transparent 100%);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.skeleton-info {
  padding: $spacing-md;
}

.skeleton-title {
  height: 16px;
  width: 70%;
  background: var(--color-bg-hover);
  border-radius: $radius-sm;
  margin-bottom: $spacing-sm;
}

.skeleton-meta {
  height: 12px;
  width: 40%;
  background: var(--color-bg-hover);
  border-radius: $radius-sm;
}

.mobile-loading-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-md;
  padding: $spacing-xl 0;
  margin-bottom: $spacing-md;

  .loading-text {
    font-size: $font-size-sm;
    color: var(--color-text-muted);
    animation: pulse 1.5s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.wallpaper-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: var(--grid-gap);

  @include mobile-only {
    gap: $spacing-sm;
  }

  &.view-grid {
    grid-template-columns: repeat(2, 1fr);

    @include respond-to('md') {
      grid-template-columns: repeat(3, 1fr);
    }

    @include respond-to('lg') {
      grid-template-columns: repeat(4, 1fr);
    }

    @include respond-to('xl') {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  &.view-list {
    grid-template-columns: 1fr;
    gap: $spacing-md;
  }

  &.view-grid.aspect-square {
    grid-template-columns: repeat(2, 1fr);

    @include respond-to('md') {
      grid-template-columns: repeat(4, 1fr);
    }

    @include respond-to('lg') {
      grid-template-columns: repeat(5, 1fr);
    }

    @include respond-to('xl') {
      grid-template-columns: repeat(6, 1fr);
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
