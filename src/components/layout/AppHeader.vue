<script setup>
import { gsap } from 'gsap'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EnvBadge from '@/components/common/ui/EnvBadge.vue'
import WallpaperSeriesIcon from '@/components/common/ui/WallpaperSeriesIcon.vue'
import HeaderMobileDrawer from '@/components/layout/header/mobile/HeaderMobileDrawer.vue'
import HeaderMobileSearchPopup from '@/components/layout/header/mobile/HeaderMobileSearchPopup.vue'
import HeaderThemeSwitcher from '@/components/layout/header/theme/HeaderThemeSwitcher.vue'
import SearchBar from '@/components/search/index.vue'
import { useHeaderNavSlider } from '@/composables/header/useHeaderNavSlider'
import { useDevice } from '@/composables/useDevice'
import { useFullscreen } from '@/composables/useFullscreen'
import { useTheme } from '@/composables/useTheme'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { useFilterStore } from '@/stores/filter'
import { useWallpaperStore } from '@/stores/wallpaper'

const route = useRoute()
const router = useRouter()
const { theme, themeMode, themeOptions, toggleTheme, setThemeMode } = useTheme()
const { isFullscreen, toggleFullscreen } = useFullscreen()
const { isMobile, isTablet, windowWidth } = useDevice()
const filterStore = useFilterStore()
const wallpaperStore = useWallpaperStore()
const { searchQuery } = storeToRefs(filterStore)
const { wallpapers } = storeToRefs(wallpaperStore)
const { availableSeriesOptions, currentSeries } = useWallpaperType()

const { isSeriesActive, navRef, navSliderStyle } = useHeaderNavSlider({
  availableSeriesOptions,
  currentSeries,
  isMobile,
  route,
})

onMounted(() => {
  document.addEventListener('pointerdown', handleGlobalPointerDown)
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleGlobalPointerDown)
  window.removeEventListener('keydown', handleGlobalKeydown)
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
const showThemeMenu = ref(false)
const themeSwitcherRef = ref(null)

const activeThemeOption = computed(() =>
  themeOptions.find(option => option.value === themeMode.value) || themeOptions[0],
)

const themeButtonLabel = computed(() =>
  `${activeThemeOption.value.label}，当前${theme.value === 'dark' ? '深色' : '浅色'}`,
)

const searchExpandWidth = computed(() => {
  if (isTablet.value) {
    return Math.min(360, Math.max(280, Math.round(windowWidth.value * 0.34)))
  }

  return 360
})

const tabletSeriesShortLabelMap = {
  desktop: '电脑',
  mobile: '手机',
  avatar: '头像',
  bing: 'Bing',
}

function getSeriesLabel(option) {
  if (isTablet.value) {
    return tabletSeriesShortLabelMap[option.id] || option.name
  }

  return option.name
}

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
      const searchBar = searchBarRef.value?.$el || searchBarRef.value
      const tl = gsap.timeline({
        onComplete: () => {
          isAnimating.value = false
          // 聚焦输入框
          const input = searchBar?.querySelector('input')
          input?.focus()
        },
      })

      // 搜索框从右向左展开
      tl.fromTo(searchBar, { width: 0, opacity: 0, x: 20 }, { width: searchExpandWidth.value, opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' },
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

function handleSearch(payload) {
  if (payload?.mode === 'exact' && payload.exactValue) {
    filterStore.setExactSearch(payload.query, payload.exactValue)
  }
  else {
    filterStore.clearExactSearch()
    searchQuery.value = payload?.query ?? ''
  }

  if (isMobile.value) {
    closeSearch()
  }
}

function toggleThemeMenu() {
  showThemeMenu.value = !showThemeMenu.value
}

function closeThemeMenu() {
  showThemeMenu.value = false
}

function handleThemeOptionSelect(mode) {
  setThemeMode(mode)
  closeThemeMenu()
}

function handleThemeQuickToggle() {
  toggleTheme()
  closeThemeMenu()
}

function handleGlobalPointerDown(event) {
  if (isMobile.value || !showThemeMenu.value)
    return

  const target = event.target
  if (themeSwitcherRef.value?.containsTarget(target))
    return

  closeThemeMenu()
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape') {
    closeThemeMenu()
  }
}

watch(() => route.path, () => {
  closeSearch()
  closeThemeMenu()
}, { flush: 'post' })

watch(isMobile, () => {
  closeSearch()
  closeThemeMenu()
})
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
          <WallpaperSeriesIcon :series-id="option.id" />
          <span>{{ getSeriesLabel(option) }}</span>
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
            @search="handleSearch"
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

        <HeaderThemeSwitcher
          ref="themeSwitcherRef"
          v-model:show-theme-menu="showThemeMenu"
          :active-theme-option="activeThemeOption"
          :theme="theme"
          :theme-button-label="themeButtonLabel"
          :theme-mode="themeMode"
          :theme-options="themeOptions"
          @toggle="toggleThemeMenu"
          @quick-toggle="handleThemeQuickToggle"
          @select="handleThemeOptionSelect"
        />

        <router-link
          to="/about"
          class="header-about-link"
          aria-label="关于项目"
        >
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span>关于</span>
        </router-link>

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

        <HeaderThemeSwitcher
          v-model:show-theme-menu="showThemeMenu"
          :active-theme-option="activeThemeOption"
          :is-mobile="isMobile"
          :theme="theme"
          :theme-button-label="themeButtonLabel"
          :theme-mode="themeMode"
          :theme-options="themeOptions"
          @toggle="toggleThemeMenu"
          @quick-toggle="handleThemeQuickToggle"
          @select="handleThemeOptionSelect"
        />

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

    <HeaderMobileSearchPopup
      v-if="isMobile"
      v-model:show="isSearchExpanded"
      v-model:search-query="searchQuery"
      :wallpapers="wallpapers"
      @close="closeSearch"
      @search="handleSearch"
    />

    <HeaderMobileDrawer
      v-model:show="showDrawer"
      :available-series-options="availableSeriesOptions"
      :get-series-path="getSeriesPath"
      :is-series-active="isSeriesActive"
      @close="closeDrawer"
      @navigate="navigateTo"
    />
  </header>
</template>

<style lang="scss" scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);

  // PC 端使用 backdrop-filter
  @include tablet-up {
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  // 移动端使用纯色背景，避免滚动卡顿
  @include mobile-only {
    background: rgba(255, 255, 255, 0.95);
  }

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.75);
    border-bottom-color: rgba(255, 255, 255, 0.08);

    @include mobile-only {
      background: rgba(15, 23, 42, 0.95);
    }
  }
}

