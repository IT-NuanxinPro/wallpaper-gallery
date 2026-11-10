import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateWallpaperDetails } from '../scripts/generate-wallpaper-details.js'
import { buildDetailHtmlFragments, handleWallpaperDetailRequest } from '../server/wallpaper-detail.js'
import { createWallpaperDetailLoader, loadWallpaperCatalog, loadWallpaperDetail } from '../src/services/wallpaperDetailService.js'
import { buildWallpaperDetailRecord } from '../src/utils/wallpaper/detailRecords.js'
import { buildWallpaperSharePath, getWallpaperDetailBucketPath } from '../src/utils/wallpaper/share.js'
import { WALLPAPER_COLLECTIONS } from '../src/content/collections.js'

const wallpaper = { path: '/wallpaper/desktop/风景/a.jpg', filename: 'a.jpg', _series: 'desktop', cdnTag: 'v1.2.3', title: '<script>alert("x")</script>', description: '湖面 & 星空' }
const record = buildWallpaperDetailRecord(wallpaper, 'v1.2.3')
const token = record.sharePath.split('/').at(-1)
const roots = []
afterEach(async () => { for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true }) })

it('生成固定64短文件桶，失效资源下一轮从全部桶与目录移除', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wallpaper-details-'))
  roots.push(root)
  const file = path.join(root, 'desktop.json')
  await fs.writeFile(file, JSON.stringify([wallpaper]))
  const generated = await generateWallpaperDetails({ dataDir: root, defaultCdnTag: 'v1.2.3' })
  expect(generated).toMatchObject({ generated: 1, buckets: 64 })
  const names = await fs.readdir(path.join(root, 'details'))
  expect(names).toHaveLength(70)
  expect(names.every(name => /^index(?:-(?:desktop|mobile|avatar|video|bing))?\.json$/.test(name) || /^[0-3][0-9a-f]\.json$/.test(name))).toBe(true)
  const bucket = await fs.readFile(path.join(root, getWallpaperDetailBucketPath(token).replace('/data/', '')), 'utf8')
  expect(JSON.parse(bucket).items[token].assetKey).toBe(record.assetKey)
  await fs.writeFile(file, '[]')
  await generateWallpaperDetails({ dataDir: root, defaultCdnTag: 'v1.2.3' })
  for (const name of names) {
    const data = JSON.parse(await fs.readFile(path.join(root, 'details', name), 'utf8'))
    expect(Object.keys(data.items)).toHaveLength(0)
  }
  expect(JSON.parse(await fs.readFile(path.join(root, 'collections.json'), 'utf8')).items).toEqual({})
})

it('构建只将人工精选完整记录写入小清单，删除资源后清单同步移除', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'curated-manifest-'))
  roots.push(root)
  const assetKey = WALLPAPER_COLLECTIONS[0].coverKey
  const selected = { ...wallpaper, path: assetKey.slice(assetKey.indexOf(':path:') + 6) }
  await fs.writeFile(path.join(root, 'desktop.json'), JSON.stringify([wallpaper, selected]))
  await generateWallpaperDetails({ dataDir: root, defaultCdnTag: 'v1.2.3' })
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'collections.json'), 'utf8'))
  expect(Object.keys(manifest.items)).toEqual([assetKey])
  expect(manifest.items[assetKey].downloadUrl).toBeTruthy()
  await fs.writeFile(path.join(root, 'desktop.json'), '[]')
  await generateWallpaperDetails({ dataDir: root, defaultCdnTag: 'v1.2.3' })
  expect(JSON.parse(await fs.readFile(path.join(root, 'collections.json'), 'utf8')).items).toEqual({})
})

it('相关推荐只加载当前系列分片并复用成功缓存', async () => {
  const fetchImpl = vi.fn(async () => Response.json({ schema: 1, items: [record] }))
  const items = await loadWallpaperCatalog({ series: 'desktop', fetchImpl })
  expect(items.map(item => item.assetKey)).toEqual([record.assetKey])
  expect(fetchImpl.mock.calls[0][0]).toBe('/data/details/index-desktop.json')
  expect(await loadWallpaperCatalog({ series: 'desktop', fetchImpl })).toBe(items)
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  await expect(loadWallpaperCatalog({ fetchImpl })).rejects.toMatchObject({ status: 400 })
})

it('服务器400/404/503真实状态，元信息和无脚本正文转义注入并读取正确桶', async () => {
  const requests = []
  const assets = { fetch: async request => {
    requests.push(new URL(request.url).pathname)
    if (request.url.endsWith('.json'))
      return Response.json({ schema: 1, items: { [token]: record } })
    return new Response('<html><head><title>old</title></head><body><div id="app"></div></body></html>')
  } }
  const transformHtml = async (response, data) => {
    const fragments = buildDetailHtmlFragments(data)
    return new Response((await response.text()).replace('</head>', `${fragments.head}</head>`).replace('</body>', `${fragments.article}</body>`), response)
  }
  const response = await handleWallpaperDetailRequest(new Request(`https://site.test${record.sharePath}`), { assets, transformHtml })
  expect(response.status).toBe(200)
  expect(requests).toEqual([getWallpaperDetailBucketPath(token), '/index.html'])
  const html = await response.text()
  expect(html).toContain('&lt;script&gt;')
  expect(html).not.toContain('<script>alert')
  expect(html).toContain('property="og:image"')
  expect(html).toContain('data-wallpaper-detail')
  expect(html).toContain(`https://wallpaper.061129.xyz${record.sharePath}`)
  expect((await handleWallpaperDetailRequest(new Request('https://site.test/wallpaper/bad!'), { assets })).status).toBe(400)
  const absent = buildWallpaperSharePath({ ...wallpaper, path: '/wallpaper/desktop/absent.jpg' })
  expect((await handleWallpaperDetailRequest(new Request(`https://site.test${absent}`), { assets })).status).toBe(404)
  const unavailable = await handleWallpaperDetailRequest(new Request(`https://site.test${record.sharePath}`), { assets: { fetch: () => { throw new Error('down') } } })
  expect(unavailable.status).toBe(503)
  expect(unavailable.headers.get('Cache-Control')).toBe('no-store')
  const noRewriter = await handleWallpaperDetailRequest(new Request(`https://site.test${record.sharePath}`), { assets })
  expect(noRewriter.status).toBe(503)
})

it('客户端拒绝非法记录，fetch忽视abort时旧详情也不能覆盖新图', async () => {
  await expect(loadWallpaperDetail(token, { fetchImpl: async () => Response.json({ schema: 1, items: { [token]: { ...record, url: 'javascript:alert(1)' } } }) })).rejects.toMatchObject({ status: 503 })
  let resolveOld
  const onState = vi.fn()
  const loader = createWallpaperDetailLoader({ onState, load: value => value === 'old' ? new Promise(resolve => { resolveOld = resolve }) : Promise.resolve({ title: 'new' }) })
  const pending = loader.load('old')
  await loader.load('new')
  resolveOld({ title: 'old' })
  await pending
  expect(onState.mock.calls.at(-1)[0].record).toEqual({ title: 'new' })
  loader.cancel()
})
