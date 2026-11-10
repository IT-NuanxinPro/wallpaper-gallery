<script setup>
import RemoteAvatar from '@/components/common/ui/RemoteAvatar.vue'
import WallpaperSeriesIcon from '@/components/common/ui/WallpaperSeriesIcon.vue'

defineProps({
  availableSeriesOptions: {
    type: Array,
    default: () => [],
  },
  authAvatarInitial: {
    type: String,
    default: 'U',
  },
  authAvatarSources: {
    type: Array,
    default: () => [],
  },
  authAvatarStyle: {
    type: Object,
    default: () => ({}),
  },
  authAvatarUrl: {
    type: String,
    default: '',
  },
  accountRoute: {
    type: [String, Object],
    default: '/account',
  },
  authDisplayName: {
    type: String,
    default: '',
  },
  authSecondaryLabel: {
    type: String,
    default: '',
  },
  authEntryRoute: {
    type: [String, Object],
    default: '/login',
  },
  getSeriesPath: {
    type: Function,
    required: true,
  },
  isAuthConfigured: {
    type: Boolean,
    default: false,
  },
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
  isSeriesActive: {
    type: Function,
    required: true,
  },
  libraryCollectionsRoute: {
    type: [String, Object],
    default: () => ({
      path: '/library',
      query: {
        tab: 'collections',
      },
    }),
  },
  libraryLikesRoute: {
    type: [String, Object],
    default: () => ({
      path: '/library',
      query: {
        tab: 'likes',
      },
    }),
  },
  show: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['close', 'navigate', 'signout', 'update:show'])
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

        <div v-if="isAuthConfigured && isAuthenticated" class="drawer-section account-section">
          <div class="drawer-account-card">
            <RemoteAvatar
              :sources="authAvatarSources"
              :src="authAvatarUrl"
              :alt="`${authDisplayName} 头像`"
              :initial="authAvatarInitial"
              :fallback-style="authAvatarStyle"
              image-class="drawer-account-card__avatar-image"
              fallback-class="drawer-account-card__avatar drawer-account-card__avatar-initial"
            />

            <div class="drawer-account-card__copy">
              <strong>{{ authDisplayName || '账号中心' }}</strong>
              <span>{{ authSecondaryLabel || '当前账号暂未返回邮箱地址' }}</span>
            </div>
          </div>

          <div class="drawer-account-actions">
            <button class="drawer-account-action" @click="$emit('navigate', accountRoute)">
              <div class="drawer-account-action__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21a8 8 0 1 0-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div class="drawer-account-action__copy">
                <strong>个人信息</strong>
                <span>查看昵称、邮箱和绑定状态</span>
              </div>
              <svg class="drawer-account-action__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>

            <button class="drawer-account-action" @click="$emit('navigate', libraryCollectionsRoute)">
              <div class="drawer-account-action__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div class="drawer-account-action__copy">
                <strong>收藏夹</strong>
                <span>进入统一壁纸库的收藏分区</span>
              </div>
              <svg class="drawer-account-action__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>

            <button class="drawer-account-action" @click="$emit('navigate', libraryLikesRoute)">
              <div class="drawer-account-action__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m12 21-1.45-1.32C5.4 15.03 2 11.95 2 8.5 2 5.42 4.42 3 7.5 3A5.3 5.3 0 0 1 12 5.09 5.3 5.3 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.45-3.4 6.53-8.55 11.18z" />
                </svg>
              </div>
              <div class="drawer-account-action__copy">
                <strong>我的喜欢</strong>
                <span>查看你点过爱心的内容入口</span>
              </div>
              <svg class="drawer-account-action__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>

            <button class="drawer-account-action drawer-account-action--danger" @click="$emit('signout')">
              <div class="drawer-account-action__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </div>
              <div class="drawer-account-action__copy">
                <strong>退出登录</strong>
                <span>结束当前会话并返回访客状态</span>
              </div>
              <svg class="drawer-account-action__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>
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
            <button class="nav-card" @click="$emit('navigate', '/collections')">
              <div class="nav-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="18" height="7" rx="1" /></svg>
              </div>
              <span>精选专题</span>
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
            <RouterLink
              v-if="!isAuthenticated"
              class="nav-card"
              :to="authEntryRoute"
              @click="$emit('close')"
            >
              <div class="nav-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <path d="M10 17l5-5-5-5" />
                  <path d="M15 12H3" />
                </svg>
              </div>
              <span>登录</span>
            </RouterLink>
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
  line-height: 1;

  span {
    display: flex;
    align-items: center;
    min-height: 40px;
  }

  .brand-logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 40px;
    width: 40px;
    height: 40px;

    svg {
      display: block;
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
    background: var(--accent-surface);
    color: var(--color-accent);
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

.drawer-account-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.68), rgba(255, 255, 255, 0.42)),
    linear-gradient(140deg, rgba(56, 189, 248, 0.14), rgba(59, 130, 246, 0.06) 70%, rgba(245, 158, 11, 0.08));
  border: 1px solid rgba(255, 255, 255, 0.24);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    0 12px 28px rgba(15, 23, 42, 0.08);

  [data-theme='dark'] & {
    background:
      linear-gradient(135deg, rgba(15, 23, 42, 0.74), rgba(15, 23, 42, 0.52)),
      linear-gradient(140deg, rgba(56, 189, 248, 0.12), rgba(59, 130, 246, 0.06) 70%, rgba(16, 185, 129, 0.08));
    border-color: rgba(148, 163, 184, 0.14);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 14px 30px rgba(0, 0, 0, 0.24);
  }
}

