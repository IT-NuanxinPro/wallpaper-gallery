import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, nextTick, ref } from 'vue'
import { useHomeDataLoader } from '../src/composables/home/useHomeDataLoader.js'
import { fetchWithRetry } from '../src/services/wallpaper/fetch.js'
import { useWallpaperStore } from '../src/stores/wallpaper.js'
import { buildWallpaperImageFallbackUrls } from '../src/utils/common/format.js'

vi.mock('../src/services/wallpaper/fetch.js', () => ({ fetchWithRetry: vi.fn(), delay: vi.fn() }))
vi.mock('../src/services/wallpaper/decoder.js', () => ({ decodeDataWithWorker: vi.fn() }))

const response = data => ({ json: async () => data })
const item = (series, title) => ({ id: `${series}-${title}`, filename: `${title}.jpg`, path: `/wallpaper/${series}/${title}.jpg`, createdAt: '2026-10-10T00:00:00Z', format: 'JPG' })

describe('系列数据加载与缓存', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetchWithRetry).mockReset()
    vi.mocked(fetchWithRetry).mockImplementation(async (url) => {
      const series = /data\/(\w+)\//.exec(url)?.[1]
      if (url.includes('index.json'))
        return response({ total: 1, categories: [{ file: '风景.json' }] })
      return response({ wallpapers: [item(series, 'first')] })
    })
  })

  it('切回已加载系列复用完整列表，不发起请求或重复排序', async () => {
    const store = useWallpaperStore()
    await store.initSeries('desktop')
    const first = store.wallpapers
    await store.initSeries('mobile')
    const calls = vi.mocked(fetchWithRetry).mock.calls.length
    await store.initSeries('desktop')
    expect(fetchWithRetry).toHaveBeenCalledTimes(calls)
    expect(store.wallpapers).toBe(first)
    expect(store.currentRenderedSeries).toBe('desktop')
    expect(store.loading).toBe(false)
  })

  it('手动刷新清除系列与分类缓存并取得新数据', async () => {
    const store = useWallpaperStore()
    await store.initSeries('desktop')
    vi.mocked(fetchWithRetry).mockImplementation(async url => url.includes('index.json')
      ? response({ total: 1, categories: [{ file: '风景.json' }] })
      : response({ wallpapers: [item('desktop', 'updated')] }))
    await store.initSeries('desktop', true)
    expect(store.wallpapers[0].filename).toBe('updated.jpg')
    expect(fetchWithRetry).toHaveBeenCalledTimes(4)
  })

  it('慢请求返回后不能覆盖用户已经切回的缓存系列', async () => {
    const store = useWallpaperStore()
    await store.initSeries('desktop')
    let finishMobile
    vi.mocked(fetchWithRetry).mockImplementationOnce(() => new Promise((resolve) => {
      finishMobile = resolve
    }))
    const pending = store.initSeries('mobile')
    await store.initSeries('desktop')
    finishMobile(response({ total: 1, categories: [{ file: '风景.json' }] }))
    await pending
    expect(store.currentRenderedSeries).toBe('desktop')
    expect(store.wallpapers[0].id).toBe('desktop-first')
    expect(store.loading).toBe(false)
  })
})

// 以 Vue 自定义 renderer 运行真实生命周期，不依赖浏览器 DOM。
const renderer = createRenderer({
  createComment: () => ({}),
  createText: () => ({}),
  createElement: () => ({}),
  insert: () => {},
  remove: () => {},
  setText: () => {},
  setElementText: () => {},
  patchProp: () => {},
  parentNode: () => null,
  nextSibling: () => null,
})

describe('页面不等待图片预加载', () => {
  let app
  afterEach(() => app?.unmount())

  function mountLoader(initSeries) {
    let loader
    const series = ref('desktop')
    const options = {
      currentSeries: series,
      showMobileSeriesNotice: ref(false),
      filterStore: { setDefaultSortBySeries: vi.fn() },
      hotTagsStore: { fetchHotTags: vi.fn().mockResolvedValue([]) },
      popularityStore: { fetchPopularityData: vi.fn().mockResolvedValue([]) },
      seriesStore: { currentSeries: 'desktop' },
      syncSeriesFromRoute: vi.fn(),
      wallpaperStore: { initSeries, loading: false, error: null, loadSeriesLatest: vi.fn() },
    }
    app = renderer.createApp({
      setup() {
        loader = useHomeDataLoader(options)
        return () => null
      },
    })
    app.mount({})
    return { loader, series, options }
  }

  it('元数据完成即可展示，不请求重复的最新切片或等待图片', async () => {
    const { loader, options } = mountLoader(vi.fn().mockResolvedValue(undefined))
    await nextTick()
    expect(loader.loading.value).toBe(false)
    expect(options.wallpaperStore.loadSeriesLatest).not.toHaveBeenCalled()
  })

  it('首次加载尚未完成时切换系列，也能立即加载新系列', async () => {
    let finishFirst
    const init = vi.fn().mockImplementationOnce(() => new Promise((resolve) => {
      finishFirst = resolve
    })).mockResolvedValue(undefined)
    const { loader, series } = mountLoader(init)
    series.value = 'avatar'
    await nextTick()
    await nextTick()
    expect(init).toHaveBeenLastCalledWith('avatar', false)
    expect(loader.loading.value).toBe(false)
    finishFirst()
    await nextTick()
    expect(loader.loading.value).toBe(false)
  })
})

describe('列表图片资源优先级', () => {
  it('优先缩略图，保留预览和原图作为失败回退', () => {
    const urls = buildWallpaperImageFallbackUrls({
      filename: 'sample.webp',
      thumbnailUrl: 'https://example.com/thumbnail.webp',
      previewUrl: 'https://example.com/preview.webp',
      url: 'https://example.com/original.webp',
    }, { preferThumbnail: true })
    expect(urls).toEqual(['https://example.com/thumbnail.webp', 'https://example.com/preview.webp', 'https://example.com/original.webp'])
  })
})
