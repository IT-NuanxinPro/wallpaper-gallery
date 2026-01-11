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
  // 每日 Bing 壁纸（横屏 16:9）
  {
    path: '/bing',
    name: 'Bing',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: '每日 Bing 壁纸 - Wallpaper Gallery',
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
  // iPhone 真机预览 Demo
  {
    path: '/iphone-demo',
    name: 'IPhoneDemo',
    component: () => import('@/views/demo/IPhoneDemo.vue'),
    meta: { title: 'iPhone 真机预览 Demo', hideHeader: true },
  },
  // MacBook 真机预览 Demo
  {
    path: '/macbook-demo',
    name: 'MacBookDemo',
    component: () => import('@/views/demo/MacBookDemo.vue'),
    meta: { title: 'MacBook Pro 真机预览 Demo', hideHeader: true },
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
// 路由守卫配置（简化版）
// ========================================

const STORAGE_KEY = 'wallpaper-gallery-current-series'

// 缓存设备类型
let deviceType = null
function getDeviceType() {
  if (!deviceType)
    deviceType = isMobileDevice() ? 'mobile' : 'desktop'
  return deviceType
}

// 获取默认系列
function getDefaultSeries() {
  const device = getDeviceType()
  const available = DEVICE_SERIES[device]
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && available.includes(saved))
    return saved
  return device === 'mobile' ? 'mobile' : 'desktop'
}

// 路由守卫
router.beforeEach((to, from, next) => {
  if (to.meta.title)
    document.title = to.meta.title

  // 首页重定向到默认系列
  if (to.path === '/') {
    next({ path: `/${getDefaultSeries()}`, replace: true })
    return
  }

  // 检查系列是否对当前设备可用（如手机访问 /bing）
  if (to.meta?.series) {
    const available = DEVICE_SERIES[getDeviceType()]
    if (!available.includes(to.meta.series)) {
      next({ path: `/${getDefaultSeries()}`, replace: true })
      return
    }
  }

  next()
})

// 记录用户选择
router.afterEach((to) => {
  if (to.meta?.series)
    localStorage.setItem(STORAGE_KEY, to.meta.series)
})

export default router
