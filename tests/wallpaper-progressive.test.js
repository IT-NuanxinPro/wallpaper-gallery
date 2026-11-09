import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeDataWithWorker } from '../src/services/wallpaper/decoder.js'
import { fetchWithRetry } from '../src/services/wallpaper/fetch.js'
import { useWallpaperStore } from '../src/stores/wallpaper.js'

vi.mock('../src/services/wallpaper/fetch.js', () => ({ fetchWithRetry: vi.fn() }))
vi.mock('../src/services/wallpaper/decoder.js', () => ({ decodeDataWithWorker: vi.fn() }))

const response = data => ({ json: async () => data })
const item = (name, date = '2026-11-09') => ({
  id: name,
  filename: `${name}.jpg`,
  path: `/wallpaper/desktop/${name}.jpg`,
  createdAt: `${date}T00:00:00Z`,
  format: 'JPG',
})
const index = (files = ['景色.json'], extra = {}) => ({
  total: files.length,
  generatedAt: '2026-11-09T00:00:00Z',
  categories: files.map(file => ({ file })),
  ...extra,
})
const latest = (items = [item('new')], extra = {}) => ({
  generatedAt: '2026-11-09T00:00:00Z',
  wallpapers: items,
  ...extra,
})
const bingItem = date => ({ date, title: `每日 ${date}`, urlbase: '/th?id=OHR.Example_ZH-CN1234567890' })

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

async function flush() {
  for (let i = 0; i < 20; i++)
    await Promise.resolve()
}

