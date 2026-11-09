// ========================================
// 排序工具函数
// ========================================

import { getWallpaperIdentity, resolveWallpaperSeries } from '../wallpaper/identity.js'

function compareLatest(a, b, order = 'desc') {
  const dateA = Date.parse(a.createdAt) || 0
  const dateB = Date.parse(b.createdAt) || 0
  const dateDiff = order === 'desc' ? dateB - dateA : dateA - dateB
  return dateDiff || String(a.filename || '').localeCompare(String(b.filename || ''))
    || String(a.path || a._assetKey || '').localeCompare(String(b.path || b._assetKey || ''))
}

/**
 * 按日期排序
 * 日期相同时按文件名排序，确保排序结果稳定
 */
export function sortByDate(wallpapers, order = 'desc') {
  return [...wallpapers].sort((a, b) => compareLatest(a, b, order))
}

function sortByStats(wallpapers, popularityMap, field, series = '') {
  const getStats = wallpaper => popularityMap.get(getWallpaperIdentity(wallpaper, resolveWallpaperSeries(wallpaper, series)).assetKey)
  return [...wallpapers].sort((a, b) => (getStats(b)?.[field] || 0) - (getStats(a)?.[field] || 0) || compareLatest(a, b))
}

/**
 * 统计相同时按最新上传排序；同名资源以原始路径保持稳定顺序。
 */
export function sortByPopularity(wallpapers, popularityMap, series = '') {
  return sortByStats(wallpapers, popularityMap, 'score', series)
}

export function sortByDownloads(wallpapers, popularityMap, series = '') {
  return sortByStats(wallpapers, popularityMap, 'downloads', series)
}

export function sortByViews(wallpapers, popularityMap, series = '') {
  return sortByStats(wallpapers, popularityMap, 'views', series)
}

/**
 * 按大小排序
 * 大小相同时按文件名排序确保稳定性
 */
export function sortBySize(wallpapers, order = 'desc') {
  return [...wallpapers].sort((a, b) => {
    const sizeDiff = order === 'desc' ? b.size - a.size : a.size - b.size

    // 大小相同时按文件名排序
    if (sizeDiff === 0) {
      return a.filename.localeCompare(b.filename)
    }

    return sizeDiff
  })
}

/**
 * 按文件名排序
 */
export function sortByName(wallpapers, order = 'asc') {
  return [...wallpapers].sort((a, b) => {
    return order === 'asc'
      ? a.filename.localeCompare(b.filename)
      : b.filename.localeCompare(a.filename)
  })
}
