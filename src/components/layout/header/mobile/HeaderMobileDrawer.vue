<script setup>
import WallpaperSeriesIcon from '@/components/common/ui/WallpaperSeriesIcon.vue'

defineProps({
  availableSeriesOptions: {
    type: Array,
    default: () => [],
  },
  getSeriesPath: {
    type: Function,
    required: true,
  },
  isSeriesActive: {
    type: Function,
    required: true,
  },
  show: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['close', 'navigate', 'update:show'])
</script>

<template>
  <Teleport to="body">
    <van-popup
      :show="show"
      position="left"
      :style="{ width: '75%', maxWidth: '300px', height: '100%' }"
      class="mobile-drawer"
      :teleport="null"
      :close-on-click-overlay="true"
      @update:show="$emit('update:show', $event)"
    >
      <div class="drawer-content">
        <div class="drawer-header">
          <div class="drawer-brand">
            <div class="brand-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            <span>Wallpaper Gallery</span>
          </div>
          <button class="drawer-close" @click="$emit('close')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="drawer-section nav-section">
          <h3 class="section-title">
            快捷导航
          </h3>
          <div class="nav-grid">
            <button class="nav-card" @click="$emit('navigate', '/')">
              <div class="nav-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <span>首页</span>
            </button>
            <button class="nav-card" @click="$emit('navigate', '/about')">
              <div class="nav-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </div>
              <span>关于</span>
            </button>
          </div>
        </div>

        <div class="drawer-section series-section">
          <h3 class="section-title">
            壁纸分类
          </h3>
          <div class="series-grid">
            <button
              v-for="option in availableSeriesOptions"
              :key="option.id"
              class="series-item"
              :class="{ 'is-active': isSeriesActive(option.id) }"
              @click="$emit('navigate', getSeriesPath(option.id))"
            >
              <WallpaperSeriesIcon :series-id="option.id" />
              <span>{{ option.name }}</span>
            </button>
          </div>
        </div>

        <div class="drawer-section links-section">
          <h3 class="section-title">
            更多
          </h3>
          <a
            href="https://github.com/IT-NuanxinPro/wallpaper-gallery"
            target="_blank"
            rel="noopener noreferrer"
            class="link-card"
          >
            <div class="link-card-icon github">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </div>
            <div class="link-card-content">
              <span class="link-card-title">GitHub</span>
              <span class="link-card-desc">查看源代码</span>
            </div>
            <svg class="link-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </van-popup>
  </Teleport>
</template>

<style lang="scss">
.mobile-drawer.van-popup {
  --van-popup-background: rgba(255, 255, 255, 0.92);
  background: rgba(255, 255, 255, 0.92) !important;
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
}

html[data-theme='dark'] .mobile-drawer.van-popup {
  --van-popup-background: rgba(15, 23, 42, 0.94);
  background: rgba(15, 23, 42, 0.94) !important;
}
</style>

<style lang="scss" scoped>
.mobile-drawer {
  background: transparent;
}

.drawer-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: transparent;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);

  [data-theme='dark'] & {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
}

.drawer-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--color-text-primary);
  font-weight: 700;
  font-size: 16px;

  .brand-logo {
    width: 40px;
    height: 40px;

    svg {
      width: 22px;
      height: 22px;
    }
  }
}

.drawer-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 250ms;

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(255, 255, 255, 0.08);
  }

  &:active {
    background: rgba(102, 126, 234, 0.15);
    color: #667eea;
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

.drawer-section {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);

  [data-theme='dark'] & {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 14px;
}

.nav-grid,
.series-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.nav-card,
.series-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 18px 14px;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  color: var(--color-text-secondary);
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(255, 255, 255, 0.08);
  }

  span {
    font-size: 13px;
    font-weight: 600;
  }

  &:active {
    transform: scale(0.95);
  }
}

.nav-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 14px;
  transition: all 250ms;

  svg {
    width: 24px;
    height: 24px;
    color: #667eea;
  }
}

.series-item {
  svg {
    width: 26px;
    height: 26px;
    transition: transform 250ms;
  }

  &.is-active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-color: transparent;
    color: white;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);

    svg {
      color: white;
      transform: scale(1.1);
    }
  }
}

.link-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  text-decoration: none;
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(255, 255, 255, 0.08);
  }

  &:active {
    transform: scale(0.98);
    background: rgba(102, 126, 234, 0.1);
  }
}

.link-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  flex-shrink: 0;

  svg {
    width: 22px;
    height: 22px;
  }

  &.github {
    background: linear-gradient(135deg, #24292e 0%, #40464d 100%);
    color: white;
  }
}

.link-card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.link-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.link-card-desc {
  font-size: 12px;
  color: var(--color-text-muted);
}

.link-card-arrow {
  width: 20px;
  height: 20px;
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: transform 250ms;
}

.link-card:active .link-card-arrow {
  transform: translateX(4px);
}
</style>
