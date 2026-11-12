import { afterEach, expect, it, vi } from 'vitest'
import { createWallpaperDetailLoader, loadWallpaperDetail, primeWallpaperDetail, readReadyWallpaperDetail } from '../src/services/wallpaperDetailService.js'
import { buildWallpaperSharePath } from '../src/utils/wallpaper/share.js'

const tokenOf = item => buildWallpaperSharePath(item).split('/').at(-1)
const image = (name, series = 'desktop') => ({ _series: series, filename: `${name}.jpg`, path: `/wallpaper/${series}/nature/${name}.jpg`, displayTitle: '山间晨光', previewPath: `/preview/${series}/nature/${name}.webp`, resolution: { width: 3840, height: 2160 } })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('卡片数据可同步交接给详情，断网时仍直接呈现基础信息，没有空白loading阶段', async () => {
  const item = image('handoff')
  primeWallpaperDetail(item, { cdnTag: 'v1.2.3' })
  const states = []
  const load = vi.fn().mockRejectedValue(Error('offline'))
  const loader = createWallpaperDetailLoader({ load, onState: state => states.push(state) })
  const pending = loader.load(tokenOf(item))
  expect(states).toHaveLength(1)
  expect(states[0]).toMatchObject({ loading: false, record: { displayTitle: '山间晨光', resolution: { width: 3840, height: 2160 }, previewUrl: '/images/v1.2.3/preview/desktop/nature/handoff.webp' }, error: null })
  await pending
  expect(load).not.toHaveBeenCalled()
})

it.each(['desktop', 'mobile', 'avatar', 'video', 'bing'])('%s列表交接保留各自图片/视频地址，不混用同名资源', async series => {
  const item = series === 'bing'
    ? { _series: 'bing', filename: 'bing-2026-11-12.jpg', urlbase: '/th?id=OHR.Lake', date: '2026-11-12' }
    : image('same', series)
  if (series === 'video') Object.assign(item, { filename: 'same.mp4', path: '/wallpaper/video/desktop/same.mp4', previewPath: '/preview/video/desktop/same.mp4', thumbnailPath: '/thumbnail/video/desktop/same.png', usage: 'desktop' })
  const record = primeWallpaperDetail(item, { series, cdnTag: 'v1.2.3' })
  expect(record._series).toBe(series)
  const fetchImpl = vi.fn().mockRejectedValue(Error('network must not block handoff'))
  expect(await loadWallpaperDetail(tokenOf(item), { fetchImpl })).toEqual(record)
  expect(fetchImpl).not.toHaveBeenCalled()
  if (series === 'video') expect(record.previewUrl).toBe('https://img.061129.xyz/preview/video/desktop/same.mp4')
  if (series === 'bing') expect(record.downloadUrl).toBe('https://www.bing.com/th?id=OHR.Lake_UHD.jpg')
})

it('拒绝不可信完整详情；缺身份或缺CDN版本时回到正常加载', () => {
  const item = image('invalid')
  expect(primeWallpaperDetail(item)).toBeNull()
  expect(primeWallpaperDetail({ filename: 'unknown.jpg' }, { cdnTag: 'v1.2.3' })).toBeNull()
  const valid = primeWallpaperDetail(item, { cdnTag: 'v1.2.3' })
  expect(primeWallpaperDetail({ ...valid, previewUrl: 'https://evil.test/a.jpg' })).toBeNull()
  expect(readReadyWallpaperDetail(tokenOf(item)).previewUrl).toBe('/images/v1.2.3/preview/desktop/nature/invalid.webp')
})

it('服务端已验证内容优先于同一浏览器里旧的卡片交接数据', async () => {
  const item = image('embedded')
  const cached = primeWallpaperDetail(item, { cdnTag: 'v1.2.3' })
  vi.stubGlobal('document', { getElementById: () => ({ textContent: JSON.stringify({ schema: 1, record: { ...cached, displayTitle: '新的标题' } }) }) })
  expect(readReadyWallpaperDetail(tokenOf(item)).displayTitle).toBe('新的标题')
})

it('交接数据五分钟后失效，重新请求记录；取消仍然生效', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
  const item = image('expired')
  const record = primeWallpaperDetail(item, { cdnTag: 'v1.2.3' })
  now.mockReturnValue(1_300_000)
  const fetchImpl = vi.fn(async () => Response.json({ schema: 1, items: { [tokenOf(item)]: record } }))
  expect(readReadyWallpaperDetail(tokenOf(item))).toBeNull()
  expect(await loadWallpaperDetail(tokenOf(item), { fetchImpl })).toEqual(record)
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  const controller = new AbortController()
  controller.abort()
  await expect(loadWallpaperDetail(tokenOf(item), { fetchImpl, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
})

it('交接缓存有容量边界，长列表浏览不会保留全部图片记录', () => {
  const oldest = image('oldest')
  primeWallpaperDetail(oldest, { cdnTag: 'v1.2.3' })
  for (let i = 0; i < 40; i++) primeWallpaperDetail(image(`bounded-${i}`), { cdnTag: 'v1.2.3' })
  expect(readReadyWallpaperDetail(tokenOf(oldest))).toBeNull()
  expect(readReadyWallpaperDetail(tokenOf(image('bounded-39')))?.displayTitle).toBe('山间晨光')
})
