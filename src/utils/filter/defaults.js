export function getCurrentYearMonth(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function getDefaultCategoryFilter(series, date = new Date()) {
  if (series === 'bing') {
    return getCurrentYearMonth(date)
  }

  if (series === 'video') {
    return 'desktop'
  }

  return 'all'
}

export function hasActiveSeriesFilters({
  searchQuery = '',
  formatFilter = 'all',
  resolutionFilter = 'all',
  subcategoryFilter = 'all',
  categoryFilter = 'all',
  currentSeries = '',
  defaultSort = 'newest',
  sortBy = defaultSort,
  date = new Date(),
} = {}) {
  if (searchQuery || formatFilter !== 'all' || resolutionFilter !== 'all' || subcategoryFilter !== 'all') {
    return true
  }

  if (sortBy !== defaultSort) {
    return true
  }

  if (currentSeries === 'video') {
    return false
  }

  return categoryFilter !== getDefaultCategoryFilter(currentSeries, date)
}
