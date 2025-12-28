<script setup>
import { gsap } from 'gsap'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EnvBadge from '@/components/common/EnvBadge.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import { useDevice } from '@/composables/useDevice'
import { useFullscreen } from '@/composables/useFullscreen'
import { useSearch } from '@/composables/useSearch'
import { useTheme } from '@/composables/useTheme'
import { useWallpaperType } from '@/composables/useWallpaperType'

const route = useRoute()
const router = useRouter()
const { theme, toggleTheme } = useTheme()
const { isFullscreen, toggleFullscreen } = useFullscreen()
const { isMobile } = useDevice()
const { searchQuery, wallpapers } = useSearch()
const { availableSeriesOptions, currentSeries } = useWallpaperType()

// 判断系列是否为当前激活状态（结合路由和当前系列）
const isSeriesActive = computed(() => (seriesId) => {
  const currentPath = route.path
  // 首页 '/' 根据当前系列判断
  if (currentPath === '/') {
    return currentSeries.value === seriesId
  }
  // 其他路由根据路径判断
  if (seriesId === 'desktop') {
    return currentPath === '/desktop'
  }
  return currentPath === `/${seriesId}`
})

// 导航滑块相关
const navRef = ref(null)
const navSliderStyle = ref({})

// 获取当前激活的系列ID
const activeSeriesId = computed(() => {
  for (const option of availableSeriesOptions.value) {
    if (isSeriesActive.value(option.id))
      return option.id
  }
  return 'desktop'
})

// 更新滑块位置
async function updateNavSliderPosition() {
  await nextTick()
  if (!navRef.value || isMobile.value)
    return
  const activeLink = navRef.value.querySelector('.nav-link.is-active')
  if (activeLink) {
    const navRect = navRef.value.getBoundingClientRect()
    const linkRect = activeLink.getBoundingClientRect()
    navSliderStyle.value = {
      width: `${linkRect.width}px`,
      transform: `translateX(${linkRect.left - navRect.left - 4}px)`,
    }
  }
}

// 监听变化
watch(activeSeriesId, updateNavSliderPosition)
watch(() => route.path, updateNavSliderPosition)

// 处理窗口大小变化
function handleResize() {
  updateNavSliderPosition()
}

onMounted(() => {
  updateNavSliderPosition()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// 获取系列对应的路由路径
function getSeriesPath(seriesId) {
  // desktop 系列可以用首页路由
  if (seriesId === 'desktop') {
    return '/desktop'
  }
  return `/${seriesId}`
}

// 移动端抽屉状态
const showDrawer = ref(false)

// PC 端搜索展开状态
const isSearchExpanded = ref(false)
const searchContainerRef = ref(null)
const searchBarRef = ref(null)
const isAnimating = ref(false)

function openDrawer() {
  showDrawer.value = true
}

function closeDrawer() {
  showDrawer.value = false
}

function navigateTo(path) {
  router.push(path)
  closeDrawer()
}

// PC 端搜索展开/收起 - GSAP 动画
function toggleSearch() {
  if (isMobile.value) {
    // 移动端直接切换弹窗
    isSearchExpanded.value = !isSearchExpanded.value
    return
  }

  if (isAnimating.value)
    return
  isAnimating.value = true

  const searchBar = searchBarRef.value?.$el || searchBarRef.value

  if (!isSearchExpanded.value) {
    // 展开动画
    isSearchExpanded.value = true
    nextTick(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          isAnimating.value = false
          // 聚焦输入框
          const input = searchBar?.querySelector('input')
          input?.focus()
        },
      })

      // 搜索框从右向左展开
      tl.fromTo(searchBar, { width: 0, opacity: 0, x: 20 }, { width: 450, opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' },
      )
    })
  }
  else {
    // 收起动画
    const tl = gsap.timeline({
      onComplete: () => {
        isSearchExpanded.value = false
        isAnimating.value = false
      },
    })

    tl.to(searchBar, { width: 0, opacity: 0, x: 20, duration: 0.3, ease: 'power2.in' },
    )
  }
}

function closeSearch() {
  if (isMobile.value) {
    isSearchExpanded.value = false
    return
  }

  if (isAnimating.value || !isSearchExpanded.value)
    return
  isAnimating.value = true

  const searchBar = searchBarRef.value?.$el || searchBarRef.value

  gsap.to(searchBar, {
    width: 0,
    opacity: 0,
    x: 20,
    duration: 0.3,
    ease: 'power2.in',
    onComplete: () => {
      isSearchExpanded.value = false
      isAnimating.value = false
    },
  })
}
</script>

