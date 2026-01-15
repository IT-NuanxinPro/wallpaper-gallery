<script setup>
import { storeToRefs } from 'pinia'
import { useWallpaperStore } from '@/stores/wallpaper'

const currentYear = new Date().getFullYear()
const wallpaperStore = useWallpaperStore()
const { statistics } = storeToRefs(wallpaperStore)

// 开发环境显示统计，生产环境隐藏
const isDev = import.meta.env.DEV
</script>

<template>
  <footer class="app-footer">
    <div class="footer-container">
      <!-- 统计信息（仅开发环境显示） -->
      <div v-if="isDev && statistics.total > 0" class="footer-stats">
        <div class="stats-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
          <span>壁纸统计</span>
        </div>
        <div class="stats-items">
          <div class="stats-item">
            <span class="stats-value">{{ statistics.total }}</span>
            <span class="stats-label">总数量</span>
          </div>
          <div class="stats-divider" />
          <div class="stats-item">
            <span class="stats-value">{{ statistics.jpg }}</span>
            <span class="stats-label">JPG</span>
          </div>
          <div class="stats-divider" />
          <div class="stats-item">
            <span class="stats-value">{{ statistics.png }}</span>
            <span class="stats-label">PNG</span>
          </div>
          <div class="stats-divider" />
          <div class="stats-item">
            <span class="stats-value">{{ statistics.totalSizeFormatted }}</span>
            <span class="stats-label">总大小</span>
          </div>
        </div>
      </div>

      <!-- 版权信息 -->
      <div class="footer-content">
        <p class="footer-text">
          © {{ currentYear }} Wallpaper Gallery.
          <span class="footer-divider">|</span>
          Made with ❤️
        </p>
      </div>
    </div>
  </footer>
</template>

<style lang="scss" scoped>
.app-footer {
  margin-top: auto;
  padding: $spacing-xl 0;
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
  // 预留最小高度，避免内容加载时的 CLS
  min-height: 80px;
}

.footer-container {
  max-width: $container-max-width;
  margin: 0 auto;
  padding: 0 $spacing-lg;

  // 2K 屏幕加宽
  @include screen-2k-up {
    max-width: $container-max-width-xl;
    padding: 0 $spacing-2xl;
  }

  // 4K 屏幕进一步加宽
  @include screen-4k-up {
    max-width: $container-max-width-2xl;
  }
}

// 统计信息
.footer-stats {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-md;
  padding-bottom: $spacing-lg;
  margin-bottom: $spacing-lg;
  border-bottom: 1px solid var(--color-border);
}

.stats-title {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);

  svg {
    width: 18px;
    height: 18px;
    color: var(--color-accent);
  }
}

.stats-items {
  display: flex;
  align-items: center;
  gap: $spacing-lg;
  flex-wrap: wrap;
  justify-content: center;

  @include mobile-only {
    gap: $spacing-md;
  }
}

.stats-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stats-value {
  font-size: $font-size-lg;
  font-weight: $font-weight-bold;
  color: var(--color-text-primary);

  @include mobile-only {
    font-size: $font-size-md;
  }
}

.stats-label {
  font-size: $font-size-xs;
  color: var(--color-text-muted);
}

.stats-divider {
  width: 1px;
  height: 32px;
  background: var(--color-border);

  @include mobile-only {
    height: 24px;
  }
}

// 版权信息
.footer-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-sm;
  text-align: center;
}

.footer-text {
  font-size: $font-size-sm;
  color: var(--color-text-secondary);
}

.footer-divider {
  margin: 0 $spacing-sm;
  color: var(--color-border);
}

.footer-source {
  font-size: $font-size-xs;
  color: var(--color-text-muted);

  a {
    color: var(--color-accent);
    transition: color var(--transition-fast);

    &:hover {
      color: var(--color-accent-hover);
      text-decoration: underline;
    }
  }
}
</style>
