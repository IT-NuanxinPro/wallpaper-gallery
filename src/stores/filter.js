import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { debounce } from '@/utils/common/format'
import { sortByDate, sortByDownloads, sortByName, sortByPopularity, sortBySize, sortByViews } from '@/utils/common/sorting'
import { RESOLUTION_THRESHOLDS, STORAGE_KEYS } from '@/utils/config/constants'
import { getDefaultCategoryFilter, hasActiveSeriesFilters } from '@/utils/filter/defaults'
import { usePopularityStore } from './popularity'

export const useFilterStore = defineStore('filter', () => {
  const searchQuery = ref('')
  const debouncedQuery = ref('')
  const exactSearchLabel = ref('')
  const exactSearchValue = ref('')
  const sortBy = ref(localStorage.getItem(STORAGE_KEYS.SORT) || 'newest')
  const formatFilter = ref('all')
  const resolutionFilter = ref('all')
  const categoryFilter = ref(localStorage.getItem(STORAGE_KEYS.CATEGORY) || 'all')
  const subcategoryFilter = ref('all')
  const categoryOptionsCache = ref(null)
  const lastWallpapersLength = ref(0)
  const currentSeriesId = ref('')
  const seriesFilterCache = ref({})

  const popularityStore = usePopularityStore()
  const updateDebouncedQuery = debounce(value => (debouncedQuery.value = value), 300)

  watch(searchQuery, (value) => {
    updateDebouncedQuery(value)

    if (value !== exactSearchLabel.value) {
      exactSearchLabel.value = ''
      exactSearchValue.value = ''
    }
  })
  watch(sortBy, value => localStorage.setItem(STORAGE_KEYS.SORT, value))
  watch(categoryFilter, value => localStorage.setItem(STORAGE_KEYS.CATEGORY, value))

  function createCategoryOptions(wallpapers) {
    if (categoryOptionsCache.value && wallpapers.length === lastWallpapersLength.value) {
      return categoryOptionsCache.value
    }

    const categoryCount = {}
    const subcategoryCount = {}

    wallpapers.forEach((wallpaper) => {
      if (!wallpaper.category)
        return

      categoryCount[wallpaper.category] = (categoryCount[wallpaper.category] || 0) + 1

      if (!wallpaper.subcategory)
        return

      if (!subcategoryCount[wallpaper.category]) {
        subcategoryCount[wallpaper.category] = {}
      }
      subcategoryCount[wallpaper.category][wallpaper.subcategory] = (subcategoryCount[wallpaper.category][wallpaper.subcategory] || 0) + 1
    })

    const sortedCategories = Object.keys(categoryCount)
      .sort((a, b) => (categoryCount[b] || 0) - (categoryCount[a] || 0))

    const result = [
      { value: 'all', label: '全部分类', count: wallpapers.length },
      ...sortedCategories.map((category) => {
        const subcategories = subcategoryCount[category]
          ? Object.entries(subcategoryCount[category])
              .map(([name, count]) => ({ name, count }))
              .sort((a, b) => b.count - a.count)
          : []

        return {
          value: category,
          label: category,
          count: categoryCount[category],
          ...(subcategories.length > 0 && { subcategories }),
        }
      }),
    ]

    categoryOptionsCache.value = result
    lastWallpapersLength.value = wallpapers.length
    return result
  }

  function createSubcategoryOptions(categoryOptions) {
    if (categoryFilter.value === 'all') {
      return [{ value: 'all', label: '全部' }]
    }

    const currentCategory = categoryOptions.find(option => option.value === categoryFilter.value)
    if (!currentCategory?.subcategories?.length) {
      return [{ value: 'all', label: '全部' }]
    }

    return [
      { value: 'all', label: '全部' },
      ...currentCategory.subcategories.map(subcategory => ({
        value: subcategory.name,
        label: `${subcategory.name} (${subcategory.count})`,
      })),
    ]
  }

  function applyFilters(wallpapers, options = {}) {
    const { skipCategoryFilter = false } = options
    let result = [...wallpapers]

    if (exactSearchValue.value) {
      result = result.filter(wallpaper => wallpaper.filename === exactSearchValue.value)
    }
    else if (debouncedQuery.value) {
      const queryTerms = debouncedQuery.value.toLowerCase().split(/\s+/).filter(Boolean)

      result = result.filter((wallpaper) => {
        const searchableTexts = [
          wallpaper.filename?.toLowerCase() || '',
          wallpaper.category?.toLowerCase() || '',
          wallpaper.subcategory?.toLowerCase() || '',
          wallpaper.displayTitle?.toLowerCase() || '',
          wallpaper.title?.toLowerCase() || '',
          wallpaper.description?.toLowerCase() || '',
          wallpaper.copyright?.toLowerCase() || '',
          wallpaper.date?.toLowerCase() || '',
        ]

        if (wallpaper.tags && Array.isArray(wallpaper.tags)) {
          searchableTexts.push(...wallpaper.tags.map(tag => tag.toLowerCase()))
        }

        if (wallpaper.keywords && Array.isArray(wallpaper.keywords)) {
          searchableTexts.push(...wallpaper.keywords.map(keyword => keyword.toLowerCase()))
        }

        return queryTerms.every(term =>
          searchableTexts.some(text => text.includes(term)),
        )
      })
    }

    if (formatFilter.value !== 'all') {
      result = result.filter(wallpaper =>
        wallpaper.format.toLowerCase() === formatFilter.value.toLowerCase(),
      )
    }

    if (resolutionFilter.value !== 'all') {
      result = result.filter((wallpaper) => {
        const maxSide = Math.max(wallpaper.resolution?.width || 0, wallpaper.resolution?.height || 0)
        const matchedThreshold = RESOLUTION_THRESHOLDS.find((threshold, index) => {
          const upperBound = index > 0 ? RESOLUTION_THRESHOLDS[index - 1].minWidth : Number.POSITIVE_INFINITY
          return maxSide >= threshold.minWidth && maxSide < upperBound
        })
        return matchedThreshold?.label === resolutionFilter.value
      })
    }

    if (!skipCategoryFilter && categoryFilter.value !== 'all') {
      result = result.filter(wallpaper => wallpaper.category === categoryFilter.value)
    }

    if (subcategoryFilter.value !== 'all') {
      result = result.filter(wallpaper => wallpaper.subcategory === subcategoryFilter.value)
    }

    return result
  }

  function applySort(wallpapers) {
    const needsPopularity = ['popular', 'downloads', 'views', 'weekly-hot', 'monthly-hot'].includes(sortBy.value)
    if (needsPopularity && popularityStore.loading) {
      return sortByDate(wallpapers, 'desc')
    }

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

  function getFilteredAndSorted(wallpapers, options = {}) {
    return applySort(applyFilters(wallpapers, options))
  }

  function hasActiveFilters(currentSeries = '') {
    return hasActiveSeriesFilters({
      searchQuery: debouncedQuery.value,
      sortBy: sortBy.value,
      formatFilter: formatFilter.value,
      resolutionFilter: resolutionFilter.value,
      categoryFilter: categoryFilter.value,
      subcategoryFilter: subcategoryFilter.value,
      currentSeries,
      defaultSort: 'newest',
    })
  }

  function resetFilters(defaultSort = 'newest', currentSeries = '') {
    clearSearch()
    formatFilter.value = 'all'
    resolutionFilter.value = 'all'
    subcategoryFilter.value = 'all'
    sortBy.value = defaultSort
    categoryFilter.value = getDefaultCategoryFilter(currentSeries)
  }

  function setDefaultSortBySeries(series) {
    switchSeries(series)
    clearSearch()

    if (restoreSeriesFilter(series)) {
      sortBy.value = 'newest'
      return
    }

    sortBy.value = 'newest'
    resolutionFilter.value = 'all'
    formatFilter.value = 'all'
    categoryFilter.value = getDefaultCategoryFilter(series)
    subcategoryFilter.value = 'all'

    if (series === 'bing') {
      localStorage.removeItem(STORAGE_KEYS.CATEGORY)
    }
  }

  function resetSubcategory() {
    subcategoryFilter.value = 'all'
  }

  function clearCategoryCache() {
    categoryOptionsCache.value = null
    lastWallpapersLength.value = 0
  }

  function clearSearch() {
    searchQuery.value = ''
    debouncedQuery.value = ''
    exactSearchLabel.value = ''
    exactSearchValue.value = ''
  }

  function setExactSearch(label, value) {
    exactSearchLabel.value = label
    exactSearchValue.value = value
    searchQuery.value = label
  }

  function clearExactSearch() {
    exactSearchLabel.value = ''
    exactSearchValue.value = ''
  }

  function saveCurrentSeriesFilter() {
    if (!currentSeriesId.value)
      return

    seriesFilterCache.value[currentSeriesId.value] = {
      categoryFilter: categoryFilter.value,
      subcategoryFilter: subcategoryFilter.value,
      resolutionFilter: resolutionFilter.value,
      formatFilter: formatFilter.value,
    }
  }

  function restoreSeriesFilter(seriesId) {
    const cached = seriesFilterCache.value[seriesId]
    if (!cached)
      return false

    categoryFilter.value = cached.categoryFilter
    subcategoryFilter.value = cached.subcategoryFilter
    resolutionFilter.value = cached.resolutionFilter
    formatFilter.value = cached.formatFilter
    return true
  }

  function switchSeries(newSeriesId) {
    saveCurrentSeriesFilter()
    currentSeriesId.value = newSeriesId
    clearCategoryCache()
  }

  return {
    searchQuery,
    debouncedQuery,
    exactSearchValue,
    sortBy,
    formatFilter,
    resolutionFilter,
    categoryFilter,
    subcategoryFilter,
    currentSeriesId,
    createCategoryOptions,
    createSubcategoryOptions,
    applyFilters,
    applySort,
    getFilteredAndSorted,
    hasActiveFilters,
    resetFilters,
    setDefaultSortBySeries,
    resetSubcategory,
    clearCategoryCache,
    clearSearch,
    clearExactSearch,
    switchSeries,
    setExactSearch,
    saveCurrentSeriesFilter,
    restoreSeriesFilter,
  }
})
