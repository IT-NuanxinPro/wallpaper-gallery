import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRenderer, h, nextTick, ref } from 'vue'
import { loadWallpaperStats } from '../src/services/wallpaperStatsService.js'
import { useWallpaperStats } from '../src/composables/useWallpaperStats.js'

const key = 'mobile:path:/wallpaper/mobile/lake.jpg'
const second = 'mobile:path:/wallpaper/mobile/other/lake.jpg'
const row = { asset_key: key, total_views: 12, total_downloads: 3, total_likes: 0, total_collects: 2, updated_at: '2026-11-11T00:00:00Z' }
const apps = []
beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://stats.example.test')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')
})
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.unstubAllEnvs(); vi.restoreAllMocks() })

it('只用anon按完整asset_key等值读取单图，真实0保留', async () => {
  const fetchImpl = vi.fn(async () => Response.json([row]))
  expect(await loadWallpaperStats(key, { fetchImpl })).toEqual({ views: 12, downloads: 3, likes: 0, collects: 2 })
  const [url, options] = fetchImpl.mock.calls[0]
  expect(new URL(url).pathname).toBe('/rest/v1/image_stats_with_asset_key')
  expect(new URL(url).searchParams.get('asset_key')).toBe(`eq.${key}`)
  expect(new URL(url).searchParams.get('limit')).toBe('1')
  expect(options.headers).toMatchObject({ apikey: 'public-anon-key', Authorization: 'Bearer public-anon-key' })
  expect(options.method).toBe('GET')
})

it('Bing按日期完整键读取下载、喜欢和收藏，不把系列统计清零', async () => {
  const assetKey = 'bing:bing-2026-05-01.jpg'
  const fetchImpl = vi.fn(async () => Response.json([{ ...row, asset_key: assetKey, total_views: 12, total_downloads: 6, total_likes: 1, total_collects: 2 }]))
  expect(await loadWallpaperStats(assetKey, { fetchImpl })).toEqual({ views: 12, downloads: 6, likes: 1, collects: 2 })
  expect(new URL(fetchImpl.mock.calls[0][0]).searchParams.get('asset_key')).toBe(`eq.${assetKey}`)
})

it('拒绝文件名级身份、不匹配数据和无效计数；缺失记录不伪造0', async () => {
  const fetchImpl = vi.fn(async () => Response.json([]))
  await expect(loadWallpaperStats('mobile:lake.jpg', { fetchImpl })).rejects.toThrow()
  expect(fetchImpl).not.toHaveBeenCalled()
  expect(await loadWallpaperStats(key, { fetchImpl })).toBeNull()
  await expect(loadWallpaperStats(key, { fetchImpl: async () => Response.json([{ ...row, asset_key: second }]) })).rejects.toThrow()
  await expect(loadWallpaperStats(key, { fetchImpl: async () => Response.json([{ ...row, total_views: -1 }]) })).rejects.toThrow()
  await expect(loadWallpaperStats(key, { fetchImpl: async () => new Response('', { status: 503 }) })).rejects.toThrow()
})

function mountStats(load) {
  const record = ref({ assetKey: key })
  let state
  const renderer = createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null,
  })
  const app = renderer.createApp({ setup() { state = useWallpaperStats(record, { load }); return () => h('div') } })
  app.mount({})
  apps.push(app)
  return { record, state, app }
}

it('初始占位、切图取消旧请求，忽略不遵守abort的迟到响应', async () => {
  const pending = []
  const load = vi.fn((assetKey, options) => new Promise(resolve => pending.push({ assetKey, ...options, resolve })))
  const { record, state } = mountStats(load)
  expect(state.stats.value).toBeNull()
  expect(pending[0].assetKey).toBe(key)
  record.value = { assetKey: second }
  await nextTick()
  expect(pending[0].signal.aborted).toBe(true)
  pending[1].resolve({ views: 7, likes: 0, collects: 0, downloads: 1 })
  await Promise.resolve()
  pending[0].resolve({ views: 999 })
  await Promise.resolve()
  expect(state.stats.value.views).toBe(7)
  expect(await state.refresh(key)).toBe(false)
  expect(load).toHaveBeenCalledTimes(2)
})

it('互动成功才刷新当前图；失败不加数，读取失败恢复占位', async () => {
  const load = vi.fn().mockResolvedValue({ views: 2, likes: 0, collects: 0, downloads: 1 })
  const { state } = mountStats(load)
  await Promise.resolve()
  await state.afterSuccessful(async () => ({ success: false }))()
  expect(load).toHaveBeenCalledOnce()
  await state.afterSuccessful(async () => ({ success: true }))()
  expect(load).toHaveBeenCalledTimes(2)
  load.mockRejectedValue(new Error('offline'))
  await state.refresh()
  expect(state.stats.value).toBeNull()
  expect(state.failed.value).toBe(true)
})

it('旧图互动完成不刷新新图，卸载取消请求且不接收迟到结果', async () => {
  const pending = []
  const load = vi.fn((assetKey, options) => new Promise(resolve => pending.push({ assetKey, ...options, resolve })))
  const { record, state, app } = mountStats(load)
  let finishAction
  const action = state.afterSuccessful(() => new Promise(resolve => { finishAction = resolve }))()
  record.value = { assetKey: second }
  await nextTick()
  finishAction({ success: true })
  await action
  expect(load).toHaveBeenCalledTimes(2)
  app.unmount()
  apps.splice(apps.indexOf(app), 1)
  expect(pending[1].signal.aborted).toBe(true)
  pending[1].resolve({ views: 999, likes: 0, collects: 0, downloads: 0 })
  await Promise.resolve()
  expect(state.stats.value).toBeNull()
  expect(await state.refresh(second)).toBe(false)
})
