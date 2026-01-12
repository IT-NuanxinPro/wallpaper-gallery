<script setup>
import { gsap } from 'gsap'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SearchBar from '@/components/common/form/SearchBar.vue'
import EnvBadge from '@/components/common/ui/EnvBadge.vue'
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
          <!-- 每日Bing图标 -->
          <svg v-else-if="option.id === 'bing'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
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

          <!-- 导航菜单 - 卡片网格风格 -->
          <div class="drawer-section nav-section">
            <h3 class="section-title">
              快捷导航
            </h3>
            <div class="nav-grid">
              <button
                class="nav-card"
                @click="navigateTo('/')"
              >
                <div class="nav-card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <span>首页</span>
              </button>
              <button
                class="nav-card"
                @click="navigateTo('/about')"
              >
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
                <!-- 每日Bing图标 -->
                <svg v-else-if="option.id === 'bing'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>{{ option.name }}</span>
              </button>
            </div>
          </div>

          <!-- 外部链接 - 卡片风格 -->
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
}

// 操作按钮 - 毛玻璃效果
.search-toggle,
.theme-toggle,
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

.search-toggle.is-active,
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

.action-divider {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 $spacing-xs;

  [data-theme='dark'] & {
    background: rgba(255, 255, 255, 0.08);
  }
}

// 移动端抽屉样式 - 毛玻璃
.mobile-drawer {
  :deep(.van-popup) {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);

    [data-theme='dark'] & {
      background: rgba(15, 23, 42, 0.9);
    }
  }
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

// 快捷导航卡片网格
.nav-section {
  .section-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 14px;
  }
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.nav-card {
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

  span {
    font-size: 13px;
    font-weight: 600;
  }

  &:active {
    transform: scale(0.95);
  }
}

.drawer-nav {
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);

  [data-theme='dark'] & {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
}

// 外部链接卡片
.links-section {
  .section-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 14px;
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

  &:active .link-card-arrow {
    transform: translateX(4px);
  }
}

.drawer-section {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);

  [data-theme='dark'] & {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
}

// 移动端系列切换 - 毛玻璃卡片
.series-section {
  .section-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 14px;
  }
}

.series-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

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

  svg {
    width: 26px;
    height: 26px;
    transition: transform 250ms;
  }

  span {
    font-size: 13px;
    font-weight: 600;
  }

  &:active {
    transform: scale(0.95);
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

// 移动端搜索弹窗 - 毛玻璃
.mobile-search-popup {
  :deep(.van-popup) {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);

    [data-theme='dark'] & {
      background: rgba(15, 23, 42, 0.9);
    }
  }
}

.search-popup-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  padding-top: calc(14px + env(safe-area-inset-top, 0px));
  background: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);

  [data-theme='dark'] & {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
}

.mobile-search-bar {
  flex: 1;

  :deep(.search-bar) {
    --search-height: 42px;
    --search-radius: 21px;
    max-width: 100%;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);

    [data-theme='dark'] & {
      background: rgba(15, 23, 42, 0.6);
      border-color: rgba(255, 255, 255, 0.08);
    }
  }
}

.search-close-btn {
  flex-shrink: 0;
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 500;
  color: #667eea;
  background: transparent;
  white-space: nowrap;
  transition: opacity 200ms;

  &:active {
    opacity: 0.7;
  }
}
</style>
