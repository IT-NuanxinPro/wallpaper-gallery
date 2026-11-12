import { RESOLUTION_THRESHOLDS } from '../config/constants.js'
import { buildWallpaperAssetKey } from '../wallpaper/identity.js'
import { matchesWallpaperQuery } from '../wallpaper/search.js'

// 已应用条件与弹层草稿共用匹配规则，不修改筛选状态或触发请求。
export function filterWallpapers(wallpapers, filters, { skipCategoryFilter = false } = {}) {
  const isVideoSeries = filters.currentSeries === 'video'
  let result = isVideoSeries
    ? wallpapers.filter(wallpaper => wallpaper.category === 'desktop')
    : [...wallpapers]

  if (filters.exactSearchValue) {
    const exactValue = filters.exactSearchValue
    result = result.filter(wallpaper => /^(?:desktop|mobile|avatar|video|bing):/.test(exactValue)
      ? buildWallpaperAssetKey(wallpaper) === exactValue
      : wallpaper.filename === exactValue)
  }
  else if (filters.searchQuery) {
    result = result.filter(wallpaper => matchesWallpaperQuery(wallpaper, filters.searchQuery))
  }

  if (!isVideoSeries && filters.formatFilter !== 'all') {
    result = result.filter(wallpaper =>
      (wallpaper.format || '').toLowerCase() === filters.formatFilter.toLowerCase(),
    )
  }

  if (!isVideoSeries && filters.resolutionFilter !== 'all') {
    result = result.filter((wallpaper) => {
      const maxSide = Math.max(wallpaper.resolution?.width || 0, wallpaper.resolution?.height || 0)
      const matchedThreshold = RESOLUTION_THRESHOLDS.find((threshold, index) => {
        const upperBound = index > 0 ? RESOLUTION_THRESHOLDS[index - 1].minWidth : Number.POSITIVE_INFINITY
        return maxSide >= threshold.minWidth && maxSide < upperBound
      })
      return matchedThreshold?.label === filters.resolutionFilter
    })
  }

  if (!isVideoSeries && !skipCategoryFilter && filters.categoryFilter !== 'all') {
    result = result.filter(wallpaper => wallpaper.category === filters.categoryFilter)
  }

  if (!isVideoSeries && filters.subcategoryFilter !== 'all') {
    result = result.filter(wallpaper => wallpaper.subcategory === filters.subcategoryFilter)
  }

  return result
}
