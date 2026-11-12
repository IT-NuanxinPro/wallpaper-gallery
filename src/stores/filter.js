import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { debounce } from '@/utils/common/format'
import { sortByDate, sortByDownloads, sortByName, sortByPopularity, sortBySize, sortByViews } from '@/utils/common/sorting'
import { STORAGE_KEYS, VIDEO_USAGE_SHORT_LABELS } from '@/utils/config/constants'
import { getDefaultCategoryFilter, hasActiveSeriesFilters } from '@/utils/filter/defaults'
import { filterWallpapers } from '@/utils/filter/match'
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
    if (!value)
      debouncedQuery.value = ''

    if (value !== exactSearchLabel.value) {
      exactSearchLabel.value = ''
      exactSearchValue.value = ''
    }
  })
  watch(sortBy, value => localStorage.setItem(STORAGE_KEYS.SORT, value))
  watch(categoryFilter, value => localStorage.setItem(STORAGE_KEYS.CATEGORY, value))

  function getCategoryLabel(category, seriesId = currentSeriesId.value) {
    if (seriesId === 'video') {
      return VIDEO_USAGE_SHORT_LABELS[category] || category
    }

    return category
  }

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

    const categoryItems = sortedCategories.map((category) => {
      const subcategories = subcategoryCount[category]
        ? Object.entries(subcategoryCount[category])
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
        : []

      return {
        value: category,
        label: getCategoryLabel(category),
        count: categoryCount[category],
        ...(subcategories.length > 0 && { subcategories }),
      }
    })

    const result = currentSeriesId.value === 'video'
      ? categoryItems
      : [
          { value: 'all', label: '全部分类', count: wallpapers.length },
          ...categoryItems,
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
    return filterWallpapers(wallpapers, {
      currentSeries: currentSeriesId.value,
      searchQuery: debouncedQuery.value,
      exactSearchValue: exactSearchValue.value,
      formatFilter: formatFilter.value,
      resolutionFilter: resolutionFilter.value,
      categoryFilter: categoryFilter.value,
      subcategoryFilter: subcategoryFilter.value,
      ...options.filters,
    }, options)
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
        return sortByPopularity(wallpapers, popularityStore.popularityMap, currentSeriesId.value)
      case 'weekly-hot':
        return sortByPopularity(wallpapers, popularityStore.weeklyPopularityMap, currentSeriesId.value)
      case 'monthly-hot':
        return sortByPopularity(wallpapers, popularityStore.monthlyPopularityMap, currentSeriesId.value)
      case 'downloads':
        return sortByDownloads(wallpapers, popularityStore.popularityMap, currentSeriesId.value)
      case 'views':
        return sortByViews(wallpapers, popularityStore.popularityMap, currentSeriesId.value)
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
    const cached = seriesId === 'video'
      ? { categoryFilter: 'desktop', subcategoryFilter: 'all', resolutionFilter: 'all', formatFilter: 'all' }
      : seriesFilterCache.value[seriesId]
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
    getCategoryLabel,
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