<template>
  <header class="app-header">
    <div class="header-container">
      <!-- Logo & Title -->
      <div class="header-brand">
        <div class="brand-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
        <div class="brand-text">
          <h1 class="brand-title">
            Wallpaper Gallery
          </h1>
          <span class="brand-subtitle">精选4k高清壁纸</span>
        </div>
      </div>

      <!-- PC 端系列导航 -->
      <nav v-if="!isMobile" ref="navRef" class="header-nav">
        <!-- 滑块背景 -->
        <div class="nav-slider" :style="navSliderStyle" />
        <router-link
          v-for="option in availableSeriesOptions"
          :key="option.id"
          :to="getSeriesPath(option.id)"
          class="nav-link"
          :class="{ 'is-active': isSeriesActive(option.id) }"
        >
          <!-- 电脑壁纸图标 -->
          <svg v-if="option.id === 'desktop'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <!-- 手机壁纸图标 -->
          <svg v-else-if="option.id === 'mobile'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
          <!-- 头像图标 -->
          <svg v-else-if="option.id === 'avatar'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>{{ option.name }}</span>
        </router-link>
      </nav>

      <!-- PC 端操作栏 -->
      <div v-if="!isMobile" class="header-actions">
        <!-- 搜索区域 -->
        <div ref="searchContainerRef" class="header-search" :class="{ 'is-expanded': isSearchExpanded }">
          <SearchBar
            v-show="isSearchExpanded"
            ref="searchBarRef"
            v-model="searchQuery"
            placeholder="搜索壁纸..."
            :wallpapers="wallpapers"
            class="header-search-bar"
          />
          <button
            class="search-toggle"
            :class="{ 'is-active': isSearchExpanded }"
            :aria-label="isSearchExpanded ? '关闭搜索' : '打开搜索'"
            @click="toggleSearch"
          >
            <!-- Search Icon -->
            <svg v-if="!isSearchExpanded" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <!-- Close Icon -->
            <svg v-else class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Fullscreen Toggle -->
        <button
          class="fullscreen-toggle"
          :class="{ 'is-active': isFullscreen }"
          :aria-label="isFullscreen ? '退出全屏' : '全屏浏览'"
          @click="toggleFullscreen"
        >
          <!-- Expand Icon -->
          <svg v-if="!isFullscreen" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
          <!-- Minimize Icon -->
          <svg v-else class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
          </svg>
        </button>

        <button
          class="theme-toggle"
          :aria-label="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
          @click="toggleTheme"
        >
          <!-- Sun Icon -->
          <svg v-if="theme === 'dark'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          <!-- Moon Icon -->
          <svg v-else class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>

        <a
          href="https://github.com/IT-NuanxinPro/wallpaper-gallery"
          target="_blank"
          rel="noopener noreferrer"
          class="github-link"
          aria-label="GitHub"
        >
          <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        </a>

        <!-- 环境标识 -->
        <EnvBadge class="header-env-badge" />
      </div>

      <!-- 移动端操作栏 -->
      <div v-else class="header-actions-mobile">
        <!-- 搜索按钮 -->
        <button
          class="search-toggle"
          :class="{ 'is-active': isSearchExpanded }"
          aria-label="搜索"
          @click="toggleSearch"
        >
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>

        <button
          class="theme-toggle"
          :aria-label="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
          @click="toggleTheme"
        >
          <svg v-if="theme === 'dark'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          <svg v-else class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>

        <!-- 汉堡菜单按钮 -->
        <button class="hamburger-btn" aria-label="打开菜单" @click="openDrawer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>

        <!-- 环境标识 -->
        <EnvBadge class="header-env-badge" />
      </div>
    </div>

    <!-- 移动端搜索弹窗 -->
    <Teleport v-if="isMobile" to="body">
      <van-popup
        v-model:show="isSearchExpanded"
        position="top"
        :style="{ width: '100%' }"
        class="mobile-search-popup"
        :teleport="null"
        :close-on-click-overlay="true"
      >
        <div class="search-popup-content">
          <SearchBar
            v-model="searchQuery"
            placeholder="搜索壁纸..."
            :wallpapers="wallpapers"
            class="mobile-search-bar"
            @search="closeSearch"
          />
          <button class="search-close-btn" @click="closeSearch">
            取消
          </button>
        </div>
      </van-popup>
    </Teleport>

    <!-- 移动端左侧抽屉 - 使用 Teleport 确保层级 -->
    <Teleport to="body">
      <van-popup
        v-model:show="showDrawer"
        position="left"
        :style="{ width: '75%', maxWidth: '300px', height: '100%' }"
        class="mobile-drawer"
        :teleport="null"
        :close-on-click-overlay="true"
      >
        <div class="drawer-content">
          <!-- 抽屉头部 -->
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
            <button class="drawer-close" @click="closeDrawer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 导航菜单 -->
          <nav class="drawer-nav">
            <button class="nav-item" @click="navigateTo('/')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>首页</span>
            </button>
            <button class="nav-item" @click="navigateTo('/about')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <span>关于</span>
            </button>
          </nav>

          <!-- 系列切换 -->
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
                @click="navigateTo(getSeriesPath(option.id))"
              >
                <!-- 电脑壁纸图标 -->
                <svg v-if="option.id === 'desktop'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <!-- 手机壁纸图标 -->
                <svg v-else-if="option.id === 'mobile'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
                <!-- 头像图标 -->
                <svg v-else-if="option.id === 'avatar'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>{{ option.name }}</span>
              </button>
            </div>
          </div>

          <!-- 外部链接 -->
          <div class="drawer-section">
            <a
              href="https://github.com/IT-NuanxinPro/wallpaper-gallery"
              target="_blank"
              rel="noopener noreferrer"
              class="nav-item external-link"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span>GitHub</span>
              <svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </a>
          </div>
        </div>
      </van-popup>
    </Teleport>
  </header>
