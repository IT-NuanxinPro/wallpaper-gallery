import { createRouter, createWebHistory } from 'vue-router'
import { isMobileDevice } from '@/composables/useDevice'
import { DEVICE_SERIES } from '@/utils/constants'

const SITE_NAME = 'Wallpaper Gallery'
const SITE_URL = 'https://wallpaper.061129.xyz'
const DEFAULT_TITLE = '4K高清壁纸下载_电脑桌面壁纸_手机壁纸 - Wallpaper Gallery'
const DEFAULT_DESCRIPTION = 'Wallpaper Gallery 提供 4K 高清壁纸免费下载，涵盖电脑桌面壁纸、手机壁纸、动漫头像和每日 Bing 壁纸等分类，适配 Windows、Mac、iPhone 和 Android 设备，支持高清预览。'

// ========================================
// 路由配置（使用标准懒加载，骨架屏由 App.vue Suspense 处理）
// ========================================
const routes = [
  // 首页 - 根据设备类型自动选择系列
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      canonicalPath: '/',
    },
  },
  // 电脑壁纸（横屏 16:10）
  {
    path: '/desktop',
    name: 'Desktop',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: '4K电脑桌面壁纸_高清电脑背景图片下载 - Wallpaper Gallery',
      description: '精选 4K 电脑桌面壁纸免费下载，涵盖风景、动漫、游戏、人像等高清电脑背景图片，适配 Windows 和 Mac 大屏显示器。',
      canonicalPath: '/desktop',
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
      title: 'Bing每日壁纸_必应高清壁纸下载 - Wallpaper Gallery',
      description: '汇集每日 Bing 高清壁纸，提供必应精选图片大图预览与下载，适合电脑桌面和宽屏设备使用。',
      canonicalPath: '/bing',
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
      title: '4K手机壁纸_高清手机锁屏壁纸下载 - Wallpaper Gallery',
      description: '提供海量 4K 手机壁纸和高清锁屏壁纸，适配 iPhone 与 Android 机型，支持竖屏预览与免费下载。',
      canonicalPath: '/mobile',
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
      title: '高清头像_动漫头像_个性头像下载 - Wallpaper Gallery',
      description: '精选高清头像、动漫头像和个性头像资源，适合微信、QQ、社交平台使用，支持正方形头像预览与下载。',
      canonicalPath: '/avatar',
      series: 'avatar',
      aspectType: 'square',
    },
  },
  // 关于页面
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/About.vue'),
    meta: {
      title: '关于 Wallpaper Gallery - 4K 高清壁纸站',
      description: '了解 Wallpaper Gallery 的项目定位、特色功能与壁纸资源分类，查看更多关于 4K 高清壁纸站的信息。',
      canonicalPath: '/about',
    },
  },
  // iPhone 真机预览 Demo
  {
    path: '/iphone-demo',
    name: 'IPhoneDemo',
    component: () => import('@/views/demo/IPhoneDemo.vue'),
    meta: {
      title: 'iPhone 真机预览 Demo',
      description: DEFAULT_DESCRIPTION,
      canonicalPath: '/iphone-demo',
      hideHeader: true,
    },
  },
  // MacBook 真机预览 Demo
  {
    path: '/macbook-demo',
    name: 'MacBookDemo',
    component: () => import('@/views/demo/MacBookDemo.vue'),
    meta: {
      title: 'MacBook Pro 真机预览 Demo',
      description: DEFAULT_DESCRIPTION,
      canonicalPath: '/macbook-demo',
      hideHeader: true,
    },
  },
  // 404 重定向到首页
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: {
      title: '页面未找到 - Wallpaper Gallery',
      description: DEFAULT_DESCRIPTION,
      canonicalPath: '/',
      hideHeader: true,
    },
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

function updateMetaTag(selector, attributes) {
  let element = document.head.querySelector(selector)

  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value)
  })
}

function updateLinkTag(selector, attributes) {
  let element = document.head.querySelector(selector)

  if (!element) {
    element = document.createElement('link')
    document.head.appendChild(element)
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value)
  })
}

function applyRouteSeo(to) {
  const title = to.meta.title || DEFAULT_TITLE
  const description = to.meta.description || DEFAULT_DESCRIPTION
  const canonicalPath = to.meta.canonicalPath || to.path || '/'
  const url = new URL(canonicalPath, SITE_URL).toString()

  document.title = title

  updateMetaTag('meta[name="description"]', {
    name: 'description',
    content: description,
  })

  updateMetaTag('meta[property="og:title"]', {
    property: 'og:title',
    content: title,
  })

  updateMetaTag('meta[property="og:description"]', {
    property: 'og:description',
    content: description,
  })

  updateMetaTag('meta[property="og:url"]', {
    property: 'og:url',
    content: url,
  })

  updateMetaTag('meta[property="og:site_name"]', {
    property: 'og:site_name',
    content: SITE_NAME,
  })

  updateMetaTag('meta[name="twitter:title"]', {
    name: 'twitter:title',
    content: title,
  })

  updateMetaTag('meta[name="twitter:description"]', {
    name: 'twitter:description',
    content: description,
  })

  updateMetaTag('meta[name="twitter:url"]', {
    name: 'twitter:url',
    content: url,
  })

  updateLinkTag('link[rel="canonical"]', {
    rel: 'canonical',
    href: url,
  })
}

// 路由守卫
router.beforeEach((to, from, next) => {
  // 首页重定向到默认系列
  if (to.path === '/') {
    next({ path: `/${getDefaultSeries()}`, replace: true })
    return
  }

  next()
})

// 记录用户选择
router.afterEach((to) => {
  applyRouteSeo(to)

  if (to.meta?.series) {
    localStorage.setItem(STORAGE_KEY, to.meta.series)
  }
})

export default router