describe('首屏渐进加载', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetchWithRetry).mockReset()
    vi.mocked(decodeDataWithWorker).mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('latest 与索引并行，慢分类完成前解除首屏加载且只在完整时替换列表', async () => {
    const pendingIndex = deferred()
    const firstCategory = deferred()
    const secondCategory = deferred()
    vi.mocked(fetchWithRetry).mockImplementation((url) => {
      if (url.includes('latest.json'))
        return Promise.resolve(response(latest()))
      if (url.includes('index.json'))
        return pendingIndex.promise
      return url.includes('风景.json') ? firstCategory.promise : secondCategory.promise
    })
    const store = useWallpaperStore()
    let completed = false
    const loading = store.initSeries('desktop').then(() => { completed = true })
    await flush()
    expect(store.wallpapers.map(w => w.id)).toEqual(['new'])
    expect(store.currentRenderedSeries).toBe('desktop')
    expect(store.loading).toBe(false)
    expect(store.isBackgroundLoading).toBe(true)
    expect(store.isDataComplete).toBe(false)
    expect(completed).toBe(false)

    const firstScreen = store.wallpapers
    pendingIndex.resolve(response(index(['风景.json', '其他.json'])))
    firstCategory.resolve(response({ wallpapers: [item('old', '2026-11-01')] }))
    await flush()
    expect(store.wallpapers).toBe(firstScreen)
    secondCategory.resolve(response({ wallpapers: [item('new')] }))
    await loading
    expect(store.wallpapers.map(w => w.id)).toEqual(['new', 'old'])
    expect(store.isDataComplete).toBe(true)
    expect(store.isBackgroundLoading).toBe(false)
    expect(completed).toBe(true)
  })

  it('latest 请求失败仍能从分类完成加载', async () => {
    vi.mocked(fetchWithRetry).mockImplementation(async (url) => {
      if (url.includes('latest.json'))
        throw new TypeError('Failed to fetch')
      return response(url.includes('index.json') ? index() : { wallpapers: [item('full')] })
    })
    const store = useWallpaperStore()
    await store.initSeries('desktop')
    expect(store.wallpapers[0].id).toBe('full')
    expect(store.isDataComplete).toBe(true)
    expect(store.error).toBeNull()
    expect(store.backgroundError).toBeNull()
  })

  it('补全失败保留最新切片，提示可重试且不能缓存为完整数据', async () => {
    const category = deferred()
    vi.mocked(fetchWithRetry).mockImplementation(async url => url.includes('latest.json')
      ? response(latest())
      : url.includes('index.json') ? response(index()) : category.promise)
    const store = useWallpaperStore()
    const loading = store.initSeries('desktop')
    await flush()
    category.reject(new TypeError('Failed to fetch'))
    await loading
    expect(store.wallpapers[0].id).toBe('new')
    expect(store.error).toBeNull()
    expect(store.backgroundError).toMatch(/网络|失败/)
    expect(store.isDataComplete).toBe(false)
    expect(store.isBackgroundLoading).toBe(false)

    vi.mocked(fetchWithRetry).mockImplementation(async url => response(url.includes('index.json')
      ? index()
      : { wallpapers: [item('recovered')] }))
    await store.initSeries('desktop')
    expect(store.wallpapers[0].id).toBe('recovered')
    expect(store.isDataComplete).toBe(true)
    expect(store.backgroundError).toBeNull()
  })

  it('全量先完成不等待慢 latest，也不会被它覆盖', async () => {
    const slowLatest = deferred()
    vi.mocked(fetchWithRetry).mockImplementation(async url => url.includes('latest.json')
      ? slowLatest.promise
      : response(url.includes('index.json') ? index() : { wallpapers: [item('full')] }))
    const store = useWallpaperStore()
    await store.initSeries('desktop')
    const full = store.wallpapers
    expect(full[0].id).toBe('full')
    expect(store.isDataComplete).toBe(true)
    slowLatest.resolve(response(latest([item('stale')])))
    await flush()
    expect(store.wallpapers).toBe(full)
  })

  it('切回完整缓存后，旧系列失败不会覆盖内容、加载或错误状态', async () => {
    vi.mocked(fetchWithRetry).mockImplementation(async url => response(url.includes('index.json')
      ? index()
      : { wallpapers: [item('cached')] }))
    const store = useWallpaperStore()
    await store.initSeries('desktop')
    const cached = store.wallpapers
    const oldIndex = deferred()
    const oldLatest = deferred()
    vi.mocked(fetchWithRetry).mockImplementation(url => url.includes('latest.json') ? oldLatest.promise : oldIndex.promise)
    const oldLoading = store.initSeries('mobile')
    await store.initSeries('desktop')
    oldLatest.resolve(response(latest([item('mobile-old')])))
    oldIndex.reject(new SyntaxError('invalid JSON'))
    await oldLoading
    await flush()
    expect(store.wallpapers).toBe(cached)
    expect(store.currentRenderedSeries).toBe('desktop')
    expect(store.loading).toBe(false)
    expect(store.isDataComplete).toBe(true)
    expect(store.error).toBeNull()
    expect(store.errorType).toBeNull()
    expect(store.backgroundError).toBeNull()
  })

  it('强制刷新后旧分类和切片不能回填缓存，后续加载保留刷新结果', async () => {
    const oldLatest = deferred()
    const oldCategory = deferred()
    vi.mocked(fetchWithRetry).mockImplementation(async (url) => {
      if (url.includes('latest.json'))
        return oldLatest.promise
      return url.includes('index.json') ? response(index()) : oldCategory.promise
    })
    const store = useWallpaperStore()
    const oldLoading = store.initSeries('desktop')
    await flush()
    vi.mocked(fetchWithRetry).mockImplementation(async url => response(url.includes('index.json')
      ? index()
      : { wallpapers: [item('fresh')] }))
    await store.initSeries('desktop', true)
    const fresh = store.wallpapers
    oldCategory.resolve(response({ wallpapers: [item('obsolete')] }))
    oldLatest.resolve(response(latest([item('obsolete')])))
    await oldLoading
    await flush()
    expect(store.wallpapers).toBe(fresh)
    expect((await store.loadCategory('desktop', '景色.json'))[0].id).toBe('fresh')
    expect((await store.loadSeriesLatest('desktop'))[0].id).toBe('fresh')
  })

  it('损坏的加密分类不能作为空完整列表缓存，下一次可以重新加载', async () => {
    vi.mocked(decodeDataWithWorker).mockRejectedValue(new SyntaxError('invalid JSON'))
    vi.mocked(fetchWithRetry).mockImplementation(async url => response(url.includes('latest.json')
      ? latest()
      : url.includes('index.json') ? index() : { blob: 'corrupted' }))
    const store = useWallpaperStore()
    await store.initSeries('desktop')
    expect(store.wallpapers[0]?.id).toBe('new')
    expect(store.isDataComplete).toBe(false)
    expect(store.backgroundError).toBeTruthy()
    vi.mocked(fetchWithRetry).mockResolvedValue(response({ wallpapers: [item('fixed')] }))
    await store.initSeries('desktop')
    expect(store.wallpapers[0].id).toBe('fixed')
    expect(store.isDataComplete).toBe(true)
  })

  it('已知索引比 latest 更新时不会展示陈旧切片', async () => {
    const slowLatest = deferred()
    const category = deferred()
    vi.mocked(fetchWithRetry).mockImplementation(async url => url.includes('latest.json')
      ? slowLatest.promise
      : url.includes('index.json') ? response(index()) : category.promise)
    const store = useWallpaperStore()
    const loading = store.initSeries('desktop')
    await flush()
    slowLatest.resolve(response(latest([item('obsolete')], { generatedAt: '2026-10-01T00:00:00Z' })))
    await flush()
    expect(store.currentRenderedSeries).not.toBe('desktop')
    expect(store.loading).toBe(true)
    category.resolve(response({ wallpapers: [item('full')] }))
    await loading
    expect(store.wallpapers[0].id).toBe('full')
  })

  it('空响应或缺少 wallpapers 的分类不能宣称完整成功', async () => {
    vi.mocked(fetchWithRetry).mockImplementation(async url => response(url.includes('index.json') ? index() : {}))
    const store = useWallpaperStore()
    await store.initSeries('desktop')
    expect(store.isDataComplete).toBe(false)
    expect(store.error).toBeTruthy()
    expect(store.currentRenderedSeries).toBe('')
  })

  it('索引声明存在数据但全部分类为空时保留切片，不缓存空的完整结果', async () => {
    vi.mocked(fetchWithRetry).mockImplementation(async url => response(url.includes('index.json')
      ? index()
      : url.includes('latest.json') ? latest() : { wallpapers: [] }))
    const store = useWallpaperStore()
    await store.initSeries('desktop')
    expect(store.wallpapers.map(w => w.id)).toEqual(['new'])
    expect(store.isDataComplete).toBe(false)
    expect(store.backgroundError).toBeTruthy()
  })

  it.each([
    { label: '分类 count', cachedCategory: true, metadata: { total: undefined, categories: [{ file: '景色.json', count: 2 }] } },
    { label: '系列 total', metadata: { total: 2 } },
  ])('$label 表明分类非空但缺项时拒绝完整缓存，修复后可以重新补齐', async ({ metadata, cachedCategory }) => {
    let truncated = true
    vi.mocked(fetchWithRetry).mockImplementation(async url => response(url.includes('index.json')
      ? index(['景色.json'], metadata)
      : url.includes('latest.json')
        ? latest()
        : { wallpapers: truncated ? [item('new')] : [item('new'), item('old', '2026-11-01')] }))
    const store = useWallpaperStore()
    // 收藏查询可能先于索引加载分类，完整校验也必须覆盖已有分类缓存。
    if (cachedCategory)
      await store.loadCategory('desktop', '景色.json')
    await store.initSeries('desktop')
    expect(store.wallpapers.map(w => w.id)).toEqual(['new'])
    expect(store.isDataComplete).toBe(false)
    expect(store.backgroundError).toBeTruthy()
    expect(store.error).toBeNull()

    truncated = false
    await store.initSeries('desktop')
    expect(store.wallpapers.map(w => w.id)).toEqual(['new', 'old'])
    expect(store.isDataComplete).toBe(true)
    expect(store.backgroundError).toBeNull()
  })

  it('补全早于 latest 失败后，稍晚切片仍能解除错误遮罩并保留补全错误', async () => {
    const lateSlice = deferred()
    vi.mocked(fetchWithRetry).mockImplementation(async (url) => {
      if (url.includes('latest.json'))
        return lateSlice.promise
      throw new TypeError('Failed to fetch')
    })
    const store = useWallpaperStore()
    await store.initSeries('desktop')
    expect(store.error).toBeTruthy()
    lateSlice.resolve(response(latest()))
    await flush()
    expect(store.wallpapers.map(w => w.id)).toEqual(['new'])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.backgroundError).toBeTruthy()
    expect(store.isDataComplete).toBe(false)
    expect(store.isBackgroundLoading).toBe(false)
  })

  it('元数据请求超时会结束补齐并保留切片，而不会无限等待', async () => {
    vi.useFakeTimers()
    vi.mocked(fetchWithRetry).mockImplementation(async url => url.includes('latest.json')
      ? response(latest())
      : url.includes('index.json') ? response(index()) : new Promise(() => {}))
    const store = useWallpaperStore()
    const loading = store.initSeries('desktop')
    await flush()
    await vi.advanceTimersByTimeAsync(30000)
    expect(store.isBackgroundLoading).toBe(false)
    expect(store.backgroundError).toBeTruthy()
    expect(store.wallpapers[0].id).toBe('new')
    await loading
  })
})

