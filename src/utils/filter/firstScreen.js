import { getCurrentYearMonth } from './defaults'

// 切片只保证全局最新顺序；其他查询必须等完整数据，避免把局部结果当成全部。
export function canDisplayLatestSlice({
  currentSeries = '',
  sortBy = 'newest',
  searchQuery = '',
  exactSearchValue = '',
  formatFilter = 'all',
  resolutionFilter = 'all',
  categoryFilter = 'all',
  subcategoryFilter = 'all',
}, date = new Date()) {
  if (sortBy !== 'newest' || searchQuery || exactSearchValue
    || formatFilter !== 'all' || resolutionFilter !== 'all' || subcategoryFilter !== 'all') {
    return false
  }
  return categoryFilter === 'all'
    || (currentSeries === 'bing' && categoryFilter === getCurrentYearMonth(date))
}
