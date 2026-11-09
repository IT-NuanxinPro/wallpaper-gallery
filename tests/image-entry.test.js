import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildImageUrl, buildRawImageUrl, buildWallpaperImageFallbackUrls } from '../src/utils/common/format.js'
import { CDN_VERSION } from '../src/utils/config/constants.js'
import { transformBingWallpaper, transformWallpaperUrls } from '../src/utils/wallpaper/transformers.js'

const CDN = 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.63'
const RAW = 'https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v1.2.63'

beforeEach(() => {
  vi.stubEnv('VITE_IMAGE_BASE_URL', '')
  vi.stubEnv('VITE_IMAGE_PROXY_ENABLED', '')
})

afterEach(() => vi.unstubAllEnvs())

describe('自有图片入口', () => {
  it.each(['desktop', 'mobile', 'avatar'])('默认将 %s 的缩略图和预览图交给本站入口', (series) => {
    expect(buildImageUrl(`/thumbnail/${series}/sample.webp`, 'v1.2.63'))
      .toBe(`/images/v1.2.63/thumbnail/${series}/sample.webp`)
    expect(buildImageUrl(`/preview/${series}/sample.webp`))
      .toBe(`/images/${CDN_VERSION}/preview/${series}/sample.webp`)
  })

  it.each([
    ['https://images.example.com/images', 'https://images.example.com/images/v1.2.63/thumbnail/desktop/sample.webp'],
    ['https://images.example.com/images/', 'https://images.example.com/images/v1.2.63/thumbnail/desktop/sample.webp'],
    ['/images/', '/images/v1.2.63/thumbnail/desktop/sample.webp'],
  ])('使用配置的图片入口 %s', (base, expected) => {
    vi.stubEnv('VITE_IMAGE_BASE_URL', base)
    expect(buildImageUrl('/thumbnail/desktop/sample.webp', 'v1.2.63')).toBe(expected)
  })

  it.each([
    'http://images.example.com',
    '//images.example.com',
    'https://user:secret@images.example.com',
    'javascript:alert(1)',
    'data:text/plain,test',
    'images.example.com',
    '/images?remote=other',
    'https://images.example.com/#fragment',
    '/\\images.example.com',
    'https://images.example.com',
    'https://images.example.com/',
    'https://images.example.com/media/images',
    '/media/images',
    '/custom',
    '/',
  ])('不采用不安全或不匹配网关路径的入口配置 %s', (base) => {
    vi.stubEnv('VITE_IMAGE_BASE_URL', base)
    expect(buildImageUrl('/thumbnail/desktop/sample.webp', 'v1.2.63'))
      .toBe('/images/v1.2.63/thumbnail/desktop/sample.webp')
  })

  it('显式关闭代理后可以只通过 jsDelivr 与 Raw 加载', () => {
    vi.stubEnv('VITE_IMAGE_PROXY_ENABLED', 'false')
    const wallpaper = transformWallpaperUrls({
      cdnTag: 'v1.2.63',
      thumbnailPath: '/thumbnail/desktop/sample.webp',
      path: '/wallpaper/desktop/sample.png',
    })
    expect(wallpaper.thumbnailUrl).toBe(`${CDN}/thumbnail/desktop/sample.webp`)
    expect(buildWallpaperImageFallbackUrls(wallpaper, { preferThumbnail: true })).toEqual([
      `${CDN}/thumbnail/desktop/sample.webp`,
      `${RAW}/thumbnail/desktop/sample.webp`,
      `${CDN}/wallpaper/desktop/sample.png`,
      `${RAW}/wallpaper/desktop/sample.png`,
    ])
  })

  it.each(['main', 'v1.2.63-rc_1', 'v1.2.63-', `v1.2.63-${'a'.repeat(101)}`])('不受网关支持的版本 %s 继续直连', (tag) => {
    expect(buildImageUrl('/thumbnail/desktop/sample.webp', tag))
      .toBe(`https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@${tag}/thumbnail/desktop/sample.webp`)
  })

  it('发布候选和构建版本可以进入代理且回退保留版本', () => {
    const url = buildImageUrl('/preview/desktop/sample.webp', 'v1.2.63-rc.1+build.2')
    expect(url).toBe('/images/v1.2.63-rc.1+build.2/preview/desktop/sample.webp')
    expect(buildRawImageUrl(url))
      .toBe('https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v1.2.63-rc.1+build.2/preview/desktop/sample.webp')
  })

  it.each([
    '/wallpaper/desktop/sample.png',
    '/thumbnail/desktop/sample.svg',
    '/thumbnail/desktop/sample.mp4',
    '/thumbnail/video/sample.webp',
    '/preview/bing/sample.jpg',
    '/unknown/desktop/sample.webp',
    '/thumbnail/desktop/nested%2Fsample.webp',
    '/thumbnail/desktop/nested%255Csample.webp',
    '/thumbnail/desktop/name%3Avalue.webp',
    '/thumbnail/desktop/control%2500.webp',
    '/thumbnail/desktop/%25FF%25252fb.webp',
    '/thumbnail/desktop/100%25_%252fb.webp',
    '/thumbnail/desktop/%2e%2e/sample.webp',
    '/thumbnail/desktop/%252e%252e/sample.webp',
  ])('原图或不属于代理范围的资源继续直连：%s', (path) => {
    expect(buildImageUrl(path, 'v1.2.63')).toBe(`${CDN}${path}`)
  })

  it('混合编码和字面百分号的合法路径可由入口处理', () => {
    expect(buildImageUrl('/preview/desktop/中文/100%_%2523_#wallpaper?.webp', 'v1.2.63'))
      .toBe('/images/v1.2.63/preview/desktop/%E4%B8%AD%E6%96%87/100%25_%2523_%23wallpaper%3F.webp')
  })

  it('只有完整 URL 的旧元数据保留来源', () => {
    const wallpaper = transformWallpaperUrls({
      url: 'https://legacy.example.com/full.png',
      thumbnailUrl: 'https://legacy.example.com/thumb.webp',
      previewUrl: 'https://legacy.example.com/preview.webp',
    })
    expect(wallpaper.url).toBe('https://legacy.example.com/full.png')
    expect(wallpaper.thumbnailUrl).toBe('https://legacy.example.com/thumb.webp')
    expect(wallpaper.previewUrl).toBe('https://legacy.example.com/preview.webp')
  })

  it('Bing 与动态壁纸仍使用原来的独立来源', () => {
    const bing = transformBingWallpaper({ date: '2026-11-09', urlbase: '/th?id=OHR.Sample' })
    expect(bing.thumbnailUrl).toBe('https://cn.bing.com/th?id=OHR.Sample_400x240.jpg')
    expect(bing.previewUrl).toBe('https://cn.bing.com/th?id=OHR.Sample_1920x1080.jpg')
    const video = transformWallpaperUrls({
      mediaType: 'video',
      path: '/wallpaper/video/sample.mp4',
      thumbnailPath: '/thumbnail/video/sample.webp',
      previewPath: '/preview/video/sample.mp4',
    })
    expect(video.url).toBe('https://img.061129.xyz/wallpaper/video/sample.mp4')
    expect(video.thumbnailUrl).toBe('https://img.061129.xyz/thumbnail/video/sample.webp')
    expect(buildWallpaperImageFallbackUrls(video)).toEqual(['https://img.061129.xyz/thumbnail/video/sample.webp'])
  })
})

