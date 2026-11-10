import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateWallpaperDetails } from '../scripts/generate-wallpaper-details.js'
import { buildDetailHtmlFragments, handleWallpaperDetailRequest } from '../server/wallpaper-detail.js'
import { createWallpaperDetailLoader, loadWallpaperCatalog, loadWallpaperDetail } from '../src/services/wallpaperDetailService.js'
import { buildWallpaperDetailRecord, getWallpaperDetailSeo } from '../src/utils/wallpaper/detailRecords.js'
import { buildWallpaperSharePath, getWallpaperDetailBucketPath } from '../src/utils/wallpaper/share.js'
import { WALLPAPER_COLLECTIONS } from '../src/content/collections.js'
import { applyWallpaperDetailSeo } from '../src/utils/seo/wallpaperDetail.js'

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
  const generated = await generateWallpaperDetails({ dataDir: root, sitemapPath: path.join(root, 'sitemap.xml'), defaultCdnTag: 'v1.2.3' })
  expect(generated).toMatchObject({ generated: 1, buckets: 64 })
  const names = await fs.readdir(path.join(root, 'details'))
  expect(names).toHaveLength(70)
  expect(names.every(name => /^index(?:-(?:desktop|mobile|avatar|video|bing))?\.json$/.test(name) || /^[0-3][0-9a-f]\.json$/.test(name))).toBe(true)
  const bucket = await fs.readFile(path.join(root, getWallpaperDetailBucketPath(token).replace('/data/', '')), 'utf8')
  expect(JSON.parse(bucket).items[token].assetKey).toBe(record.assetKey)
  await fs.writeFile(file, '[]')
  await generateWallpaperDetails({ dataDir: root, sitemapPath: path.join(root, 'sitemap.xml'), defaultCdnTag: 'v1.2.3' })
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
  await generateWallpaperDetails({ dataDir: root, sitemapPath: path.join(root, 'sitemap.xml'), defaultCdnTag: 'v1.2.3' })
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'collections.json'), 'utf8'))
  expect(Object.keys(manifest.items)).toEqual([assetKey])
  expect(manifest.items[assetKey].downloadUrl).toBeTruthy()
  await fs.writeFile(path.join(root, 'desktop.json'), '[]')
  await generateWallpaperDetails({ dataDir: root, sitemapPath: path.join(root, 'sitemap.xml'), defaultCdnTag: 'v1.2.3' })
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

it('服务器404/503真实状态，元信息和无脚本正文转义注入并读取正确桶', async () => {
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
  expect(requests).toContain(getWallpaperDetailBucketPath(token))
  expect(requests).toContain('/data/details/index-desktop.json')
  expect(requests).toContain('/detail-shell')
  const html = await response.text()
  expect(html).toContain('&lt;script&gt;')
  expect(html).not.toContain('<script>alert')
  expect(html).toContain('property="og:image"')
  expect(html).toContain('data-wallpaper-detail')
  expect(html).toContain(`https://wallpaper.061129.xyz${record.sharePath}`)
  expect((await handleWallpaperDetailRequest(new Request('https://site.test/wallpaper/bad!'), { assets })).status).toBe(404)
  const absent = buildWallpaperSharePath({ ...wallpaper, path: '/wallpaper/desktop/absent.jpg' })
  expect((await handleWallpaperDetailRequest(new Request(`https://site.test${absent}`), { assets })).status).toBe(404)
  const unavailable = await handleWallpaperDetailRequest(new Request(`https://site.test${record.sharePath}`), { assets: { fetch: () => { throw new Error('down') } } })
  expect(unavailable.status).toBe(503)
  expect(unavailable.headers.get('Cache-Control')).toBe('no-store')
  const noRewriter = await handleWallpaperDetailRequest(new Request(`https://site.test${record.sharePath}`), { assets })
  expect(noRewriter.status).toBe(503)
})

