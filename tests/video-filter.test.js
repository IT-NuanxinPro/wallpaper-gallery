import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validateBrowseQuery } from '../src/composables/home/useBrowseState.js'
import { useFilterStore } from '../src/stores/filter.js'
import { hasActiveSeriesFilters } from '../src/utils/filter/defaults.js'

vi.mock('@/services/statsService', () => ({ loadStaticStats: vi.fn(), loadStatsFromSupabase: vi.fn() }))

function video(filename, category, createdAt) {
  return {
    filename, category, createdAt, subcategory: '风景', format: 'mp4',
    path: `/wallpaper/video/${category}/${filename}`,
    mediaType: 'video', resolution: { width: 1920, height: 1080 },
  }
}

const desktopOld = video('山林.mp4', 'desktop', '2026-11-01T00:00:00Z')
const desktopNew = video('星空.mp4', 'desktop', '2026-11-10T00:00:00Z')
const mobile = video('手机星空.mp4', 'mobile', '2026-11-11T00:00:00Z')
const social = video('朋友圈.mp4', 'social-cover', '2026-11-11T00:00:00Z')
const videos = [desktopOld, desktopNew, mobile, social]

describe('旧动态浏览 URL 规范化', () => {
  it.each(['all', 'mobile', 'social-cover'])('旧 category=%s 不恢复非电脑用途或隐藏筛选', (category) => {
    const query = { category, subcategory: '风景', format: 'png', resolution: '4K', q: '星空', sort: 'oldest' }
    const categories = ['desktop', 'mobile', 'social-cover'].map(value => ({ value, subcategories: [{ name: '风景' }] }))
    for (const categoriesReady of [false, true]) {
      expect(validateBrowseQuery(query, { series: 'video', categories, categoriesReady })).toMatchObject({
        category: 'desktop', subcategory: 'all', format: 'all', resolution: 'all', q: '星空', sort: 'oldest',
      })
    }
  })

  it('静态手机系列 URL 仍保留合法分类与格式', () => {
    const query = { category: '风景', subcategory: '星空', format: 'png', q: '银河', sort: 'oldest' }
    expect(validateBrowseQuery(query, {
      series: 'mobile', categoriesReady: true, categories: [{ value: '风景', subcategories: [{ name: '星空' }] }],
    })).toMatchObject(query)
  })
})

describe('动态浏览只显示电脑用途', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => 'mobile', setItem: vi.fn(), removeItem: vi.fn() })
    setActivePinia(createPinia())
  })
  afterEach(() => vi.unstubAllGlobals())

  it.each(['all', 'mobile', 'social-cover'])('旧用途 %s 和隐藏筛选不能缩小或扩大电脑列表', (categoryFilter) => {
    const filter = useFilterStore()
    filter.setDefaultSortBySeries('video')
    Object.assign(filter, { categoryFilter, subcategoryFilter: '旧分类', formatFilter: 'PNG', resolutionFilter: '8K' })

    expect(filter.getFilteredAndSorted(videos).map(item => item.filename)).toEqual(['星空.mp4', '山林.mp4'])
    expect(filter.getFilteredAndSorted(videos, { skipCategoryFilter: true }).map(item => item.filename)).toEqual(['星空.mp4', '山林.mp4'])
    expect(videos).toHaveLength(4)
  })

  it('本地旧用途和系列缓存恢复后固定电脑，并保留静态系列筛选', () => {
    const filter = useFilterStore()
    filter.setDefaultSortBySeries('video')
    expect(filter.categoryFilter).toBe('desktop')
    Object.assign(filter, { categoryFilter: 'social-cover', subcategoryFilter: '旧分类', formatFilter: 'PNG', resolutionFilter: '8K' })
    filter.setDefaultSortBySeries('mobile')
    Object.assign(filter, { categoryFilter: '风景', subcategoryFilter: '星空', formatFilter: 'JPG', resolutionFilter: '4K' })
    filter.setDefaultSortBySeries('video')
    expect([filter.categoryFilter, filter.subcategoryFilter, filter.formatFilter, filter.resolutionFilter]).toEqual(['desktop', 'all', 'all', 'all'])
    filter.setDefaultSortBySeries('mobile')
    expect([filter.categoryFilter, filter.subcategoryFilter, filter.formatFilter, filter.resolutionFilter]).toEqual(['风景', '星空', 'JPG', '4K'])
  })

  it('电脑动态壁纸仍按搜索与排序筛选，静态系列继续按分类处理', () => {
    const filter = useFilterStore()
    filter.setDefaultSortBySeries('video')
    filter.sortBy = 'oldest'
    expect(filter.getFilteredAndSorted(videos).map(item => item.filename)).toEqual(['山林.mp4', '星空.mp4'])
    filter.debouncedQuery = '星空'
    expect(filter.getFilteredAndSorted(videos).map(item => item.filename)).toEqual(['星空.mp4'])

    filter.setDefaultSortBySeries('mobile')
    filter.categoryFilter = '风景'
    const staticItems = [{ filename: '手机壁纸.jpg', category: '风景' }, { filename: '头像.jpg', category: '人像' }]
    expect(filter.getFilteredAndSorted(staticItems).map(item => item.filename)).toEqual(['手机壁纸.jpg'])
  })

  it('隐藏的旧动态筛选不显示重置状态，搜索与排序仍显示', () => {
    const staleFilters = { currentSeries: 'video', categoryFilter: 'mobile', subcategoryFilter: '旧分类', formatFilter: 'PNG', resolutionFilter: '8K' }
    expect(hasActiveSeriesFilters(staleFilters)).toBe(false)
    expect(hasActiveSeriesFilters({ ...staleFilters, sortBy: 'popular' })).toBe(true)
    expect(hasActiveSeriesFilters({ ...staleFilters, searchQuery: '星空' })).toBe(true)
    expect(hasActiveSeriesFilters({ ...staleFilters, currentSeries: 'mobile' })).toBe(true)
  })
})
