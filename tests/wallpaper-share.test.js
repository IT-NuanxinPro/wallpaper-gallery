import { describe, expect, it } from 'vitest'
import { buildWallpaperSharePath, decodeWallpaperShareToken, encodeWallpaperShareToken, getWallpaperDetailBucketPath } from '../src/utils/wallpaper/share.js'
import { buildWallpaperDetailRecord, getRelatedWallpapers, getWallpaperDetailSeo, isTrustedWallpaperDetailUrl } from '../src/utils/wallpaper/detailRecords.js'
import { buildWallpaperAssetKey } from '../src/utils/wallpaper/identity.js'

const image = { _series: 'desktop', path: '/wallpaper/desktop/风景/空 格#百分%.jpg', thumbnailPath: '/thumbnail/desktop/风景/空 格#百分%.webp', filename: '空 格#百分%.jpg', cdnTag: 'v1.2.3', displayTitle: '星空 <天空>', tags: ['星空'], resolution: { width: 3840, height: 2160 } }

describe('单图分享身份与公开记录', () => {
  it('Unicode与特殊字符往返完整资源键，跨分类和系列同名不冲突', () => {
    const path = buildWallpaperSharePath(image)
    const token = path.split('/').at(-1)
    expect(decodeWallpaperShareToken(token)).toBe(buildWallpaperAssetKey(image))
    expect(buildWallpaperSharePath({ ...image, path: image.path.replace('风景', '插画') })).not.toBe(path)
    expect(buildWallpaperSharePath({ ...image, _series: 'mobile', path: image.path.replace('desktop', 'mobile') })).not.toBe(path)
    expect(getWallpaperDetailBucketPath(token)).toMatch(/^\/data\/details\/[0-3][0-9a-f]\.json$/)
    expect(buildWallpaperSharePath({ _series: 'bing', filename: 'bing-2026-01-01.jpg' })).toMatch(/^\/wallpaper\//)
  })

  it('拒绝filename-only非Bing、无效/非规范/过长token和路径遍历', () => {
    expect(buildWallpaperSharePath({ filename: 'x.jpg', _series: 'desktop' })).toBe('')
    for (const token of ['bad+token', 'a'.repeat(4097), 'YQ', '!!!', 'abc='])
      expect(decodeWallpaperShareToken(token)).toBe('')
    expect(encodeWallpaperShareToken('desktop:path:/wallpaper/desktop/../x.jpg')).toBe('')
    expect(encodeWallpaperShareToken('desktop:path:/wallpaper/desktop/%252e%252e/x.jpg')).toBe('')
    expect(buildWallpaperSharePath({ ...image, path: `/wallpaper/desktop/${'长'.repeat(1000)}.jpg` })).toBe('')
  })

  it('记录只构建白名单来源并规范编码，保留作者信息但不推断授权', () => {
    const record = buildWallpaperDetailRecord({ ...image, url: 'javascript:alert(1)', author: '作者', license: '' }, 'v1.2.3')
    expect(record.url).toContain('https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.3/wallpaper/desktop/')
    expect(record.url).toContain('%23')
    expect(record.url).not.toContain('空 格')
    expect(record.thumbnailUrl).toMatch(/^\/images\/v1\.2\.3\/thumbnail\/desktop\//)
    expect(record.previewUrl).toBe(record.thumbnailUrl)
    expect(isTrustedWallpaperDetailUrl(record.thumbnailUrl)).toBe(true)
    expect(getWallpaperDetailSeo(record).image).toMatch(/^https:\/\/wallpaper\.061129\.xyz\/images\//)
    expect(isTrustedWallpaperDetailUrl('https://evil.test/images/v1.2.3/thumbnail/desktop/a.webp')).toBe(false)
    expect(isTrustedWallpaperDetailUrl('/images/v1.2.3/thumbnail/desktop/%252e%252e/a.webp')).toBe(false)
    expect(record.author).toBe('作者')
    expect(record.license).toBe('')
    expect(buildWallpaperDetailRecord({ ...image, thumbnailPath: 'https://evil.test/a.webp' }, 'v1.2.3').thumbnailUrl).not.toContain('evil.test')
    expect(buildWallpaperDetailRecord({ _series: 'bing', date: '2026-01-01', filename: 'bing-2026-01-01.jpg', urlbase: 'https://evil.test/x' }, 'v1.2.3')).toBeNull()
    const video = buildWallpaperDetailRecord({ ...image, _series: 'video', path: '/wallpaper/video/mobile/风景/a.mp4', thumbnailPath: '/thumbnail/video/mobile/风景/a.png', mediaType: 'video' }, 'v1.2.3')
    expect(video.url).toContain('https://img.061129.xyz/wallpaper/video/')
  })

  it('相关推荐排除当前和重复键，优先真实同标签同方向内容', () => {
    const current = buildWallpaperDetailRecord(image, 'v1.2.3')
    const relevant = { ...current, assetKey: current.assetKey.replace('%E9%A3%8E%E6%99%AF', 'nature') }
    const unrelated = { ...current, assetKey: current.assetKey.replace('%E9%A3%8E%E6%99%AF', 'portrait'), tags: [], category: '人像', resolution: { width: 1080, height: 1920 } }
    expect(getRelatedWallpapers(current, [current, relevant, relevant, unrelated]).map(item => item.assetKey)).toEqual([relevant.assetKey])
  })
})
