// ========================================
// 筛选和排序管理 Store
// ========================================

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { STORAGE_KEYS } from '@/utils/constants'
import { debounce } from '@/utils/format'
import { sortByDate, sortByDownloads, sortByName, sortByPopularity, sortBySize, sortByViews } from '@/utils/sorting'
import { usePopularityStore } from './popularity'

export const useFilterStore = defineStore('filter', () => {
  // ========================================
  // State
  // ========================================

  // 搜索关键词
  const searchQuery = ref('')
  const debouncedQuery = ref('')

  // 排序方式
  const sortBy = ref(localStorage.getItem(STORAGE_KEYS.SORT) || 'newest')

  // 格式筛选
  const formatFilter = ref('all')

  // 分类筛选（一级分类）
  const categoryFilter = ref(localStorage.getItem(STORAGE_KEYS.CATEGORY) || 'all')

  // 二级分类筛选
  const subcategoryFilter = ref('all')

  // 缓存分类选项（避免频繁重新计算）
  const categoryOptionsCache = ref(null)
  const lastWallpapersLength = ref(0)

  // ========================================
  // Composable Dependencies
  // ========================================

  const popularityStore = usePopularityStore()

  // ========================================
  // Watchers
  // ========================================

  // 防抖处理搜索
  const updateDebouncedQuery = debounce((value) => {
    debouncedQuery.value = value
  }, 300)

  watch(searchQuery, (value) => {
    updateDebouncedQuery(value)
  })

  // 保存排序偏好
  watch(sortBy, (value) => {
    localStorage.setItem(STORAGE_KEYS.SORT, value)
  })

  // 保存分类筛选偏好
  watch(categoryFilter, (value) => {
    localStorage.setItem(STORAGE_KEYS.CATEGORY, value)
  })

  // ========================================
  // Getters (使用工厂函数模式以接收外部数据)
  // ========================================

  /**
   * 创建分类选项（从壁纸数据中提取，带缓存优化）
   */
  function createCategoryOptions(wallpapers) {
    // 如果壁纸数量没有变化，直接返回缓存
    if (categoryOptionsCache.value && wallpapers.length === lastWallpapersLength.value) {
      return categoryOptionsCache.value
    }

    const categoryCount = {}
    const subcategoryCount = {}

    wallpapers.forEach((w) => {
      if (w.category) {
        categoryCount[w.category] = (categoryCount[w.category] || 0) + 1

        if (w.subcategory) {
          if (!subcategoryCount[w.category]) {
            subcategoryCount[w.category] = {}
          }
          subcategoryCount[w.category][w.subcategory] = (subcategoryCount[w.category][w.subcategory] || 0) + 1
        }
      }
    })

    const sortedCategories = Object.keys(categoryCount).sort((a, b) => {
      return (categoryCount[b] || 0) - (categoryCount[a] || 0)
    })

    const result = [
      { value: 'all', label: '全部分类', count: wallpapers.length },
      ...sortedCategories.map((cat) => {
        const subcats = subcategoryCount[cat]
        let subcategories = []

        if (subcats) {
          subcategories = Object.entries(subcats)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
        }

        return {
          value: cat,
          label: cat,
          count: categoryCount[cat],
          ...(subcategories.length > 0 && { subcategories }),
        }
      }),
    ]

    // 更新缓存
    categoryOptionsCache.value = result
    lastWallpapersLength.value = wallpapers.length

    return result
  }

  /**
   * 创建二级分类选项
   */
  function createSubcategoryOptions(categoryOptions) {
    if (categoryFilter.value === 'all') {
      return [{ value: 'all', label: '全部' }]
    }

    const currentCategory = categoryOptions.find(opt => opt.value === categoryFilter.value)
    if (currentCategory?.subcategories?.length > 0) {
      return [
        { value: 'all', label: '全部' },
        ...currentCategory.subcategories.map(sub => ({
          value: sub.name,
          label: `${sub.name} (${sub.count})`,
        })),
      ]
    }

    return [{ value: 'all', label: '全部' }]
  }

  /**
   * 应用筛选条件
   */
  function applyFilters(wallpapers) {
    let result = [...wallpapers]

    // 搜索过滤
    if (debouncedQuery.value) {
      const query = debouncedQuery.value.toLowerCase()
      result = result.filter(w =>
        w.filename.toLowerCase().includes(query)
        || w.category?.toLowerCase().includes(query)
        || w.subcategory?.toLowerCase().includes(query)
        || (w.tags && w.tags.some(tag => tag.toLowerCase().includes(query))),
      )
    }

    // 格式过滤
    if (formatFilter.value !== 'all') {
      result = result.filter(w =>
        w.format.toLowerCase() === formatFilter.value.toLowerCase(),
      )
    }

    // 一级分类过滤
    if (categoryFilter.value !== 'all') {
      result = result.filter(w =>
        w.category === categoryFilter.value,
      )
    }

    // 二级分类过滤
    if (subcategoryFilter.value !== 'all') {
      result = result.filter(w =>
        w.subcategory === subcategoryFilter.value,
      )
    }

    return result
  }

  /**
   * 应用排序
   */
  function applySort(wallpapers) {
    switch (sortBy.value) {
      case 'newest':
        return sortByDate(wallpapers, 'desc')
      case 'oldest':
        return sortByDate(wallpapers, 'asc')
      case 'popular':
        return sortByPopularity(wallpapers, popularityStore.popularityMap)
      case 'downloads':
        return sortByDownloads(wallpapers, popularityStore.popularityMap)
      case 'views':
        return sortByViews(wallpapers, popularityStore.popularityMap)
      case 'weekly-hot':
        return sortByPopularity(wallpapers, popularityStore.weeklyMap.size > 0 ? popularityStore.weeklyMap : popularityStore.popularityMap)
      case 'monthly-hot':
        return sortByPopularity(wallpapers, popularityStore.monthlyMap.size > 0 ? popularityStore.monthlyMap : popularityStore.popularityMap)
      case 'largest':
        return sortBySize(wallpapers, 'desc')
      case 'smallest':
        return sortBySize(wallpapers, 'asc')
      case 'name-asc':
        return sortByName(wallpapers, 'asc')
      case 'name-desc':
        return sortByName(wallpapers, 'desc')
      default:
        return wallpapers
    }
  }

  /**
   * 获取筛选和排序后的结果（组合函数）
   */
  function getFilteredAndSorted(wallpapers) {
    const filtered = applyFilters(wallpapers)
    return applySort(filtered)
  }

  // ========================================
  // Actions
  // ========================================

  /**
   * 检查是否有激活的筛选条件
   */
  function hasActiveFilters() {
    return debouncedQuery.value
      || formatFilter.value !== 'all'
      || categoryFilter.value !== 'all'
      || subcategoryFilter.value !== 'all'
  }

  /**
   * 重置所有筛选条件
   */
  function resetFilters(defaultSort = 'newest') {
    searchQuery.value = ''
    debouncedQuery.value = ''
    formatFilter.value = 'all'
    categoryFilter.value = 'all'
    subcategoryFilter.value = 'all'
    sortBy.value = defaultSort
  }

  /**
   * 根据系列设置默认排序
   */
  function setDefaultSortBySeries(_series) {
    // 所有系列默认使用最新优先
    const defaultSort = 'newest'
    sortBy.value = defaultSort
  }

  /**
   * 重置二级分类（当一级分类改变时）
   */
  function resetSubcategory() {
    subcategoryFilter.value = 'all'
  }

  /**
   * 清除分类选项缓存
   */
  function clearCategoryCache() {
    categoryOptionsCache.value = null
    lastWallpapersLength.value = 0
  }

  return {
    // State
    searchQuery,
    debouncedQuery,
    sortBy,
    formatFilter,
    categoryFilter,
    subcategoryFilter,
    // Helpers
    createCategoryOptions,
    createSubcategoryOptions,
    applyFilters,
    applySort,
    getFilteredAndSorted,
    // Actions
    hasActiveFilters,
    resetFilters,
    setDefaultSortBySeries,
    resetSubcategory,
    clearCategoryCache,
  }
})
