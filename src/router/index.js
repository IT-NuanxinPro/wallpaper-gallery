import { createRouter, createWebHistory } from 'vue-router'
import { BROWSE_ROUTE_NAMES } from '@/composables/home/browseShell'
import { canonicalizePagePath, getRouteSeo, SITE_SEO } from '@/utils/seo/routes'
import { rememberBrowseReturn } from '@/utils/wallpaper/browseReturn'
import { loadAccountView, loadLibraryView, loadPublicProfileView, preservesAccountScroll } from './accountRoutes'
import { resolveLegacyPreviewRoute } from './legacyPreviewRoute'
import { loadWallpaperDetailView } from './wallpaperDetailRoute'

const SITE_URL = 'https://wallpaper.061129.xyz'
const DEFAULT_TITLE = SITE_SEO['/'].title
const DEFAULT_DESCRIPTION = SITE_SEO['/'].description

// ========================================
// 路由配置（使用标准懒加载，骨架屏由 App.vue Suspense 处理）
// ========================================
const routes = [
  { path: '/people', redirect: '/desktop' },
  {
    path: '/people/:id',
    name: 'PublicProfile',
    component: loadPublicProfileView,
    meta: { compactMain: true, title: '公开主页 - Wallpaper Gallery', description: '浏览公开收藏、喜欢及关注关系。' },
  },
  {
    path: '/local-wallpapers',
    name: 'LocalWallpapers',
    component: () => import('@/views/LocalWallpapers.vue'),
    meta: { compactMain: true, title: '本地壁纸 - Wallpaper Gallery', description: '管理这台设备上已缓存的壁纸，查看本地图片、切换壁纸和整理存储空间。', canonicalPath: '/local-wallpapers' },
  },
  { path: '/collections/:pathMatch(.*)*', redirect: '/desktop' },
  // 首页 URL 固定，设备偏好不改变页面内容身份
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: {
      series: 'desktop',
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
      ...SITE_SEO['/desktop'],
      canonicalPath: '/desktop',
      series: 'desktop',
      aspectType: 'landscape',
    },
  },
  // 动态壁纸（横屏 16:9）
  {
    path: '/video',
    name: 'Video',
    component: () => import('@/views/Home.vue'),
    meta: {
      ...SITE_SEO['/video'],
      canonicalPath: '/video',
      series: 'video',
      aspectType: 'landscape',
    },
  },
  // 每日 Bing 壁纸（横屏 16:9）
  {
    path: '/bing',
    name: 'Bing',
    component: () => import('@/views/Home.vue'),
    meta: {
      ...SITE_SEO['/bing'],
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
      ...SITE_SEO['/mobile'],
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
      ...SITE_SEO['/avatar'],
      canonicalPath: '/avatar',
      series: 'avatar',
      aspectType: 'square',
    },
  },
  {
    path: '/wallpaper/:token',
    name: 'WallpaperDetail',
    component: loadWallpaperDetailView,
    meta: { compactMain: true, dynamicSeo: true },
  },
  // 关于页面
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/About.vue'),
    meta: {
      ...SITE_SEO['/about'],
      canonicalPath: '/about',
      hideHeader: true,
    },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: {
      title: '登录 Wallpaper Gallery - 壁纸画廊',
      description: '登录 Wallpaper Gallery，同步收藏夹、下载历史、跨设备偏好与社区身份入口。',
      canonicalPath: '/login',
      hideHeader: true,
    },
  },
  {
    path: '/signup',
    name: 'Signup',
    component: () => import('@/views/Signup.vue'),
    meta: {
      title: '注册 Wallpaper Gallery - 壁纸画廊',
      description: '注册 Wallpaper Gallery 账号，后续可同步收藏夹、下载记录、社区身份与壁纸偏好。',
      canonicalPath: '/signup',
      hideHeader: true,
    },
  },
  {
    path: '/auth/callback',
    name: 'AuthCallback',
    component: () => import('@/views/AuthCallback.vue'),
    meta: {
      title: '账号同步中 - Wallpaper Gallery',
      description: DEFAULT_DESCRIPTION,
      canonicalPath: '/auth/callback',
      hideHeader: true,
    },
  },
  {
    path: '/account',
    name: 'Account',
    component: loadAccountView,
    meta: {
      compactMain: true,
      title: '账号与安全 - Wallpaper Gallery',
      description: '管理 Wallpaper Gallery 的第三方登录绑定、邮箱密码登录和账号资料同步状态。',
      canonicalPath: '/account',
    },
  },
  {
    path: '/library',
    name: 'Library',
    component: loadLibraryView,
    meta: {
      compactMain: true,
      title: '我的壁纸库 - Wallpaper Gallery',
      description: '查看 Wallpaper Gallery 账号下的收藏夹与我的喜欢入口。',
      canonicalPath: '/library',
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
  routes: [
    {
      path: '/',
      component: () => import('@/views/BrowseLayout.vue'),
      meta: { browseShell: true },
      children: routes.filter(route => BROWSE_ROUTE_NAMES.includes(route.name)).map(route => ({
        ...route,
        path: route.path.slice(1),
        meta: { ...route.meta, compactMain: false },
      })),
    },
    ...routes.filter(route => !BROWSE_ROUTE_NAMES.includes(route.name)),
  ],
  scrollBehavior(to, from, savedPosition) {
    if (!savedPosition && preservesAccountScroll(to, from))
      return false
    // 首页列表需先补足分页后恢复位置；同页参数变化也不应重置滚动。
    if (to.meta.browseShell && (from.meta.browseShell || ['Home', 'Desktop', 'Video', 'Bing', 'Mobile', 'Avatar'].includes(to.name))) {
      return false
    }
    if (savedPosition) {
      return savedPosition
    }
    if (to.name === 'WallpaperDetail')
      return { top: 0, behavior: 'instant' }
    return { top: 0 }
  },
})

