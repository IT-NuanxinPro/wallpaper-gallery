import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFilterStore } from '../src/stores/filter.js'
import { usePopularityStore } from '../src/stores/popularity.js'
import { filterByUploadPeriod } from '../src/utils/filter/uploadPeriod.js'

vi.mock('@/services/statsService', () => ({
  loadStaticStats: vi.fn(),
  loadStatsFromSupabase: vi.fn(),
}))

function wallpaper(filename, createdAt, category = '风景') {
  return { filename, createdAt, category, format: 'jpg' }
}

const now = new Date(2026, 9, 10, 12)
const items = [
  wallpaper('old', new Date(2026, 3, 1)),
  wallpaper('month-start', new Date(2026, 9, 1)),
  wallpaper('last-sunday', new Date(2026, 9, 4, 23, 59, 59)),
  wallpaper('monday', new Date(2026, 9, 5)),
  wallpaper('today', now, '动漫'),
  wallpaper('future', new Date(2026, 9, 11)),
  wallpaper('invalid', 'invalid'),
  wallpaper('missing', undefined),
]

describe('新增壁纸时间范围', () => {
  it('本周包含周一零点和当前时间，排除上周、未来及无效日期', () => {
    expect(filterByUploadPeriod(items, 'weekly-hot', now).map(item => item.filename))
      .toEqual(['monday', 'today'])
  })

  it('本月从一号零点开始，排除以前月份和未来日期', () => {
    expect(filterByUploadPeriod(items, 'monthly-hot', now).map(item => item.filename))
      .toEqual(['month-start', 'last-sunday', 'monday', 'today'])
  })

  it('周日仍属于从前一个周一开始的同一周', () => {
    const sunday = new Date(2026, 9, 11, 12)
    expect(filterByUploadPeriod(items, 'weekly-hot', sunday).map(item => item.filename))
      .toEqual(['monday', 'today', 'future'])
  })

  it('跨年周能包含上年十二月的本周新增壁纸', () => {
    const data = [
      wallpaper('sunday', new Date(2025, 11, 28, 23, 59, 59)),
      wallpaper('monday', new Date(2025, 11, 29)),
      wallpaper('new-year', new Date(2026, 0, 1)),
    ]
    expect(filterByUploadPeriod(data, 'weekly-hot', new Date(2026, 0, 1, 12)).map(item => item.filename))
      .toEqual(['monday', 'new-year'])
  })

  it('非周期排序不限制上传日期', () => {
    expect(filterByUploadPeriod(items, 'popular', now)).toBe(items)
  })
})

describe('热门筛选与排序', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('只在本周新增壁纸中按热度排序，旧图再热门也不能入榜', () => {
    const filter = useFilterStore()
    usePopularityStore().statsMap = new Map([
      ['old', { views: 10000 }],
      ['monday', { views: 10, downloads: 2 }],
      ['today', { views: 1 }],
    ])
    filter.sortBy = 'weekly-hot'
    expect(filter.getFilteredAndSorted(items).map(item => item.filename)).toEqual(['monday', 'today'])
  })

  it('统计加载中也先筛选日期，不能临时回退显示历史壁纸', () => {
    const filter = useFilterStore()
    usePopularityStore().loading = true
    filter.sortBy = 'weekly-hot'
    expect(filter.getFilteredAndSorted(items).map(item => item.filename)).toEqual(['today', 'monday'])
  })

  it('当期没有新增壁纸时返回空列表，不用历史热门补足', () => {
    const filter = useFilterStore()
    filter.sortBy = 'monthly-hot'
    expect(filter.getFilteredAndSorted([items[0]])).toEqual([])
  })

  it('时间范围与分类条件叠加，切回最热门后恢复全部日期', () => {
    const filter = useFilterStore()
    filter.sortBy = 'weekly-hot'
    filter.categoryFilter = '风景'
    expect(filter.getFilteredAndSorted(items).map(item => item.filename)).toEqual(['monday'])
    filter.sortBy = 'popular'
    expect(filter.getFilteredAndSorted(items).some(item => item.filename === 'old')).toBe(true)
  })
})
