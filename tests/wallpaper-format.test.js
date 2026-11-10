import { describe, expect, it, vi } from 'vitest'
import { buildWallpaperDownloadFilename, buildWallpaperImageFallbackUrls, formatRelativeTime } from '../src/utils/common/format.js'

it('缺失或无效上传时间不显示刚刚，兼容图床时间格式', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-10T10:00:00Z'))
  try {
    for (const value of [undefined, null, '', 'not-a-date'])
      expect(formatRelativeTime(value)).toBe('')
    expect(formatRelativeTime('2026-07-01 17:22:14')).toBe('4 个月前')
  }
  finally { vi.useRealTimers() }
})

describe('buildWallpaperDownloadFilename', () => {
  it('prefers metadata titles over generic upload filenames', () => {
    const filename = buildWallpaperDownloadFilename({
      category: '人像',
      displayTitle: '阳光下的甜美少女',
      filename: '663.webp',
      format: 'WEBP',
      subcategory: '甜妹',
    })

    expect(filename).toBe('阳光下的甜美少女.webp')
  })

  it('falls back to Bing title and appends the date for uniqueness', () => {
    const filename = buildWallpaperDownloadFilename({
      date: '2026-03-25',
      filename: 'bing-2026-03-25.jpg',
      isBing: true,
      title: '海牛的秘密生活',
    })

    expect(filename).toBe('海牛的秘密生活-2026-03-25.jpg')
  })
})

describe('buildWallpaperImageFallbackUrls', () => {
  it('tries avatar webp originals before the matching Raw fallback', () => {
    const urls = buildWallpaperImageFallbackUrls({
      filename: '663.webp',
      format: 'WEBP',
      path: '/wallpaper/avatar/人像/甜妹/663.webp',
      thumbnailPath: '/thumbnail/avatar/人像/甜妹/663.webp',
      thumbnailUrl: 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.1.96/thumbnail/avatar/人像/甜妹/663.webp',
      url: 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.1.96/wallpaper/avatar/人像/甜妹/663.webp',
    })

    expect(urls[0]).toContain('/wallpaper/avatar/')
    expect(urls.at(-1)).toBe('https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v1.1.96/wallpaper/avatar/人像/甜妹/663.webp')
  })

  it('falls back from preview thumbnails to original assets for standard wallpapers', () => {
    const urls = buildWallpaperImageFallbackUrls({
      filename: 'wallpaper.png',
      format: 'PNG',
      previewUrl: 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.8/preview/desktop/动漫/demo.webp',
      thumbnailUrl: 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.8/thumbnail/desktop/动漫/demo.webp',
      url: 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.8/wallpaper/desktop/动漫/demo.png',
    })

    expect(urls).toContain('https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.8/wallpaper/desktop/动漫/demo.png')
    expect(urls.at(-1)).toBe('https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v1.2.8/wallpaper/desktop/动漫/demo.png')
  })
})
