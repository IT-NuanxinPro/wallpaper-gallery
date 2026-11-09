import { describe, expect, it } from 'vitest'
import { mapBingWallpaperAsset, mapStandardWallpaperAsset } from '../scripts/sync-wallpaper-assets.js'
import * as assetSync from '../scripts/sync-wallpaper-assets.js'

describe('mapStandardWallpaperAsset', () => {
  it('creates a stable asset key and active asset record for standard wallpapers', () => {
    const record = mapStandardWallpaperAsset('desktop', {
      category: '动漫',
      cdnTag: 'v1.2.24',
      createdAt: '2026-03-22T14:29:36.514Z',
      description: '一位黑发少年挥舞着缠绕火焰的长剑。',
      displayTitle: '炎热中的剑术对决',
      filename: '剑客-动漫角色.png',
      format: 'PNG',
      id: 'desktop-511',
      keywords: ['动漫', '鬼灭之刃'],
      path: '/wallpaper/desktop/动漫/鬼灭之刃/%E5%89%91%E5%AE%A2.png',
      previewPath: '/preview/desktop/动漫/鬼灭之刃/%E5%89%91%E5%AE%A2.webp',
      resolution: { height: 2160, width: 3840 },
      size: 14286235,
      subcategory: '鬼灭之刃',
      tags: ['动漫', '鬼灭之刃'],
      thumbnailPath: '/thumbnail/desktop/动漫/鬼灭之刃/%E5%89%91%E5%AE%A2.webp',
    })

    expect(record.asset_key).toBe('desktop:path:/wallpaper/desktop/%E5%8A%A8%E6%BC%AB/%E9%AC%BC%E7%81%AD%E4%B9%8B%E5%88%83/%E5%89%91%E5%AE%A2.png')
    expect(record.status).toBe('active')
    expect(record.removed_at).toBeNull()
    expect(record.raw_url).toContain('nuanXinProPic@v1.2.24')
    expect(record.metadata.urls.thumbnail).toContain('/thumbnail/desktop/')
  })
})

describe('离线历史身份映射', () => {
  it('重复文件名保留两个路径，并标记历史统计无法唯一归属', () => {
    expect(typeof assetSync.buildLegacyAssetMappings).toBe('function')
    const assets = ['a', 'b'].map(category => mapStandardWallpaperAsset('desktop', {
      filename: 'same.jpg', path: `/wallpaper/desktop/${category}/same.jpg`,
    }))
    expect(assetSync.buildLegacyAssetMappings([...assets, assets[0]])).toEqual([{
      legacyKey: 'desktop:same.jpg',
      assetKeys: ['desktop:path:/wallpaper/desktop/a/same.jpg', 'desktop:path:/wallpaper/desktop/b/same.jpg'],
      ambiguous: true,
    }])
  })
})

describe('mapBingWallpaperAsset', () => {
  it('normalizes Bing filenames and produces absolute preview URLs', () => {
    const record = mapBingWallpaperAsset({
      copyright: '淡水泉中的幼年海牛',
      date: '2026-03-25',
      title: '海牛的秘密生活',
      urlbase: '/th?id=OHR.ManateeSpring_ZH-CN5252847120',
    })

    expect(record.asset_key).toBe('bing:bing-2026-03-25.jpg')
    expect(record.filename).toBe('bing-2026-03-25.jpg')
    expect(record.category).toBe('2026-03')
    expect(record.preview_path).toBe('https://cn.bing.com/th?id=OHR.ManateeSpring_ZH-CN5252847120_1920x1080.jpg')
    expect(record.raw_url).toBe('https://cn.bing.com/th?id=OHR.ManateeSpring_ZH-CN5252847120_UHD.jpg')
  })
})
