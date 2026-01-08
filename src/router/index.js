import { createRouter, createWebHistory } from 'vue-router'
import { isMobileDevice } from '@/composables/useDevice'
import { DEVICE_SERIES } from '@/utils/constants'

// ========================================
// 路由配置（使用标准懒加载，骨架屏由 App.vue Suspense 处理）
// ========================================
const routes = [
  // 首页 - 根据设备类型自动选择系列
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: { title: 'Wallpaper Gallery - 精选高清壁纸' },
  },
  // 电脑壁纸（横屏 16:10）
  {
    path: '/desktop',
    name: 'Desktop',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: '电脑壁纸 - Wallpaper Gallery',
      series: 'desktop',
      aspectType: 'landscape',
    },
  },
  // Bing 每日壁纸（横屏 16:9）
  {
    path: '/bing',
    name: 'Bing',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: 'Bing 每日壁纸 - Wallpaper Gallery',
      series: 'bing',
      aspectType: 'landscape',
    },
  },
  // 手机壁纸（竖屏 9:16）
  {
    path: '/mobile',
    name: 'Mobile',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: '手机壁纸 - Wallpaper Gallery',
      series: 'mobile',
      aspectType: 'portrait',
    },
  },
  // 头像（正方形 1:1）
  {
    path: '/avatar',
    name: 'Avatar',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: '头像 - Wallpaper Gallery',
      series: 'avatar',
      aspectType: 'square',
    },
  },
  // 关于页面
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/About.vue'),
    meta: { title: '关于我们 - Wallpaper Gallery' },
  },
  // Android 下载页面
  {
    path: '/download',
    name: 'Download',
    component: () => import('@/views/DownloadPage.vue'),
    meta: { title: '下载 App - Wallpaper Gallery', hideHeader: true },
  },
  // 404 重定向到首页
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0, behavior: 'smooth' }
  },
})

// ========================================
// 路由守卫配置
// ========================================

// 存储键常量
const STORAGE_KEY_SERIES = 'wallpaper-gallery-current-series'
const STORAGE_KEY_USER_CHOICE = 'wallpaper-gallery-user-explicit-choice'

// 导航计数，用于循环检测
let navigationCount = 0
let lastNavigationTime = 0
const MAX_NAVIGATIONS_PER_SECOND = 5 // 每秒最大导航次数
const NAVIGATION_RESET_TIME = 1000 // 重置计数器的时间间隔

// 缓存设备类型（单次会话内设备类型不变，避免重复检测）
let cachedDeviceType = null

/**
 * 获取当前设备类型（带缓存）
 */
function getDeviceType() {
  if (cachedDeviceType === null) {
    cachedDeviceType = isMobileDevice() ? 'mobile' : 'desktop'
  }
  return cachedDeviceType
}

/**
 * 检查系列是否对当前设备可用
 */
function isSeriesAvailableForDevice(series, deviceType) {
  const available = DEVICE_SERIES[deviceType] || DEVICE_SERIES.desktop
  return available.includes(series)
}

/**
 * 获取用户应该看到的默认系列（优化版：减少 localStorage 读取次数）
 * 优先级：用户明确选择（如果对当前设备可用）> 设备类型推荐
 */
function getRecommendedSeries() {
  const deviceType = getDeviceType()
  const defaultSeries = deviceType === 'mobile' ? 'mobile' : 'desktop'

  // 一次性读取用户选择，优先使用明确选择
  const userChoice = localStorage.getItem(STORAGE_KEY_USER_CHOICE)
  if (userChoice && isSeriesAvailableForDevice(userChoice, deviceType)) {
    return userChoice
  }

  // 检查保存的系列偏好（仅当无明确选择时）
  if (!userChoice) {
    const savedSeries = localStorage.getItem(STORAGE_KEY_SERIES)
    if (savedSeries && isSeriesAvailableForDevice(savedSeries, deviceType)) {
      return savedSeries
    }
  }

  // 使用设备默认系列
  return defaultSeries
}

/**
 * 记录用户的明确选择
 * 当用户主动点击导航时调用
 */
export function recordUserChoice(series) {
  localStorage.setItem(STORAGE_KEY_USER_CHOICE, series)
  localStorage.setItem(STORAGE_KEY_SERIES, series)
}

/**
 * 清除用户选择记录（用于重置）
 */
export function clearUserChoice() {
  localStorage.removeItem(STORAGE_KEY_USER_CHOICE)
}

// 路由守卫
router.beforeEach((to, from, next) => {
  // 1. 更新页面标题
  if (to.meta.title) {
    document.title = to.meta.title
  }

  // 2. 循环检测：检查短时间内的导航次数
  const now = Date.now()
  if (now - lastNavigationTime > NAVIGATION_RESET_TIME) {
    navigationCount = 0
  }
  lastNavigationTime = now
  navigationCount++

  if (navigationCount > MAX_NAVIGATIONS_PER_SECOND) {
    console.warn('[Router] 检测到可能的导航循环，跳过重定向')
    next()
    return
  }

  // 3. 首页智能重定向（优先处理，避免渲染空状态）
  if (to.path === '/') {
    const recommendedSeries = getRecommendedSeries()
    next({ path: `/${recommendedSeries}`, replace: true })
    return
  }

  // 4. 设备兼容性检查：目标系列是否对当前设备可用
  if (to.meta?.series) {
    const deviceType = getDeviceType()
    const targetSeries = to.meta.series

    // 如果目标系列对当前设备不可用，重定向到推荐系列
    if (!isSeriesAvailableForDevice(targetSeries, deviceType)) {
      const recommendedSeries = getRecommendedSeries()
      // 避免重定向到相同路径
      if (`/${recommendedSeries}` !== to.path) {
        next({ path: `/${recommendedSeries}`, replace: true })
        return
      }
    }
  }

  next()
})

// 路由后置守卫：记录用户选择（非阻塞，不影响导航性能）
router.afterEach((to, from) => {
  if (to.meta?.series) {
    // 保存当前系列偏好
    localStorage.setItem(STORAGE_KEY_SERIES, to.meta.series)
    // 如果是用户主动导航（有来源页面），记录为明确选择
    if (from.name) {
      recordUserChoice(to.meta.series)
    }
  }
})

export default router