// 路由守卫配置
const STORAGE_KEY = 'wallpaper-gallery-current-series'

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
  if (to.meta.dynamicSeo)
    return
  const seo = getRouteSeo(to.path, to.meta)
  document.title = seo.title
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach(element => element.remove())
  document.head.querySelector('meta[name="robots"]')?.removeAttribute('data-detail-status')
  const tags = [
    ['name', 'robots', seo.robots],
    ['name', 'description', seo.description],
    ['property', 'og:title', seo.title],
    ['property', 'og:type', 'website'],
    ['property', 'og:description', seo.description],
    ['property', 'og:url', seo.canonical || new URL(to.path, SITE_URL).href],
    ['property', 'og:image', `${SITE_URL}/apple-touch-icon.png`],
    ['property', 'og:site_name', 'Wallpaper Gallery'],
    ['name', 'twitter:title', seo.title],
    ['name', 'twitter:description', seo.description],
    ['name', 'twitter:url', seo.canonical || new URL(to.path, SITE_URL).href],
    ['name', 'twitter:image', `${SITE_URL}/apple-touch-icon.png`],
  ]
  for (const [attribute, key, content] of tags)
    updateMetaTag(`meta[${attribute}="${key}"]`, { [attribute]: key, content })
  if (seo.canonical)
    updateLinkTag('link[rel="canonical"]', { rel: 'canonical', href: seo.canonical })
  else
    document.head.querySelector('link[rel="canonical"]')?.remove()
  if (seo.structuredData) {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(seo.structuredData)
    document.head.appendChild(script)
  }
}

// 路由守卫
router.beforeEach((to, from, next) => {
  if (to.path === '/auth/callback') {
    next()
    return
  }

  const canonicalPath = canonicalizePagePath(to.path)
  if (to.path !== canonicalPath) {
    next({ path: canonicalPath, query: to.query, hash: to.hash, replace: true })
    return
  }

  const legacyPreview = resolveLegacyPreviewRoute(to)
  if (legacyPreview) {
    if (legacyPreview.returnTo)
      rememberBrowseReturn(router.resolve(legacyPreview.returnTo).fullPath)
    next(legacyPreview.location)
    return
  }

  next()
})

// 记录用户选择
router.afterEach((to) => {
  applyRouteSeo(to)

  if (to.meta?.series) {
    try {
      localStorage.setItem(STORAGE_KEY, to.meta.series)
    }
    catch { /* 隐私模式仍可直接访问分类。 */ }
  }
})

export default router
