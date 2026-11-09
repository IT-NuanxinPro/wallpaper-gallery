import { describe, expect, it } from 'vitest'
import { buildImageUrl, buildRawImageUrl, buildWallpaperImageFallbackUrls } from '../src/utils/common/format.js'
import { transformWallpaperUrls } from '../src/utils/wallpaper/transformers.js'

describe('壁纸资源路径编码', () => {
  it.each([
    {
      name: '未编码的井号、空格和中文属于文件名',
      path: '/thumbnail/desktop/动漫/01_#wallpaper 美图.webp',
      expectedPath: '/thumbnail/desktop/%E5%8A%A8%E6%BC%AB/01_%23wallpaper%20%E7%BE%8E%E5%9B%BE.webp',
    },
    {
      name: '已编码的路径不重复编码',
      path: '/wallpaper/desktop/%E5%8A%A8%E6%BC%AB/01_%23wallpaper%20%E7%BE%8E%E5%9B%BE.webp',
      expectedPath: '/wallpaper/desktop/%E5%8A%A8%E6%BC%AB/01_%23wallpaper%20%E7%BE%8E%E5%9B%BE.webp',
    },
    {
      name: '混合编码和裸百分号仍定位同一个文件',
      path: '/preview/动漫/100%_%23wallpaper 美图.webp',
      expectedPath: '/preview/%E5%8A%A8%E6%BC%AB/100%25_%23wallpaper%20%E7%BE%8E%E5%9B%BE.webp',
    },
    {
      name: '保留已编码的斜杠和百分号而不改变路径层级',
      path: '/thumbnail/a%2Fb%2fc%2523 #.webp',
      expectedPath: '/thumbnail/a%2Fb%2fc%2523%20%23.webp',
    },
    {
      name: '文件名中的问号不创建查询参数',
      path: '/thumbnail/what?size=large.webp',
      expectedPath: '/thumbnail/what%3Fsize%3Dlarge.webp',
    },
  ])('$name', ({ path, expectedPath }) => {
    const url = new URL(buildImageUrl(path, 'v1.2.63'), 'https://gallery.example.com')

    const prefix = path.startsWith('/thumbnail/desktop/')
      ? '/images/v1.2.63'
      : '/gh/IT-NuanxinPro/nuanXinProPic@v1.2.63'
    expect(url.pathname).toBe(`${prefix}${expectedPath}`)
    expect(url.hash).toBe('')
    expect(url.search).toBe('')
  })

  it('元数据转换后缩略图和预览图的 CDN 与 Raw 回退都保留完整文件名', () => {
    const wallpaper = transformWallpaperUrls({
      cdnTag: 'v1.2.63',
      filename: '01_#wallpaper 美图.png',
      format: 'PNG',
      path: '/wallpaper/desktop/动漫/01_%23wallpaper%20%E7%BE%8E%E5%9B%BE.png',
      thumbnailPath: '/thumbnail/desktop/动漫/01_#wallpaper 美图.webp',
      previewPath: '/preview/desktop/动漫/01_#wallpaper 美图.webp',
    })
    const urls = buildWallpaperImageFallbackUrls(wallpaper, { preferThumbnail: true })

    expect(urls).toEqual([
      '/images/v1.2.63/thumbnail/desktop/%E5%8A%A8%E6%BC%AB/01_%23wallpaper%20%E7%BE%8E%E5%9B%BE.webp',
      'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.63/thumbnail/desktop/%E5%8A%A8%E6%BC%AB/01_%23wallpaper%20%E7%BE%8E%E5%9B%BE.webp',
      'https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v1.2.63/thumbnail/desktop/%E5%8A%A8%E6%BC%AB/01_%23wallpaper%20%E7%BE%8E%E5%9B%BE.webp',
      '/images/v1.2.63/preview/desktop/%E5%8A%A8%E6%BC%AB/01_%23wallpaper%20%E7%BE%8E%E5%9B%BE.webp',
      'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.63/preview/desktop/%E5%8A%A8%E6%BC%AB/01_%23wallpaper%20%E7%BE%8E%E5%9B%BE.webp',
      'https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v1.2.63/preview/desktop/%E5%8A%A8%E6%BC%AB/01_%23wallpaper%20%E7%BE%8E%E5%9B%BE.webp',
      'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.63/wallpaper/desktop/%E5%8A%A8%E6%BC%AB/01_%23wallpaper%20%E7%BE%8E%E5%9B%BE.png',
      'https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v1.2.63/wallpaper/desktop/%E5%8A%A8%E6%BC%AB/01_%23wallpaper%20%E7%BE%8E%E5%9B%BE.png',
    ])
    expect(wallpaper.downloadUrl).toBe(wallpaper.url)
  })

  it('其他来源的完整 URL 不触发 Raw 改写', () => {
    const url = 'https://cn.bing.com/th?id=OHR.Sample_UHD.jpg'
    expect(buildRawImageUrl(url)).toBe(url)
  })
})
