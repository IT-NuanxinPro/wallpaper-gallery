// ========================================
// 筛选和排序管理 Store
// ========================================

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { RESOLUTION_THRESHOLDS, STORAGE_KEYS } from '@/utils/constants'
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

  // 分辨率筛选（仅 PC 端电脑壁纸系列）
  const resolutionFilter = ref('all')

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
   * @param {Array} wallpapers - 壁纸列表
   * @param {object} options - 选项
   * @param {boolean} options.skipCategoryFilter - 是否跳过分类筛选（筛选模式下使用）
   */
  function applyFilters(wallpapers, options = {}) {
    const { skipCategoryFilter = false } = options
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

    // 分辨率过滤（精确匹配：根据长边判断所属分辨率等级）
    if (resolutionFilter.value !== 'all') {
      result = result.filter((w) => {
        const maxSide = Math.max(w.resolution?.width || 0, w.resolution?.height || 0)
        // 找到壁纸所属的分辨率等级（精确匹配区间）
        const matchedThreshold = RESOLUTION_THRESHOLDS.find((t, i) => {
          const upperBound = i > 0 ? RESOLUTION_THRESHOLDS[i - 1].minWidth : Number.POSITIVE_INFINITY
          return maxSide >= t.minWidth && maxSide < upperBound
        })
        return matchedThreshold?.label === resolutionFilter.value
      })
    }

    // 一级分类过滤（筛选模式下跳过，因为数据已经是该分类的）
    if (!skipCategoryFilter && categoryFilter.value !== 'all') {
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
   * @param {Array} wallpapers - 壁纸列表
   * @param {object} options - 选项
   * @param {boolean} options.skipCategoryFilter - 是否跳过分类筛选（筛选模式下使用）
   */
  function getFilteredAndSorted(wallpapers, options = {}) {
    const filtered = applyFilters(wallpapers, options)
    return applySort(filtered)
  }

  // ========================================
  // Actions
  // ========================================

  /**
   * 获取当前年月字符串（用于 Bing 系列默认值判断）
   */
  function getCurrentYearMonth() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  /**
   * 检查是否有激活的筛选条件
   * @param {string} currentSeries - 当前系列（可选，用于判断 Bing 系列默认值）
   */
  function hasActiveFilters(currentSeries = '') {
    if (debouncedQuery.value)
      return true
    if (formatFilter.value !== 'all')
      return true
    if (resolutionFilter.value !== 'all')
      return true
    if (subcategoryFilter.value !== 'all')
      return true

    // Bing 系列：当前年月是默认值，不算激活
    if (currentSeries === 'bing') {
      const defaultMonth = getCurrentYearMonth()
      if (categoryFilter.value !== defaultMonth) {
        return true
      }
    }
    else {
      // 其他系列：all 是默认值
      if (categoryFilter.value !== 'all') {
        return true
      }
    }

    return false
  }

  /**
   * 重置所有筛选条件
   * @param {string} defaultSort - 默认排序
   * @param {string} currentSeries - 当前系列（可选，用于设置 Bing 系列默认值）
   */
  function resetFilters(defaultSort = 'newest', currentSeries = '') {
    searchQuery.value = ''
    debouncedQuery.value = ''
    formatFilter.value = 'all'
    resolutionFilter.value = 'all'
    subcategoryFilter.value = 'all'
    sortBy.value = defaultSort

    // Bing 系列重置为当前年月
    if (currentSeries === 'bing') {
      categoryFilter.value = getCurrentYearMonth()
    }
    else {
      categoryFilter.value = 'all'
    }
  }

  /**
   * 根据系列设置默认排序和筛选
   */
  function setDefaultSortBySeries(series) {
    // 所有系列默认使用最新优先
    const defaultSort = 'newest'
    sortBy.value = defaultSort

    // Bing 系列默认加载当前年月（不从 localStorage 恢复）
    if (series === 'bing') {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      categoryFilter.value = `${year}-${month}`
      // 清除 localStorage 中的分类，避免下次恢复旧值
      localStorage.removeItem(STORAGE_KEYS.CATEGORY)
    }
    else {
      // 其他系列从 localStorage 恢复或使用默认值
      const savedCategory = localStorage.getItem(STORAGE_KEYS.CATEGORY)
      // 如果保存的是日期格式（Bing 的），则重置为 all
      if (savedCategory && /^\d{4}-\d{2}$/.test(savedCategory)) {
        categoryFilter.value = 'all'
      }
      else {
        categoryFilter.value = savedCategory || 'all'
      }
    }
    subcategoryFilter.value = 'all'
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
    resolutionFilter,
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