.header-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: $container-max-width;
  margin: 0 auto;
  padding: $spacing-md $spacing-lg;
  height: $header-height;

  @include screen-2k-up {
    max-width: $container-max-width-xl;
    padding: $spacing-md $spacing-2xl;
  }

  @include screen-4k-up {
    max-width: $container-max-width-2xl;
  }
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
  width: 46px;
  height: 46px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: $radius-lg;
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.35);
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 24px;
    height: 24px;
  }

  &:hover {
    transform: scale(1.05) rotate(-3deg);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.45);
  }
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-size: $font-size-lg;
  font-weight: $font-weight-bold;
  line-height: 1.2;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;

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

// PC 端系列导航 - 毛玻璃胶囊
.header-nav {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  margin-left: $spacing-xl;
  position: relative;
  padding: 5px;
  flex-shrink: 1;
  min-width: 0;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: $radius-xl;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(255, 255, 255, 0.08);
  }

  @media (min-width: 768px) and (max-width: 1180px) {
    margin-left: $spacing-md;
    gap: 4px;
    padding: 4px;
  }
}

// 导航滑块 - 渐变效果
.nav-slider {
  position: absolute;
  top: 5px;
  left: 5px;
  height: calc(100% - 10px);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: $radius-lg;
  box-shadow: 0 2px 10px rgba(102, 126, 234, 0.4);
  transition:
    opacity 180ms ease,
    transform 350ms cubic-bezier(0.4, 0, 0.2, 1),
    width 350ms cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 0;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: var(--color-text-secondary);
  text-decoration: none;
  border-radius: $radius-lg;
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 1;
  background: transparent;
  white-space: nowrap;
  flex-shrink: 0;

  svg {
    width: 18px;
    height: 18px;
    transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  &:hover {
    color: var(--color-text-primary);

    svg {
      transform: scale(1.1);
    }
  }

  &.is-active,
  &.router-link-active {
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  @media (min-width: 768px) and (max-width: 1180px) {
    gap: 5px;
    padding: 9px 12px;
    font-size: 13px;

    svg {
      width: 16px;
      height: 16px;
    }
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  flex-shrink: 0;

  @media (min-width: 768px) and (max-width: 1180px) {
    gap: 8px;
  }
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

  @media (min-width: 768px) and (max-width: 1180px) {
    width: 42px;
    flex-shrink: 0;
  }
}

.header-search-bar {
  width: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;

  .header-search.is-expanded & {
    pointer-events: auto;
  }

  :deep(.search-bar) {
    --search-height: 42px;
    --search-radius: 21px;
    min-width: 400px;
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.2);

    [data-theme='dark'] & {
      background: rgba(15, 23, 42, 0.6);
      border-color: rgba(255, 255, 255, 0.08);
    }
  }

  @media (min-width: 768px) and (max-width: 1180px) {
    position: absolute;
    top: 50%;
    right: calc(100% + 10px);
    z-index: 8;
    overflow: visible;
    transform: translateY(-50%);

    :deep(.search-bar) {
      min-width: 0;
      max-width: 360px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.22);
    }
  }
}

// 操作按钮 - 毛玻璃效果
.search-toggle,
.theme-toggle,
.header-about-link,
.github-link,
.fullscreen-toggle,
.hamburger-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: $radius-full;
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);

  // PC 端使用 backdrop-filter
  @include tablet-up {
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  // 移动端使用纯色背景
  @include mobile-only {
    background: rgba(255, 255, 255, 0.8);
  }

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(255, 255, 255, 0.08);

    @include mobile-only {
      background: rgba(15, 23, 42, 0.85);
    }
  }

  &:hover {
    background: rgba(102, 126, 234, 0.15);
    border-color: rgba(102, 126, 234, 0.3);
    color: #667eea;
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.2);
  }

  &:active {
    transform: translateY(0) scale(0.95);
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

.header-about-link {
  width: auto;
  padding: 0 16px 0 14px;
  gap: 8px;
  text-decoration: none;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;

  span {
    line-height: 1;
  }

  @media (max-width: 1320px) {
    width: 42px;
    padding: 0;

    span {
      display: none;
    }
  }

  &.router-link-active {
    background: rgba(102, 126, 234, 0.14);
    border-color: rgba(102, 126, 234, 0.25);
    color: #667eea;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.16);
  }
}

.search-toggle.is-active,
.theme-toggle.is-active,
.fullscreen-toggle.is-active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);

  &:hover {
    color: white;
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
  }
}

.header-actions-mobile {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
}
</style>
