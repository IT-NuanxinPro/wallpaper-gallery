import { describe, expect, it } from 'vitest'
import { canonicalizePagePath, getRouteSeo, PUBLIC_SITE_PATHS } from '../src/utils/seo/routes.js'

describe('公共页面 SEO 身份', () => {
  it('首页与分类页有各自稳定规范地址，去除尾斜杠', () => {
    expect(canonicalizePagePath('/')).toBe('/')
    expect(getRouteSeo('/').canonical).toBe('https://wallpaper.061129.xyz/')
    expect(getRouteSeo('/desktop/').canonical).toBe('https://wallpaper.061129.xyz/desktop')
    const pages = PUBLIC_SITE_PATHS.map(getRouteSeo)
    expect(new Set(pages.map(page => page.title)).size).toBe(pages.length)
    expect(pages.every(page => page.robots.startsWith('index') && page.description)).toBe(true)
  })
  it('移除精选专题后不再向站点地图及SEO暴露旧页面', () => {
    expect(PUBLIC_SITE_PATHS.some(path => path.startsWith('/collections'))).toBe(false)
    expect(getRouteSeo('/collections/quiet-night')).toMatchObject({ robots: 'noindex, follow', canonical: null, structuredData: null })
    expect(getRouteSeo('/desktop').structuredData['@graph'].at(-1).itemListElement).toHaveLength(2)
  })
  it('账号、设备本地图库和不存在页面不生成可收录规范网址', () => {
    for (const path of ['/login', '/account', '/library', '/local-wallpapers', '/missing']) {
      expect(getRouteSeo(path)).toMatchObject({ robots: 'noindex, follow', canonical: null, structuredData: null })
    }
  })
})
