import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchWithRetry } from '../src/services/wallpaper/fetch.js'
import { useWallpaperStore } from '../src/stores/wallpaper.js'
import { buildWallpaperAssetKey, getWallpaperIdentity } from '../src/utils/wallpaper/identity.js'
import { transformBingWallpaper, transformWallpaperUrls } from '../src/utils/wallpaper/transformers.js'
import * as transformers from '../src/utils/wallpaper/transformers.js'

vi.mock('../src/services/wallpaper/fetch.js', () => ({ fetchWithRetry: vi.fn() }))
vi.mock('../src/services/wallpaper/decoder.js', () => ({ decodeDataWithWorker: vi.fn() }))

const first = { id: 'desktop-1', filename: 'same.jpg', path: '/wallpaper/desktop/a/same.jpg' }
const second = { id: 'desktop-2', filename: 'same.jpg', path: '/wallpaper/desktop/b/same.jpg' }
const key = item => `desktop:path:${item.path}`

describe('完整资源路径身份', () => {
  it('区分不同分类的同名图片，排序ID变化不改变身份', () => {
    expect(buildWallpaperAssetKey(first, 'desktop')).toBe(key(first))
    expect(buildWallpaperAssetKey(second, 'desktop')).toBe(key(second))
    expect(buildWallpaperAssetKey({ ...first, id: 'desktop-99' }, 'desktop')).toBe(key(first))
    expect(getWallpaperIdentity(first, 'desktop')).toEqual({ assetKey: key(first), imageId: `path:${first.path}`, filename: 'same.jpg', series: 'desktop' })
  })

  it('逐段只解码一次再编码，裸百分号不影响已编码中文', () => {
    const encoded = buildWallpaperAssetKey({ path: '/wallpaper/desktop/风景/%E4%B8%AD%20%25%2F%252F%raw.jpg' }, 'desktop')
    expect(encoded).toBe('desktop:path:/wallpaper/desktop/%E9%A3%8E%E6%99%AF/%E4%B8%AD%20%25%2F%252F%25raw.jpg')
    expect(buildWallpaperAssetKey(encoded, 'desktop')).toBe(encoded)
    expect(buildWallpaperAssetKey({ source_path: '/wallpaper/desktop/风景/中 %25%2F%252F%raw.jpg' }, 'desktop')).toBe(encoded)
  })

  it('路径优先于缓存键，仅信任同系列的规范缓存键', () => {
    expect(buildWallpaperAssetKey({ ...first, _assetKey: key(second) }, 'desktop')).toBe(key(first))
    expect(buildWallpaperAssetKey({ filename: 'same.jpg', _assetKey: key(first) }, 'desktop')).toBe(key(first))
    expect(buildWallpaperAssetKey({ filename: 'same.jpg', _assetKey: 'mobile:path:/wallpaper/mobile/a/same.jpg' }, 'desktop')).toBe('desktop:same.jpg')
    expect(buildWallpaperAssetKey({ filename: 'same.jpg', _assetKey: 'desktop:path:invalid' }, 'desktop')).toBe('desktop:same.jpg')
    expect(transformWallpaperUrls({ ...first, _assetKey: 'mobile:path:/wallpaper/mobile/a/same.jpg' })._assetKey).toBe(key(first))
    expect(buildWallpaperAssetKey({ filename: '2026-11-09.jpg', _assetKey: 'bing:arbitrary.jpg' }, 'bing')).toBe('bing:bing-2026-11-09.jpg')
  })

  it('保留旧文件名和 Bing 合同，URL 不作为原始资源身份', () => {
    expect(buildWallpaperAssetKey('same.jpg', 'desktop')).toBe('desktop:same.jpg')
    expect(buildWallpaperAssetKey('desktop:same.jpg', 'desktop')).toBe('desktop:same.jpg')
    expect(buildWallpaperAssetKey({ filename: 'same.jpg', url: 'https://cdn.test/wallpaper/desktop/a/same.jpg' }, 'desktop')).toBe('desktop:same.jpg')
    expect(buildWallpaperAssetKey('2026-11-09.jpg', 'bing')).toBe('bing:bing-2026-11-09.jpg')
    expect(buildWallpaperAssetKey('bing:bing-2026-11-09.jpg', 'bing')).toBe('bing:bing-2026-11-09.jpg')
    expect(transformBingWallpaper({ date: '2026-11-09', urlbase: '/th?id=test' })._assetKey).toBe('bing:bing-2026-11-09.jpg')
  })

  it('转换后的静态与视频数据都带规范身份', () => {
    expect(transformWallpaperUrls(first)._assetKey).toBe(key(first))
    expect(transformWallpaperUrls({ filename: 'same.jpg', url: 'https://cdn.test/wallpaper/desktop/a/same.jpg' })._assetKey).toBe('desktop:same.jpg')
    expect(transformWallpaperUrls({ filename: 'same.mp4', path: '/wallpaper/video/a/same.mp4', mediaType: 'video' })._assetKey).toBe('video:path:/wallpaper/video/a/same.mp4')
  })

  it('资料库最小回退只从规范键恢复原图，旧键不会猜测目录或缩略图', () => {
    expect(typeof transformers.restoreWallpaperFromAssetKey).toBe('function')
    const restored = transformers.restoreWallpaperFromAssetKey(key(second))
    expect(restored.filename).toBe('same.jpg')
    expect(restored.path).toBe(second.path)
    expect(restored.url).toContain('/wallpaper/desktop/b/same.jpg')
    expect(restored.thumbnailUrl).toBe('')
    expect(transformers.restoreWallpaperFromAssetKey('desktop:same.jpg')).toMatchObject({
      _assetKey: 'desktop:same.jpg', filename: 'same.jpg', url: '', thumbnailUrl: '',
    })
  })
})

describe('收藏资料解析', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetchWithRetry).mockReset()
    vi.mocked(fetchWithRetry).mockImplementation(async (url) => ({
      json: async () => url.includes('index.json')
        ? { total: 2, categories: [{ file: 'a.json' }, { file: 'b.json' }] }
        : { wallpapers: [url.includes('b.json') ? second : first] },
    }))
  })

  it('规范键分别取回各自路径，旧同名键不猜第一张', async () => {
    const store = useWallpaperStore()
    const results = await store.resolveWallpapersByAssetKeys([key(first), key(second), 'desktop:same.jpg'])
    expect(results[0]?.path).toBe(first.path)
    expect(results[1]?.path).toBe(second.path)
    expect(results[2]).toBeNull()
  })

  it('唯一旧文件名还原成规范身份，后续操作不再写旧键', async () => {
    vi.mocked(fetchWithRetry).mockImplementation(async url => ({ json: async () => url.includes('index.json')
      ? { total: 1, categories: [{ file: 'a.json' }] }
      : { wallpapers: [first] } }))
    const [result] = await useWallpaperStore().resolveWallpapersByAssetKeys(['desktop:same.jpg'])
    expect(result?.path).toBe(first.path)
    expect(result?._assetKey).toBe(key(first))
  })

  it('完整系列缓存也按规范键分别还原，不复用同名的第一张', async () => {
    const store = useWallpaperStore()
    await store.initSeries('desktop')
    const calls = vi.mocked(fetchWithRetry).mock.calls.length
    const results = await store.resolveWallpapersByAssetKeys([key(second), key(first), 'desktop:same.jpg'])
    expect(results.map(item => item?.path || null)).toEqual([second.path, first.path, null])
    expect(fetchWithRetry).toHaveBeenCalledTimes(calls)
  })
})
