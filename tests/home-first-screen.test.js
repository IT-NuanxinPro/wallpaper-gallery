import { createRenderer, nextTick, reactive, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useHomeDataLoader } from '../src/composables/home/useHomeDataLoader.js'
import { canDisplayLatestSlice } from '../src/utils/filter/firstScreen.js'

describe('最新切片的展示范围', () => {
  it('最新默认列表允许先展示切片，筛选和其他排序需要完整数据', () => {
    expect(canDisplayLatestSlice({ currentSeries: 'desktop' })).toBe(true)
    for (const filter of [
      { categoryFilter: '风景' },
      { formatFilter: 'PNG' },
      { resolutionFilter: '4K' },
      { subcategoryFilter: '日落' },
      { searchQuery: '森林' },
      { exactSearchValue: 'forest.jpg' },
      { sortBy: 'oldest' },
    ]) {
      expect(canDisplayLatestSlice({ currentSeries: 'desktop', ...filter })).toBe(false)
    }
  })

  it('Bing 当前月份可先显示最新日期，其他月份和视频用途筛选等待完整数据', () => {
    expect(canDisplayLatestSlice({ currentSeries: 'bing', categoryFilter: '2026-11' }, new Date(2026, 10, 9))).toBe(true)
    expect(canDisplayLatestSlice({ currentSeries: 'bing', categoryFilter: '2026-10' }, new Date(2026, 10, 9))).toBe(false)
    expect(canDisplayLatestSlice({ currentSeries: 'video', categoryFilter: 'desktop' })).toBe(false)
  })
})

const renderer = createRenderer({
  createComment: () => ({}), createText: () => ({}), createElement: () => ({}),
  insert: () => {}, remove: () => {}, setText: () => {}, setElementText: () => {},
  patchProp: () => {}, parentNode: () => null, nextSibling: () => null,
})

describe('首页加载遮罩', () => {
  let app
  afterEach(() => app?.unmount())

  it('完整数据请求仍未结束时，当前系列切片就绪即可解除遮罩', async () => {
    let finish
    const store = reactive({
      loading: true,
      error: null,
      currentRenderedSeries: '',
      initSeries: vi.fn(() => new Promise(resolve => { finish = resolve })),
    })
    let loader
    app = renderer.createApp({
      setup() {
        loader = useHomeDataLoader({
          currentSeries: ref('desktop'), showMobileSeriesNotice: ref(false),
          filterStore: { setDefaultSortBySeries: vi.fn() },
          hotTagsStore: { fetchHotTags: vi.fn().mockResolvedValue([]) },
          popularityStore: { fetchPopularityData: vi.fn().mockResolvedValue([]) },
          seriesStore: { currentSeries: 'desktop' }, syncSeriesFromRoute: vi.fn(),
          wallpaperStore: store,
        })
        return () => null
      },
    })
    app.mount({})
    await nextTick()
    expect(loader.loading.value).toBe(true)
    store.currentRenderedSeries = 'desktop'
    store.loading = false
    await nextTick()
    expect(loader.loading.value).toBe(false)
    finish()
  })

  it('刷新 Bing 保留历史月份筛选时重新补齐选中年份', async () => {
    const loadBingYear = vi.fn().mockResolvedValue(undefined)
    const filterStore = reactive({ categoryFilter: '2025-12', setDefaultSortBySeries: vi.fn() })
    let loader
    app = renderer.createApp({
      setup() {
        loader = useHomeDataLoader({
          currentSeries: ref('bing'), showMobileSeriesNotice: ref(false), filterStore,
          hotTagsStore: { fetchHotTags: vi.fn().mockResolvedValue([]) },
          popularityStore: { fetchPopularityData: vi.fn().mockResolvedValue([]) },
          seriesStore: { currentSeries: 'bing' }, syncSeriesFromRoute: vi.fn(),
          wallpaperStore: { initSeries: vi.fn().mockResolvedValue(undefined), loadBingYear, loading: false },
        })
        return () => null
      },
    })
    app.mount({})
    await nextTick()
    loadBingYear.mockClear()
    await loader.loadSeriesData('bing', true)
    expect(loadBingYear).toHaveBeenCalledWith(2025)
  })
})
