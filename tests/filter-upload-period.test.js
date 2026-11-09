import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFilterStore } from '../src/stores/filter.js'
import { usePopularityStore } from '../src/stores/popularity.js'
import { filterByUploadPeriod } from '../src/utils/filter/uploadPeriod.js'

vi.mock('@/services/statsService', () => ({ loadStaticStats: vi.fn(), loadStatsFromSupabase: vi.fn() }))

function wallpaper(filename, createdAt, category = '风景') {
  return { filename, path: `/wallpaper/desktop/${filename}.jpg`, createdAt, category, format: 'jpg' }
}

const old = wallpaper('old', '2026-04-01T00:00:00Z')
const monday = wallpaper('monday', '2026-11-09T00:00:00Z')
const today = wallpaper('today', '2026-11-10T00:00:00Z', '动漫')
const items = [old, monday, today]

describe('期间热门筛选与排序', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
    setActivePinia(createPinia())
    const store = usePopularityStore()
    store.currentSeries = 'desktop'
    store.statsMetadata = { schema: 2, periodAvailable: true, weekAvailable: true, monthAvailable: true }
    store.statsMap = new Map([
      ['desktop:path:/wallpaper/desktop/old.jpg', { views: 100, week_views: 10, month_views: 10 }],
      ['desktop:path:/wallpaper/desktop/monday.jpg', { views: 10000, week_views: 1, month_views: 20 }],
      ['desktop:path:/wallpaper/desktop/today.jpg', { views: 0, week_views: 0, month_views: 0 }],
    ])
    useFilterStore().currentSeriesId = 'desktop'
  })

  afterEach(() => vi.unstubAllGlobals())

  it('旧图当周发生互动即可上榜，累计热度不影响期间顺序', () => {
    const filter = useFilterStore()
    filter.sortBy = 'weekly-hot'
    expect(filter.getFilteredAndSorted(items).map(item => item.filename)).toEqual(['old', 'monday', 'today'])
    filter.sortBy = 'monthly-hot'
    expect(filter.getFilteredAndSorted(items).map(item => item.filename)).toEqual(['monday', 'old', 'today'])
  })

  it('统计加载中及期间分数全零时稳定回退最新，保留全部日期', () => {
    const filter = useFilterStore()
    const store = usePopularityStore()
    filter.sortBy = 'weekly-hot'
    store.loading = true
    expect(filter.getFilteredAndSorted(items).map(item => item.filename)).toEqual(['today', 'monday', 'old'])
    store.loading = false
    store.statsMetadata.weekAvailable = false
    expect(filter.getFilteredAndSorted(items).map(item => item.filename)).toEqual(['today', 'monday', 'old'])
  })

  it('期间榜与分类条件叠加，上传时间筛选不再处理周/月热门', () => {
    const filter = useFilterStore()
    filter.sortBy = 'weekly-hot'
    filter.categoryFilter = '风景'
    expect(filter.getFilteredAndSorted(items).map(item => item.filename)).toEqual(['old', 'monday'])
    expect(filterByUploadPeriod(items, 'weekly-hot')).toBe(items)
    expect(filterByUploadPeriod(items, 'monthly-hot')).toBe(items)
  })
})