describe('图片入口失败回退', () => {
  it('同尺寸 jsDelivr 和 Raw 都失败后，才升级到预览与原图', () => {
    const wallpaper = transformWallpaperUrls({
      cdnTag: 'v1.2.63',
      thumbnailPath: '/thumbnail/mobile/sample.webp',
      previewPath: '/preview/mobile/sample.webp',
      path: '/wallpaper/mobile/sample.png',
    })
    expect(buildWallpaperImageFallbackUrls(wallpaper, { preferThumbnail: true })).toEqual([
      '/images/v1.2.63/thumbnail/mobile/sample.webp',
      `${CDN}/thumbnail/mobile/sample.webp`,
      `${RAW}/thumbnail/mobile/sample.webp`,
      '/images/v1.2.63/preview/mobile/sample.webp',
      `${CDN}/preview/mobile/sample.webp`,
      `${RAW}/preview/mobile/sample.webp`,
      `${CDN}/wallpaper/mobile/sample.png`,
      `${RAW}/wallpaper/mobile/sample.png`,
    ])
    expect(wallpaper.downloadUrl).toBe(`${CDN}/wallpaper/mobile/sample.png`)
  })

  it('配置域名下的预览失败仍先尝试同尺寸直连', () => {
    vi.stubEnv('VITE_IMAGE_BASE_URL', 'https://images.example.com/images')
    const wallpaper = transformWallpaperUrls({
      cdnTag: 'v1.2.63',
      previewPath: '/preview/desktop/sample.webp',
      path: '/wallpaper/desktop/sample.png',
    })
    expect(buildWallpaperImageFallbackUrls(wallpaper)).toEqual([
      'https://images.example.com/images/v1.2.63/preview/desktop/sample.webp',
      `${CDN}/preview/desktop/sample.webp`,
      `${RAW}/preview/desktop/sample.webp`,
      `${CDN}/wallpaper/desktop/sample.png`,
      `${RAW}/wallpaper/desktop/sample.png`,
    ])
  })

  it('Raw 转换兼容自有入口，原图下载转换保持不变', () => {
    expect(buildRawImageUrl('/images/v1.2.63/thumbnail/avatar/sample.webp'))
      .toBe(`${RAW}/thumbnail/avatar/sample.webp`)
    expect(buildRawImageUrl(`${CDN}/wallpaper/desktop/sample.png`))
      .toBe(`${RAW}/wallpaper/desktop/sample.png`)
    expect(buildRawImageUrl('https://other.example.com/images/v1.2.63/thumbnail/avatar/sample.webp'))
      .toBe('https://other.example.com/images/v1.2.63/thumbnail/avatar/sample.webp')
  })
})
