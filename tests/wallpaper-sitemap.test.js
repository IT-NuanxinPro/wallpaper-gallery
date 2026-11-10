import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { generateWallpaperDetails } from '../scripts/generate-wallpaper-details.js'
import { buildWallpaperSitemap, getWallpaperLastmod } from '../scripts/lib/wallpaperSitemap.js'
import { buildWallpaperDetailRecord } from '../src/utils/wallpaper/detailRecords.js'

const roots = []
afterEach(async () => { for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true }) })

it('从有效详情动态生成单一sitemap，保留真实日期、同源预览和全部系列', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wallpaper-sitemap-'))
  roots.push(root)
  const dataDir = path.join(root, 'data')
  await fs.mkdir(dataDir)
  const desktop = { path: '/wallpaper/desktop/山景.jpg', title: '山景', date: '2026-02-30', createdAt: '2026-09-01T08:00:00Z', previewPath: '/preview/desktop/山景.webp' }
  await fs.writeFile(path.join(dataDir, 'desktop.json'), JSON.stringify([desktop, desktop, { path: '/wallpaper/desktop/无日期.jpg' }, { path: '/wallpaper/desktop/../invalid.jpg' }]))
  await fs.writeFile(path.join(dataDir, 'video.json'), JSON.stringify([{ path: '/wallpaper/video/动态.mp4', title: '动态' }]))
  const output = await generateWallpaperDetails({ dataDir, sitemapPath: path.join(root, 'sitemap.xml'), defaultCdnTag: 'v1.2.3' })
  expect(output.generated).toBe(3)
  expect(output.skipped).toBe(1)
  const xml = await fs.readFile(path.join(root, 'sitemap.xml'), 'utf8')
  expect(xml).toContain('<urlset ')
  expect(xml).not.toContain('<sitemapindex')
  expect(xml).toContain('<loc>https://wallpaper.061129.xyz/</loc>')
  expect(xml).toContain('<loc>https://wallpaper.061129.xyz/video</loc>')
  expect(xml).toContain('/collections/quiet-night</loc>')
  expect(xml.match(/<lastmod>/g)).toHaveLength(1)
  expect(xml).toContain('<lastmod>2026-09-01</lastmod>')
  expect(xml).toContain('https://wallpaper.061129.xyz/images/v1.2.3/preview/desktop/')
  expect(xml).not.toContain('2026-02-30')
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1])
  expect(new Set(urls).size).toBe(urls.length)
  expect(urls.filter(url => url.includes('/wallpaper/'))).toHaveLength(output.generated)
})

it('元数据解析失败时保留既有详情与sitemap，不发布部分数据', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wallpaper-sitemap-failure-'))
  roots.push(root)
  const dataDir = path.join(root, 'data')
  await fs.mkdir(dataDir)
  await fs.writeFile(path.join(dataDir, 'desktop.json'), JSON.stringify([{ path: '/wallpaper/desktop/a.jpg' }]))
  await generateWallpaperDetails({ dataDir, sitemapPath: path.join(root, 'sitemap.xml'), defaultCdnTag: 'v1.2.3' })
  const before = await fs.readFile(path.join(root, 'sitemap.xml'), 'utf8')
  const index = await fs.readFile(path.join(dataDir, 'details/index.json'), 'utf8')
  await fs.writeFile(path.join(dataDir, 'desktop.json'), '{invalid-json')
  await expect(generateWallpaperDetails({ dataDir, sitemapPath: path.join(root, 'sitemap.xml'), defaultCdnTag: 'v1.2.3' })).rejects.toThrow()
  expect(await fs.readFile(path.join(root, 'sitemap.xml'), 'utf8')).toBe(before)
  expect(await fs.readFile(path.join(dataDir, 'details/index.json'), 'utf8')).toBe(index)
})

it('站点地图拒绝损坏身份和非支持来源，Bing图片使用官方地址', () => {
  const item = buildWallpaperDetailRecord({ _series: 'bing', filename: 'bing-2026-11-01.jpg', date: '2026-11-01', urlbase: '/th?id=OHR.Mountain_ZH-CN1234' }, 'v1.2.3')
  const { xml, details } = buildWallpaperSitemap([item, item], { publicPaths: ['/', '/bing', '/bing'] })
  expect(details).toBe(1)
  expect(xml.match(/<url>/g)).toHaveLength(3)
  expect(xml).toContain('https://www.bing.com/th?id=OHR.Mountain_ZH-CN1234_1920x1080.jpg')
  expect(() => buildWallpaperSitemap([{ ...item, sharePath: '/wallpaper/invalid' }])).toThrow('详情记录无效')
  expect(() => buildWallpaperSitemap([{ ...item, previewUrl: 'https://evil.test/image.jpg' }])).toThrow('详情记录无效')
  expect(() => buildWallpaperSitemap([item], { publicPaths: ['/desktop/'] })).toThrow('页面路径无效')
})

it.each([
  [{ date: '2024-02-29' }, '2024-02-29'],
  [{ date: '2025-02-29' }, ''],
  [{ date: 'not-a-date', createdAt: '2026-03-12T12:34:56+08:00' }, '2026-03-12'],
  [{ date: '2026-02-30T00:00:00Z' }, ''],
  [{ date: '2026-03-12T99:00:00Z' }, ''],
  [{ date: '20260312' }, ''],
  [{}, ''],
])('lastmod只接受真实有效日期 %j', (item, expected) => {
  expect(getWallpaperLastmod(item)).toBe(expected)
})