:deep(.drawer-account-card__avatar),
:deep(.drawer-account-card__avatar-image) {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
}

:deep(.drawer-account-card__avatar) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--avatar-accent-end, #2563eb);
  box-shadow: 0 10px 20px var(--avatar-accent-shadow, rgba(37, 99, 235, 0.28));
}

:deep(.drawer-account-card__avatar-image) {
  object-fit: cover;
  border-radius: 18px;
}

:deep(.drawer-account-card__avatar-initial) {
  color: white;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.drawer-account-card__copy {
  min-width: 0;

  strong {
    display: block;
    color: var(--color-text-primary);
    font-size: 16px;
    line-height: 1.2;
  }

  span {
    display: block;
    margin-top: 6px;
    color: var(--color-text-secondary);
    font-size: 12px;
    line-height: 1.5;
    word-break: break-word;
  }
}

.drawer-account-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.drawer-account-action {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  text-align: left;
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 18px;
  transition: all 220ms ease;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.62);
    border-color: rgba(255, 255, 255, 0.08);
  }

  &:active {
    transform: scale(0.98);
  }
}

.drawer-account-action__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  color: #0284c7;
  background: rgba(14, 165, 233, 0.12);
  flex-shrink: 0;

  [data-theme='dark'] & {
    color: #7dd3fc;
    background: rgba(14, 165, 233, 0.16);
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

.drawer-account-action__copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 4px;
  flex: 1;

  strong {
    color: inherit;
    font-size: 14px;
    line-height: 1.2;
  }

  span {
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 1.5;
  }
}

.drawer-account-action__arrow {
  width: 16px;
  height: 16px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.drawer-account-action--danger {
  .drawer-account-action__icon {
    color: #dc2626;
    background: rgba(239, 68, 68, 0.12);

    [data-theme='dark'] & {
      color: #fda4af;
      background: rgba(239, 68, 68, 0.16);
    }
  }
}

.nav-grid,
.series-grid {
  display: grid;
  gap: 12px;
}

.nav-grid {
  grid-template-columns: 1fr;
}

.series-grid {
  grid-template-columns: repeat(2, 1fr);
}

.nav-card,
.series-item {
  display: flex;
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

.nav-card {
  justify-content: flex-start;
  min-height: 68px;
  padding: 12px 14px;
  border-radius: 14px;

  span {
    font-size: 15px;
  }
}

.nav-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  background: var(--accent-surface);
  border-radius: 12px;
  transition: all 250ms;
  flex-shrink: 0;

  svg {
    width: 22px;
    height: 22px;
    color: var(--color-accent);
  }
}

.series-item {
  flex-direction: column;
  justify-content: center;
  svg {
    width: 26px;
    height: 26px;
    transition: transform 250ms;
  }

  &.is-active {
    background: var(--accent-gradient);
    border-color: transparent;
    color: white;
    box-shadow: 0 4px 15px var(--accent-shadow);

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
    background: var(--accent-surface);
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
