import { WALLPAPER_SITE_ORIGIN } from '../wallpaper/share.js'

export const SITE_SEO = {
  '/': { label: '壁纸图库', title: '高清壁纸图库：电脑桌面、手机壁纸与头像 | Wallpaper Gallery', description: '浏览风景、动漫、插画等电脑桌面壁纸、手机壁纸和头像，查看图片尺寸、高清预览与下载，也可探索每日 Bing 壁纸。' },
  '/desktop': { label: '电脑桌面壁纸', title: '电脑桌面壁纸：风景、动漫与插画背景 | Wallpaper Gallery', description: '挑选风景、动漫、游戏与插画等电脑桌面背景。按分类、格式和分辨率查找壁纸，进入详情查看实际尺寸、预览与下载。' },
  '/mobile': { label: '手机壁纸', title: '手机壁纸：竖屏风景、动漫与人像 | Wallpaper Gallery', description: '浏览适合手机屏幕的风景、动漫、插画与人像壁纸，查看图片尺寸和竖屏预览，选择适合锁屏或主屏幕的背景。' },
  '/avatar': { label: '高清头像', title: '高清头像：动漫人物、插画与个性头像 | Wallpaper Gallery', description: '发现动漫、插画、人像和动物头像，按主题浏览图片，查看清晰预览、实际尺寸与下载文件。' },
  '/bing': { label: 'Bing 每日壁纸', title: 'Bing 每日壁纸：世界风景与自然摄影 | Wallpaper Gallery', description: '按日期浏览 Bing 每日壁纸，阅读原始图片说明与来源信息，探索世界风景、建筑、动物和自然摄影。' },
  '/video': { label: '动态壁纸', title: '电脑动态壁纸：动漫、风景与视频背景 | Wallpaper Gallery', description: '浏览电脑动态壁纸，挑选动漫、风景与视频桌面背景，进入详情观看动态效果、查看文件信息并下载视频。' },
  '/about': { label: '关于本站', title: '关于壁纸图库与使用说明 | Wallpaper Gallery', description: '了解 Wallpaper Gallery 的壁纸分类、预览、下载及桌面客户端功能，以及图片来源和使用说明。' },
}

export const PUBLIC_SITE_PATHS = Object.keys(SITE_SEO)

export function canonicalizePagePath(path) {
  return path === '/' ? '/' : path.replace(/\/+$/, '')
}

export function getRouteSeo(path, meta = {}) {
  const canonicalPath = canonicalizePagePath(path)
  const page = SITE_SEO[canonicalPath]
  const canonical = page ? `${WALLPAPER_SITE_ORIGIN}${canonicalPath}` : null
  const title = page?.title || meta.title || '页面不存在 | Wallpaper Gallery'
  const description = page?.description || meta.description || '返回壁纸图库，继续浏览电脑壁纸、手机壁纸与头像。'
  const breadcrumbs = page && canonicalPath !== '/'
    ? [
        { '@type': 'ListItem', 'position': 1, 'name': '首页', 'item': `${WALLPAPER_SITE_ORIGIN}/` },
      ]
    : []
  if (page)
    breadcrumbs.push({ '@type': 'ListItem', 'position': breadcrumbs.length + 1, 'name': page.label, 'item': canonical })
  return {
    title,
    description,
    canonical,
    robots: page ? 'index, follow, max-image-preview:large' : 'noindex, follow',
    structuredData: page
      ? {
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'WebSite', '@id': `${WALLPAPER_SITE_ORIGIN}/#website`, 'name': 'Wallpaper Gallery', 'url': `${WALLPAPER_SITE_ORIGIN}/`, 'inLanguage': 'zh-CN' },
            { '@type': canonicalPath === '/about' ? 'AboutPage' : 'CollectionPage', '@id': `${canonical}#page`, 'name': title, description, 'url': canonical, 'inLanguage': 'zh-CN', 'isPartOf': { '@id': `${WALLPAPER_SITE_ORIGIN}/#website` } },
            { '@type': 'BreadcrumbList', 'itemListElement': breadcrumbs },
          ],
        }
      : null,
  }
}