it('有效详情尾斜杠永久归一化，错误页不暴露 canonical，HEAD 没有正文', async () => {
  const assets = { fetch: async request => request.url.endsWith('/detail-shell') ? new Response('<html></html>', { headers: { 'X-Robots-Tag': 'noindex', ETag: 'shell-etag', 'Content-Length': '13' } }) : Response.json({ schema: 1, items: { [token]: record } }) }
  const redirected = await handleWallpaperDetailRequest(new Request(`https://site.test${record.sharePath}/?from=share`), { assets })
  expect(redirected.status).toBe(308)
  expect(redirected.headers.get('Location')).toBe(`https://wallpaper.061129.xyz${record.sharePath}`)
  const head = await handleWallpaperDetailRequest(new Request(`https://site.test${record.sharePath}`, { method: 'HEAD' }), { assets, transformHtml: response => response })
  expect(head.status).toBe(200)
  expect(await head.text()).toBe('')
  expect(head.headers.get('Cache-Control')).toBe('public, max-age=60, s-maxage=300')
  expect(head.headers.get('X-Robots-Tag')).toBe('index, follow, max-image-preview:large')
  expect(head.headers.has('ETag')).toBe(false)
  expect(head.headers.has('Content-Length')).toBe(false)
  const error = await handleWallpaperDetailRequest(new Request('https://site.test/wallpaper/invalid!'), { assets })
  expect(error.status).toBe(404)
  expect(await error.text()).not.toContain('canonical')
  expect(error.headers.get('X-Robots-Tag')).toBe('noindex')
  const errorHead = await handleWallpaperDetailRequest(new Request('https://site.test/wallpaper/invalid!', { method: 'HEAD' }), { assets })
  expect(errorHead.status).toBe(404)
  expect(await errorHead.text()).toBe('')
  const unavailableHead = await handleWallpaperDetailRequest(new Request(`https://site.test${record.sharePath}`, { method: 'HEAD' }))
  expect(unavailableHead.status).toBe(503)
  expect(unavailableHead.headers.get('Cache-Control')).toBe('no-store')
  expect(await unavailableHead.text()).toBe('')
})

it('详情SEO清理展示名称，复用真实描述和预览图，结构化数据不虚构作者及4K', () => {
  const data = { ...record, title: 'IMG_001.jpg', displayTitle: '山间__晨光  .jpg', description: '真实的湖面与山间晨光。', previewUrl: '/images/v1.2.3/preview/desktop/a.webp', resolution: { width: 1920, height: 1080 } }
  const seo = getWallpaperDetailSeo(data)
  expect(seo.name).toBe('山间 晨光')
  expect(seo.title).toContain('电脑壁纸')
  expect(seo.title).not.toContain('4K')
  expect(seo.description).toContain(data.description)
  expect(seo.image).toBe('https://wallpaper.061129.xyz/images/v1.2.3/preview/desktop/a.webp')
  const graph = seo.structuredData['@graph']
  expect(graph.map(item => item['@type'])).toEqual(['WebPage', 'ImageObject', 'BreadcrumbList'])
  expect(graph[1]).not.toHaveProperty('author')
  expect(graph[1].contentUrl).toBe(seo.image)
  expect(graph[1]).not.toHaveProperty('width')
  expect(graph[1]).not.toHaveProperty('height')
  expect(getWallpaperDetailSeo({ ...data, resolution: { width: 3840, height: 2160 } }).title).toContain('4K')
  const html = buildDetailHtmlFragments({ ...data, description: '</script><script>alert(1)</script>' }).head
  expect(html).toContain('application/ld+json')
  expect(html).not.toContain('</script><script>')
  expect(JSON.parse(html.match(/<script[^>]*>(.*?)<\/script>/)[1])['@graph'][0].description).toContain('</script>')
})

