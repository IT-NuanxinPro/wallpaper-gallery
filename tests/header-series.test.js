import { describe, expect, it } from 'vitest'
import { getActiveWallpaperSeries } from '../src/utils/wallpaper/activeSeries.js'
import { encodeWallpaperShareToken } from '../src/utils/wallpaper/share.js'

describe('详情与列表导航高亮', () => {
  it.each(['desktop', 'mobile', 'avatar', 'bing', 'video'])('直达%s详情从分享身份高亮，不依赖之前列表', (series) => {
    const key = series === 'bing' ? 'bing:bing-2026-11-10.jpg' : `${series}:path:/wallpaper/${series}/test.${series === 'video' ? 'mp4' : 'jpg'}`
    const token = encodeWallpaperShareToken(key)
    expect(token).toBeTruthy()
    expect(getActiveWallpaperSeries({ name: 'WallpaperDetail', path: `/wallpaper/${token}`, params: { token } }, 'desktop')).toBe(series)
    expect(getActiveWallpaperSeries({ path: `/${series}` })).toBe(series)
  })
  it('个人设置和无效详情不错误高亮电脑系列', () => {
    expect(getActiveWallpaperSeries({ path: '/account' })).toBe('')
    expect(getActiveWallpaperSeries({ path: '/wallpaper/bad!' })).toBe('')
    expect(getActiveWallpaperSeries({ path: '/' }, 'mobile')).toBe('mobile')
  })
})
