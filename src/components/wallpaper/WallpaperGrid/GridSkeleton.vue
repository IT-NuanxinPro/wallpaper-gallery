<script setup>
// 骨架屏组件
defineProps({
  count: {
    type: Number,
    default: 12,
  },
  aspectType: {
    type: String,
    default: 'landscape',
  },
  aspectRatio: {
    type: String,
    default: '16/10',
  },
  isBing: {
    type: Boolean,
    default: false,
  },
  isMobile: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <div class="skeleton-grid" :class="[`aspect-${aspectType}`, { 'is-bing-grid': isBing }]">
    <div v-for="n in count" :key="n" class="skeleton-card">
      <div class="skeleton-image" :style="{ aspectRatio }" />
      <!-- 桌面端显示骨架信息 -->
      <div class="skeleton-info">
        <div class="skeleton-title" />
        <div class="skeleton-meta" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--grid-gap);
  @include mobile-only {
    gap: $spacing-sm;
  }

  @include respond-to('md') {
    grid-template-columns: repeat(3, 1fr);
  }

  @include respond-to('lg') {
    grid-template-columns: repeat(4, 1fr);
  }

  @include respond-to('xl') {
    grid-template-columns: repeat(5, 1fr);
  }

  // 正方形壁纸（头像）网格优化
  &.aspect-square {
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

.skeleton-card {
  background: var(--color-bg-card);
  border: 1px solid var(--accent-border);
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
  background: var(--color-bg-hover);
  overflow: hidden;
}

.skeleton-info {
  padding: $spacing-md;
  min-height: 164px;

  @include mobile-only {
    display: none;
  }

  .is-bing-grid & {
    min-height: 140px;
  }
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
</style>