describe('Bing 渐进加载', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetchWithRetry).mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-09T08:00:00Z'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('Bing 切片按日期转换排序，当前年完整后替换且并发年份请求不重复覆盖', async () => {
    const year = deferred()
    vi.mocked(fetchWithRetry).mockImplementation(async (url) => {
      if (url.includes('latest.json'))
        return response({ items: [bingItem('2026-11-08'), bingItem('2026-11-09')] })
      if (url.includes('index.json'))
        return response({ total: 3, years: [{ year: 2026, file: '2026.json', count: 3 }] })
      return year.promise
    })
    const store = useWallpaperStore()
    const loading = store.initSeries('bing')
    await flush()
    expect(store.wallpapers.map(w => w.id)).toEqual(['bing-2026-11-09', 'bing-2026-11-08'])
    expect(store.wallpapers[0].isBing).toBe(true)
    expect(store.wallpapers[0].thumbnailUrl).toContain('cn.bing.com')
    expect(store.loading).toBe(false)
    expect(store.isDataComplete).toBe(false)
    const yearLoading = store.loadBingYear(2026)
    year.resolve(response({ items: [bingItem('2026-01-01'), bingItem('2026-11-09'), bingItem('2026-11-08')] }))
    await Promise.all([loading, yearLoading])
    expect(store.wallpapers.map(w => w.date)).toEqual(['2026-11-09', '2026-11-08', '2026-01-01'])
    expect(store.isDataComplete).toBe(true)
    expect(fetchWithRetry.mock.calls.filter(([url]) => url.includes('/2026.json'))).toHaveLength(1)

    const cached = store.wallpapers
    vi.mocked(fetchWithRetry).mockImplementation(async url => response(url.includes('index.json')
      ? index()
      : { wallpapers: [item('desktop')] }))
    await store.initSeries('desktop')
    await store.initSeries('bing')
    expect(store.wallpapers).toBe(cached)
    expect(store.isDataComplete).toBe(true)
  })

  it('Bing 年度补全失败仍保留正确转换的切片，不能把该年标记完整', async () => {
    const year = deferred()
    vi.mocked(fetchWithRetry).mockImplementation(async url => url.includes('latest.json')
      ? response({ items: [bingItem('2026-11-09')] })
      : url.includes('index.json')
        ? response({ years: [{ year: 2026, file: '2026.json' }] })
        : year.promise)
    const store = useWallpaperStore()
    const loading = store.initSeries('bing')
    await flush()
    year.reject(new TypeError('Failed to fetch'))
    await loading
    expect(store.wallpapers[0].id).toBe('bing-2026-11-09')
    expect(store.isDataComplete).toBe(false)
    expect(store.loadedCategories.has('2026')).toBe(false)
    expect(store.error).toBeNull()
    expect(store.backgroundError).toBeTruthy()
  })

  it('旧年度请求在刷新后返回不能覆盖新缓存或把其他系列壁纸写进 Bing 缓存', async () => {
    const oldYear = deferred()
    vi.mocked(fetchWithRetry).mockImplementation(async url => url.includes('latest.json')
      ? response({ items: [bingItem('2026-11-01')] })
      : url.includes('index.json')
        ? response({ years: [{ year: 2026, file: '2026.json' }] })
        : oldYear.promise)
    const store = useWallpaperStore()
    const oldLoading = store.initSeries('bing')
    await flush()
    vi.mocked(fetchWithRetry).mockImplementation(async url => response(url.includes('index.json')
      ? { years: [{ year: 2026, file: '2026.json' }] }
      : { items: [bingItem('2026-11-09')] }))
    await store.initSeries('bing', true)
    const fresh = store.wallpapers
    oldYear.resolve(response({ items: [bingItem('2026-11-01')] }))
    await oldLoading
    expect(store.wallpapers).toBe(fresh)
    expect(store.wallpapers[0].date).toBe('2026-11-09')
    await store.initSeries('bing')
    expect(store.wallpapers).toBe(fresh)
  })

  it('Bing 年度文件为空但索引声明有记录时不能缓存为完整', async () => {
    vi.mocked(fetchWithRetry).mockImplementation(async url => response(url.includes('latest.json')
      ? { items: [bingItem('2026-11-09')] }
      : url.includes('index.json')
        ? { years: [{ year: 2026, file: '2026.json', count: 312 }] }
        : { items: [] }))
    const store = useWallpaperStore()
    await store.initSeries('bing')
    expect(store.wallpapers.map(w => w.id)).toEqual(['bing-2026-11-09'])
    expect(store.isDataComplete).toBe(false)
    expect(store.backgroundError).toBeTruthy()
  })

  it('Bing 年度文件非空但缺项时拒绝缓存，修复后重新加载完整年度', async () => {
    let truncated = true
    vi.mocked(fetchWithRetry).mockImplementation(async url => response(url.includes('latest.json')
      ? { items: [bingItem('2026-11-09')] }
      : url.includes('index.json')
        ? { years: [{ year: 2026, file: '2026.json', count: 2 }] }
        : { items: truncated ? [bingItem('2026-11-09')] : [bingItem('2026-11-09'), bingItem('2026-11-08')] }))
    const store = useWallpaperStore()
    await store.initSeries('bing')
    expect(store.isDataComplete).toBe(false)
    expect(store.backgroundError).toBeTruthy()
    expect(store.loadedCategories.has('2026')).toBe(false)
    expect(store.wallpapers.map(w => w.date)).toEqual(['2026-11-09'])

    truncated = false
    await store.initSeries('bing')
    expect(store.wallpapers.map(w => w.date)).toEqual(['2026-11-09', '2026-11-08'])
    expect(store.isDataComplete).toBe(true)
    expect(store.backgroundError).toBeNull()
  })

  it('Bing 补齐期间选择历史年份，最终保留当前年及历史年并共享完整缓存引用', async () => {
    const currentYear = deferred()
    vi.mocked(fetchWithRetry).mockImplementation(async (url) => {
      if (url.includes('latest.json'))
        return response({ items: [bingItem('2026-11-09')] })
      if (url.includes('index.json'))
        return response({ years: [{ year: 2026, file: '2026.json' }, { year: 2025, file: '2025.json' }] })
      return url.includes('2026.json') ? currentYear.promise : response({ items: [bingItem('2025-12-31')] })
    })
    const store = useWallpaperStore()
    const loading = store.initSeries('bing')
    const history = store.loadBingYear(2025)
    currentYear.resolve(response({ items: [bingItem('2026-11-09'), bingItem('2026-01-01')] }))
    await Promise.all([loading, history])
    expect(store.wallpapers.map(w => w.date)).toEqual(['2026-11-09', '2026-01-01', '2025-12-31'])
    const cached = store.wallpapers
    await store.initSeries('bing')
    expect(store.wallpapers).toBe(cached)
    expect(store.loadedCategories.has('2025')).toBe(true)
    expect(store.loadedCategories.has('2026')).toBe(true)
  })

  it('从慢系列切回 Bing 缓存后加载历史年，不等待其他系列的旧请求', async () => {
    const mobileIndex = deferred()
    vi.mocked(fetchWithRetry).mockImplementation(async (url) => {
      if (url.includes('/mobile/index.json'))
        return mobileIndex.promise
      if (url.includes('/mobile/'))
        return response({ wallpapers: [] })
      if (url.includes('latest.json'))
        return response({ items: [bingItem('2026-11-09')] })
      if (url.includes('index.json'))
        return response({ years: [{ year: 2026, file: '2026.json' }, { year: 2025, file: '2025.json' }] })
      return response({ items: [bingItem(url.includes('2026.json') ? '2026-11-09' : '2025-12-31')] })
    })
    const store = useWallpaperStore()
    await store.initSeries('bing')
    const oldLoading = store.initSeries('mobile')
    await store.initSeries('bing')
    const history = store.loadBingYear(2025)
    await flush()
    expect(store.wallpapers.map(w => w.date)).toEqual(['2026-11-09', '2025-12-31'])
    mobileIndex.resolve(response(index()))
    await Promise.all([history, oldLoading])
  })

  it('历史年份加载期间保留已有列表并标记未完成，失败可重试且不污染完整缓存', async () => {
    let historyResponse = deferred()
    vi.mocked(fetchWithRetry).mockImplementation(async (url) => {
      if (url.includes('latest.json'))
        return response({ items: [bingItem('2026-11-09')] })
      if (url.includes('index.json'))
        return response({ years: [{ year: 2026, file: '2026.json' }, { year: 2025, file: '2025.json' }] })
      return url.includes('2026.json') ? response({ items: [bingItem('2026-11-09')] }) : historyResponse.promise
    })
    const store = useWallpaperStore()
    await store.initSeries('bing')
    const cached = store.wallpapers
    const history = store.loadBingYear(2025)
    expect(store.wallpapers).toBe(cached)
    expect(store.isDataComplete).toBe(false)
    expect(store.isBackgroundLoading).toBe(true)
    historyResponse.reject(new TypeError('Failed to fetch'))
    await history
    expect(store.wallpapers).toBe(cached)
    expect(store.isDataComplete).toBe(false)
    expect(store.isBackgroundLoading).toBe(false)
    expect(store.backgroundError).toBeTruthy()
    expect(store.error).toBeNull()
    expect(store.loadedCategories.has('2025')).toBe(false)

    historyResponse = deferred()
    const retry = store.loadBingYear(2025)
    expect(store.isBackgroundLoading).toBe(true)
    historyResponse.resolve(response({ items: [bingItem('2025-12-31')] }))
    await retry
    expect(store.wallpapers.map(w => w.date)).toEqual(['2026-11-09', '2025-12-31'])
    expect(store.isDataComplete).toBe(true)
    expect(store.backgroundError).toBeNull()
  })

  it('多个历史年份并发时等待所有请求，另一年份成功不能清掉失败状态', async () => {
    const year2025 = deferred()
    const year2024 = deferred()
    vi.mocked(fetchWithRetry).mockImplementation(async (url) => {
      if (url.includes('latest.json'))
        return response({ items: [bingItem('2026-11-09')] })
      if (url.includes('index.json'))
        return response({ years: [2026, 2025, 2024].map(year => ({ year, file: `${year}.json` })) })
      if (url.includes('2026.json'))
        return response({ items: [bingItem('2026-11-09')] })
      return url.includes('2025.json') ? year2025.promise : year2024.promise
    })
    const store = useWallpaperStore()
    await store.initSeries('bing')
    const first = store.loadBingYear(2025)
    const second = store.loadBingYear(2024)
    year2025.reject(new TypeError('Failed to fetch'))
    await first
    expect(store.isBackgroundLoading).toBe(true)
    expect(store.isDataComplete).toBe(false)
    expect(store.backgroundError).toBeTruthy()
    year2024.resolve(response({ items: [bingItem('2024-12-31')] }))
    await second
    expect(store.wallpapers.map(w => w.date)).toEqual(['2026-11-09', '2024-12-31'])
    expect(store.isBackgroundLoading).toBe(false)
    expect(store.isDataComplete).toBe(false)
    expect(store.backgroundError).toBeTruthy()
    expect(store.loadedCategories.has('2025')).toBe(false)
    expect(store.loadedCategories.has('2024')).toBe(true)
  })

  it('并发历史年份先成功一个时继续等待，全部完成后才标记完整', async () => {
    const year2025 = deferred()
    const year2024 = deferred()
    vi.mocked(fetchWithRetry).mockImplementation(async (url) => {
      if (url.includes('latest.json'))
        return response({ items: [bingItem('2026-11-09')] })
      if (url.includes('index.json'))
        return response({ years: [2026, 2025, 2024].map(year => ({ year, file: `${year}.json` })) })
      if (url.includes('2026.json'))
        return response({ items: [bingItem('2026-11-09')] })
      return url.includes('2025.json') ? year2025.promise : year2024.promise
    })
    const store = useWallpaperStore()
    await store.initSeries('bing')
    const first = store.loadBingYear(2025)
    const second = store.loadBingYear(2024)
    year2025.resolve(response({ items: [bingItem('2025-12-31')] }))
    await first
    expect(store.isBackgroundLoading).toBe(true)
    expect(store.isDataComplete).toBe(false)
    year2024.resolve(response({ items: [bingItem('2024-12-31')] }))
    await second
    expect(store.wallpapers.map(w => w.date)).toEqual(['2026-11-09', '2025-12-31', '2024-12-31'])
    expect(store.isBackgroundLoading).toBe(false)
    expect(store.isDataComplete).toBe(true)
  })

  it('历史年份仍在请求时切回缓存，旧失败不改变恢复后的完整状态', async () => {
    const historyResponse = deferred()
    vi.mocked(fetchWithRetry).mockImplementation(async (url) => {
      if (url.includes('/desktop/'))
        return response(url.includes('index.json') ? index() : { wallpapers: [item('desktop')] })
      if (url.includes('latest.json'))
        return response({ items: [bingItem('2026-11-09')] })
      if (url.includes('index.json'))
        return response({ years: [2026, 2025].map(year => ({ year, file: `${year}.json` })) })
      return url.includes('2026.json') ? response({ items: [bingItem('2026-11-09')] }) : historyResponse.promise
    })
    const store = useWallpaperStore()
    await store.initSeries('bing')
    const cached = store.wallpapers
    const history = store.loadBingYear(2025)
    await flush()
    await store.initSeries('desktop')
    await store.initSeries('bing')
    expect(store.wallpapers).toBe(cached)
    expect(store.isDataComplete).toBe(true)
    historyResponse.reject(new TypeError('Failed to fetch'))
    await history
    expect(store.wallpapers).toBe(cached)
    expect(store.isDataComplete).toBe(true)
    expect(store.isBackgroundLoading).toBe(false)
    expect(store.backgroundError).toBeNull()
  })

  it('当前年补全失败仍可独立加载健康历史年，年度完整性不把当前年切片误缓存', async () => {
    let failCurrentYear = true
    vi.mocked(fetchWithRetry).mockImplementation(async (url) => {
      if (url.includes('latest.json'))
        return response({ items: [bingItem('2026-11-09')] })
      if (url.includes('index.json'))
        return response({ years: [2026, 2025].map(year => ({ year, file: `${year}.json` })) })
      if (url.includes('2026.json')) {
        if (failCurrentYear)
          throw new TypeError('Failed to fetch')
        return response({ items: [bingItem('2026-11-09'), bingItem('2026-01-01')] })
      }
      return response({ items: [bingItem('2025-12-31')] })
    })
    const store = useWallpaperStore()
    await store.initSeries('bing')
    await store.loadBingYear(2025)
    expect(store.wallpapers.map(w => w.date)).toEqual(['2026-11-09', '2025-12-31'])
    expect(store.isBingYearLoaded(2025)).toBe(true)
    expect(store.isBingYearLoaded(2026)).toBe(false)
    expect(store.isDataComplete).toBe(false)

    failCurrentYear = false
    await store.initSeries('bing')
    expect(store.wallpapers.map(w => w.date)).toEqual(['2026-11-09', '2026-01-01', '2025-12-31'])
    expect(store.isBingYearLoaded(2026)).toBe(true)
    expect(store.isDataComplete).toBe(true)
  })
})
