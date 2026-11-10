import { afterEach, expect, it, vi } from 'vitest'
import { buildDetailHtmlFragments } from '../server/wallpaper-detail.js'
import { loadWallpaperDetail, readInitialWallpaperDetail } from '../src/services/wallpaperDetailService.js'
import { buildWallpaperDetailRecord } from '../src/utils/wallpaper/detailRecords.js'

const record = buildWallpaperDetailRecord({ path: '/wallpaper/mobile/风景/lake.jpg', filename: 'lake.jpg', description: '</script><script>alert(1)</script>', _series: 'mobile', resolution: { width: 1080, height: 1920 } }, 'v1.2.3')
const token = record.sharePath.split('/').at(-1)
afterEach(() => vi.unstubAllGlobals())

it('首屏带有可见详情布局和安全数据，保留真实链接及图像空间', () => {
  const { article } = buildDetailHtmlFragments(record)
  expect(article).toContain('class="detail-layout"')
  expect(article).toContain('class="detail-facts"')
  expect(article).toContain('aspect-ratio:1080 / 1920')
  expect(article).toContain('id="wallpaper-detail-data"')
  expect(article).not.toContain('</script><script>alert')
  const data = JSON.parse(article.match(/<script type="application\/json" id="wallpaper-detail-data">(.*?)<\/script>/s)[1])
  expect(data.record).toEqual(record)
  expect(article).toContain(`href="${record.downloadUrl}"`)
})

it('异常尺寸只使用数值回退，不能进入HTML属性或内联样式', () => {
  const malformed = { ...record, resolution: { width: '800"><img src=x onerror=alert(1)>', height: -1 } }
  const { article } = buildDetailHtmlFragments(malformed, { related: [{ ...record, assetKey: record.assetKey + '-invalid' }] })
  expect(article).not.toContain('<img src=x')
  expect(article).toContain('aspect-ratio:800 / 500')
  expect(article).toContain('尺寸信息未提供')
})

it('服务端已验证详情可直接接管，不再等待重复的分片请求', async () => {
  const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))
  vi.stubGlobal('document', { getElementById: () => ({ textContent: JSON.stringify({ schema: 1, record, related: [] }) }) })
  expect(readInitialWallpaperDetail(token)?.record).toEqual(record)
  expect(await loadWallpaperDetail(token, { fetchImpl })).toEqual(record)
  expect(fetchImpl).not.toHaveBeenCalled()
})

it('内嵌记录错配、损坏或包含不可信图源时继续请求正常数据，不污染其他路由', async () => {
  const fetchImpl = vi.fn(async () => Response.json({ schema: 1, items: { [token]: record } }))
  for (const payload of ['bad json', JSON.stringify({ schema: 2, record }), JSON.stringify({ schema: 1, record: { ...record, thumbnailUrl: 'https://evil.test/a.jpg' } })]) {
    vi.stubGlobal('document', { getElementById: () => ({ textContent: payload }) })
    expect(readInitialWallpaperDetail(token)).toBeNull()
    expect(await loadWallpaperDetail(token, { fetchImpl })).toEqual(record)
  }
  vi.stubGlobal('document', { getElementById: () => ({ textContent: JSON.stringify({ schema: 1, record }) }) })
  expect(readInitialWallpaperDetail('different-token')).toBeNull()
  const controller = new AbortController()
  controller.abort()
  await expect(loadWallpaperDetail(token, { signal: controller.signal, fetchImpl })).rejects.toMatchObject({ name: 'AbortError' })
  expect(fetchImpl).toHaveBeenCalledTimes(3)
})
