<script setup>
defineProps({
  bingDate: {
    type: String,
    default: '',
  },
  categoryDisplay: {
    type: String,
    default: '',
  },
  collected: {
    type: Boolean,
    default: false,
  },
  imageAlt: {
    type: String,
    default: '',
  },
  imageError: {
    type: Boolean,
    default: false,
  },
  imageLoaded: {
    type: Boolean,
    default: false,
  },
  imageRef: {
    type: Object,
    default: null,
  },
  index: {
    type: Number,
    default: 0,
  },
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
  isBingWallpaper: {
    type: Boolean,
    default: false,
  },
  isMobile: {
    type: Boolean,
    default: false,
  },
  isVideoWallpaper: {
    type: Boolean,
    default: false,
  },
  liked: {
    type: Boolean,
    default: false,
  },
  likeCount: {
    type: Number,
    default: 0,
  },
  collectCount: {
    type: Number,
    default: 0,
  },
  actionMode: {
    type: String,
    default: 'all',
  },
  popularRank: {
    type: Number,
    default: 0,
  },
  style: {
    type: Object,
    default: () => ({}),
  },
  thumbnailUrl: {
    type: String,
    default: '',
  },
  viewMode: {
    type: String,
    default: 'grid',
  },
})

const emit = defineEmits(['click', 'error', 'load', 'hoverEnter', 'hoverLeave'])
</script>

<template>
  <div
    class="card-image"
    :class="`card-image--${viewMode}`"
    :style="style"
    @click="emit('click')"
    @mouseenter="emit('hoverEnter')"
    @mouseleave="emit('hoverLeave')"
  >
    <div v-if="popularRank > 0 && popularRank <= 10" class="hot-badge" :class="{ 'hot-badge--top3': popularRank <= 3 }">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
      <span>🔥 热门</span>
    </div>

    <div v-if="!imageLoaded" class="image-skeleton">
      <div class="skeleton-shimmer" />
    </div>

    <div v-if="imageError && imageLoaded" class="image-error">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <span>加载失败</span>
    </div>

    <img
      :ref="imageRef"
      :src="thumbnailUrl"
      :alt="imageAlt"
      width="800"
      height="600"
      loading="lazy"
      :fetchpriority="index < 6 ? 'high' : 'auto'"
      :class="{ 'is-loaded': imageLoaded, 'is-error': imageError }"
      @load="emit('load')"
      @error="emit('error')"
    >

    <div v-if="categoryDisplay && viewMode === 'grid' && !isBingWallpaper" class="card-category-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
      <span>{{ categoryDisplay }}</span>
    </div>

    <div v-if="isBingWallpaper && viewMode === 'grid'" class="card-bing-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <span>{{ bingDate }}</span>
    </div>

    <!-- 桌面端：hover overlay -->
    <div v-if="!isMobile" class="card-overlay">
      <div class="overlay-content">
        <span class="overlay-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M11 8v6M8 11h6" />
          </svg>
        </span>
        <span class="overlay-text">{{ isVideoWallpaper ? '查看详情' : '查看大图' }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.card-image {
  position: relative;
  overflow: hidden;
  background: var(--color-bg-hover);
  cursor: pointer;

  [data-theme='dark'] & {
    background:
      linear-gradient(180deg, rgba(5, 11, 21, 0.96), rgba(8, 14, 26, 0.9)),
      radial-gradient(circle at top left, rgba(96, 165, 250, 0.08), transparent 44%);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.4s ease;
    will-change: transform;

    &.is-loaded {
      opacity: 1;
    }

    &.is-error {
      display: none;
    }
  }

  &--list {
    @include mobile-only {
      width: 100px !important;
      height: 100px !important;
      border-radius: var(--radius-md);

      img {
        object-fit: cover;
        width: 100%;
        height: 100%;
      }
    }
  }
}

.hot-badge {
  position: absolute;
  top: $spacing-xs;
  left: $spacing-xs;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: white;
  font-size: 10px;
  font-weight: $font-weight-bold;
  border-radius: $radius-full;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);

  svg {
    width: 12px;
    height: 12px;
    display: none;
  }

  &--top3 {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
  }
}

.image-skeleton {
  position: absolute;
  inset: 0;
  background: var(--color-bg-hover);
  overflow: hidden;

  .skeleton-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, var(--color-bg-card) 50%, transparent 100%);
    animation: shimmer 1.5s infinite;
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.image-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  color: var(--color-text-muted);

  svg {
    width: 32px;
    height: 32px;
  }

  span {
    font-size: $font-size-xs;
  }
}

.card-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  will-change: opacity;
}

.card-actions-mobile {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 6;
}

.overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-sm;
  color: white;
}

.overlay-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: $radius-full;
  border: 1px solid rgba(255, 255, 255, 0.3);

  svg {
    width: 28px;
    height: 28px;
  }
}

.overlay-text {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  letter-spacing: 0.5px;
}

.card-category-badge {
  position: absolute;
  bottom: $spacing-xs;
  left: $spacing-xs;
  right: $spacing-xs;
  z-index: 4;
  display: none;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: linear-gradient(180deg, rgba(16, 24, 40, 0.92), rgba(10, 18, 31, 0.88));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(96, 165, 250, 0.14);
  box-shadow:
    0 10px 18px rgba(2, 8, 23, 0.24),
    inset 0 1px 0 rgba(191, 219, 254, 0.06);
  color: white;
  font-size: 10px;
  font-weight: $font-weight-medium;
  border-radius: $radius-sm;
  max-width: calc(100% - #{$spacing-xs} * 2);

  @include mobile-only {
    display: flex;
  }

  svg {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
  }

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.card-bing-badge {
  position: absolute;
  bottom: $spacing-xs;
  left: $spacing-xs;
  z-index: 4;
  display: none;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: linear-gradient(135deg, rgba(0, 120, 212, 0.95), rgba(16, 110, 190, 0.95));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: white;
  font-size: 11px;
  font-weight: $font-weight-semibold;
  border-radius: $radius-md;
  box-shadow: 0 2px 12px rgba(0, 120, 212, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.2);

  @include mobile-only {
    display: flex;
  }

  svg {
    width: 12px;
    height: 12px;
  }
}
</style>