</template>

<style lang="scss" scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  backdrop-filter: blur(10px);
  transition: all var(--transition-normal);
}

.header-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: $container-max-width;
  margin: 0 auto;
  padding: $spacing-md $spacing-lg;
  height: $header-height;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.brand-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover));
  border-radius: $radius-md;
  color: white;

  svg {
    width: 24px;
    height: 24px;
  }
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-size: $font-size-lg;
  font-weight: $font-weight-bold;
  color: var(--color-text-primary);
  line-height: 1.2;

  @include mobile-only {
    font-size: $font-size-md;
  }
}

.brand-subtitle {
  font-size: $font-size-xs;
  color: var(--color-text-muted);

  @include mobile-only {
    display: none;
  }
}

// PC 端系列导航
.header-nav {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  margin-left: $spacing-xl;
  position: relative;
  padding: 4px;
  background: var(--color-bg-hover);
  border-radius: $radius-lg;
}

// 导航滑块
.nav-slider {
  position: absolute;
  top: 4px;
  left: 4px;
  height: calc(100% - 8px);
  background: var(--color-bg-card);
  border-radius: $radius-md;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 0;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: var(--color-text-secondary);
  text-decoration: none;
  border-radius: $radius-md;
  transition: color var(--transition-fast);
  position: relative;
  z-index: 1;
  background: transparent;

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover {
    color: var(--color-text-primary);
  }

  &.is-active,
  &.router-link-active {
    color: var(--color-accent);
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.header-env-badge {
  margin-left: $spacing-sm;
}

// PC 端搜索区域
.header-search {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  position: relative;
}

.header-search-bar {
  width: 0;
  opacity: 0;
  overflow: hidden;
  // 由 GSAP 控制动画，不使用 CSS transition

  :deep(.search-bar) {
    --search-height: 40px;
    --search-radius: 20px;
    min-width: 400px;
  }
}

.search-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: $radius-full;
  color: var(--color-text-secondary);
  background: transparent;
  transition: all var(--transition-fast);
  flex-shrink: 0;

  .icon {
    width: 20px;
    height: 20px;
  }

  &:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }

  &.is-active {
    background: var(--color-accent-light);
    color: var(--color-accent);
  }
}

.header-actions-mobile {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
}

.action-divider {
  width: 1px;
  height: 24px;
  background: var(--color-border);
  margin: 0 $spacing-xs;
}

.theme-toggle,
.github-link,
.fullscreen-toggle,
.hamburger-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: $radius-full;
  color: var(--color-text-secondary);
  background: transparent;
  transition: all var(--transition-fast);

  &:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }

  .icon {
    width: 20px;
    height: 20px;
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

.fullscreen-toggle {
  &.is-active {
    background: var(--color-accent-light);
    color: var(--color-accent);
  }
}

// 移动端抽屉样式
.mobile-drawer {
  :deep(.van-popup) {
    background: var(--color-bg-primary);
  }
}

.drawer-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-primary);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.drawer-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: 16px;

  .brand-logo {
    width: 36px;
    height: 36px;

    svg {
      width: 20px;
      height: 20px;
    }
  }
}

.drawer-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--color-text-secondary);
  background: transparent;

  &:active {
    background: var(--color-bg-hover);
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

.drawer-nav {
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  color: var(--color-text-primary);
  font-size: 15px;
  text-decoration: none;
  background: transparent;
  text-align: left;

  &:active {
    background: var(--color-bg-hover);
  }

  svg {
    width: 22px;
    height: 22px;
    color: var(--color-text-muted);
  }
}

.external-link {
  .external-icon {
    margin-left: auto;
    width: 16px;
    height: 16px;
    color: var(--color-text-muted);
  }
}

.drawer-section {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

// 移动端系列切换
.series-section {
  .section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }
}

.series-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.series-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: var(--color-bg-hover);
  border-radius: 12px;
  color: var(--color-text-secondary);
  transition: all 0.2s ease;

  svg {
    width: 24px;
    height: 24px;
  }

  span {
    font-size: 13px;
    font-weight: 500;
  }

  &:active {
    transform: scale(0.95);
  }

  &.is-active {
    background: var(--color-accent-light);
    color: var(--color-accent);

    svg {
      color: var(--color-accent);
    }
  }
}

// 移动端搜索弹窗
.mobile-search-popup {
  :deep(.van-popup) {
    background: var(--color-bg-primary);
  }
}

.search-popup-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
}

.mobile-search-bar {
  flex: 1;

  :deep(.search-bar) {
    --search-height: 40px;
    --search-radius: 20px;
    max-width: 100%;
  }
}

.search-close-btn {
  flex-shrink: 0;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--color-text-secondary);
  background: transparent;
  white-space: nowrap;

  &:active {
    color: var(--color-accent);
  }
}
</style>
