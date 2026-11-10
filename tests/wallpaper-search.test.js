import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSearchSuggestions } from '../src/components/search/composables/useSearchSuggestions.js'
import { useFilterStore } from '../src/stores/filter.js'
import { matchesWallpaperQuery } from '../src/utils/wallpaper/search.js'
import { buildWallpaperAssetKey } from '../src/utils/wallpaper/identity.js'

vi.mock('@/services/statsService', () => ({ loadStaticStats: vi.fn(), loadStatsFromSupabase: vi.fn() }))

const first = { filename: 'same.jpg', path: '/wallpaper/desktop/one/same.jpg', displayTitle: '月光 Forest', category: '插画', subcategory: '极简', tags: ['治愈'], keywords: ['Moon'], description: '安静湖面', format: 'JPG', resolution: { width: 3840, height: 2160 } }
const second = { ...first, path: '/wallpaper/desktop/two/same.jpg', category: '风景', subcategory: '摄影', displayTitle: '森林', tags: ['星空'], keywords: [] }

describe('统一文本搜索契约', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() })
    setActivePinia(createPinia())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('多词 AND 可横跨所有文本字段，统一全角空格和大小写', () => {
    expect(matchesWallpaperQuery(first, 'ＦＯＲＥＳＴ　moon 治愈 极简 安静')).toBe(true)
    expect(matchesWallpaperQuery(first, 'forest 海洋')).toBe(false)
    expect(matchesWallpaperQuery({ title: 123, tags: [null, {}] }, '海洋')).toBe(false)
    expect(matchesWallpaperQuery(first, '  ')).toBe(true)
  })

  it('建议与列表共享标签和多词匹配，精确选择只命中完整资源身份', () => {
    const suggestions = useSearchSuggestions({ modelValue: ref('插画 MOON'), wallpapers: ref([first, second]) }).suggestions.value
    expect(suggestions.map(item => item.exactValue)).toEqual([buildWallpaperAssetKey(first)])
    const store = useFilterStore()
    store.debouncedQuery = '插画 MOON'
    expect(store.applyFilters([first, second])).toEqual([first])
    store.setExactSearch(suggestions[0].label, suggestions[0].exactValue)
    expect(store.applyFilters([first, second])).toEqual([first])
    store.setExactSearch('旧链接', 'same.jpg')
    expect(store.applyFilters([first, second])).toHaveLength(2)
    store.setExactSearch('旧文件名含冒号', 'same:time.jpg')
    expect(store.applyFilters([{ ...first, filename: 'same:time.jpg' }])).toHaveLength(1)
    const bing = { filename: 'bing-2026-01-01.jpg', _series: 'bing', title: '冬日' }
    store.setExactSearch('冬日', buildWallpaperAssetKey(bing))
    expect(store.applyFilters([bing, first])).toEqual([bing])
  })

})