it('真实描述只规范元信息空白，正文完整保留且包含与客户端一致的大小和标签', () => {
  const description = `4K 素材的来源说明\n  ${'山间晨光与湖面。'.repeat(55)}<原始说明>`
  const data = { ...record, description, size: 3 * 1024 * 1024, tags: ['风景', '<星空>'], filename: 'scene.webp', format: '' }
  const seo = getWallpaperDetailSeo(data)
  expect(seo.description).toBe(description.replace(/\s+/g, ' ').trim().slice(0, 240))
  expect(seo.description).toContain('4K')
  expect(seo.description.length).toBeLessThanOrEqual(240)
  const { article } = buildDetailHtmlFragments(data)
  expect(article).toContain(description.replace('<原始说明>', '&lt;原始说明&gt;'))
  expect(article).toContain('<dt>文件大小</dt><dd>3 MB</dd>')
  expect(article).toContain('<dt>文件格式</dt><dd>WEBP</dd>')
  expect(article).toContain('aria-label="壁纸标签"')
  expect(article).toContain('&lt;星空&gt;')
  const withoutDescription = { ...data, description: '', displayTitle: '山间晨光' }
  expect(buildDetailHtmlFragments(withoutDescription).article).toContain(getWallpaperDetailSeo(withoutDescription).description)
})

it('服务端输出有效同系列推荐链接，推荐目录失败不影响主详情', async () => {
  const related = buildWallpaperDetailRecord({ ...wallpaper, path: '/wallpaper/desktop/风景/related.jpg', title: '同系列山景' }, 'v1.2.3')
  let catalogFails = false
  const assets = { fetch: async request => {
    const pathname = new URL(request.url).pathname
    if (pathname.includes('index-desktop')) {
      if (catalogFails) throw new Error('catalog unavailable')
      return Response.json({ schema: 1, items: [record, related, { ...related, sharePath: '/wallpaper/invalid!' }] })
    }
    return pathname === '/detail-shell' ? new Response('<html></html>') : Response.json({ schema: 1, items: { [token]: record } })
  } }
  const transformHtml = (response, data, options) => new Response(buildDetailHtmlFragments(data, options).article, response)
  const first = await handleWallpaperDetailRequest(new Request(`https://site.test${record.sharePath}`), { assets, transformHtml })
  expect(first.status).toBe(200)
  const html = await first.text()
  expect(html).toContain(related.sharePath)
  expect(html).toContain('aria-label="面包屑"')
  expect(html).not.toContain('/wallpaper/invalid!')
  catalogFails = true
  expect((await handleWallpaperDetailRequest(new Request(`https://site.test${record.sharePath}`), { assets, transformHtml })).status).toBe(200)
})

it('从noindex页面进入有效详情后恢复可索引，并替换旧结构化数据', () => {
  const nodes = []
  const createElement = tag => ({ tag, attributes: {}, setAttribute(key, value) { this.attributes[key] = value }, remove() { nodes.splice(nodes.indexOf(this), 1) } })
  const robots = createElement('meta')
  robots.attributes = { name: 'robots', content: 'noindex, follow' }
  const oldScript = createElement('script')
  oldScript.attributes.type = 'application/ld+json'
  nodes.push(robots, oldScript)
  const document = { title: '', createElement, head: {
    querySelector: selector => selector === 'meta[name="robots"]' ? robots : null,
    querySelectorAll: () => nodes.filter(node => node.tag === 'script'),
    appendChild: node => nodes.push(node),
  } }
  vi.stubGlobal('document', document)
  try {
    applyWallpaperDetailSeo(record)
    expect(robots.attributes.content).toBe('index, follow, max-image-preview:large')
    const scripts = nodes.filter(node => node.tag === 'script')
    expect(scripts).toHaveLength(1)
    expect(JSON.parse(scripts[0].textContent)).toEqual(getWallpaperDetailSeo(record).structuredData)
    expect(document.title).toBe(getWallpaperDetailSeo(record).title)
  }
  finally { vi.unstubAllGlobals() }
})

it('客户端拒绝非法记录，fetch忽视abort时旧详情也不能覆盖新图', async () => {
  await expect(loadWallpaperDetail('invalid!')).rejects.toMatchObject({ status: 404 })
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
