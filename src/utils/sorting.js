// ========================================
// 排序工具函数
// ========================================

/**
 * 按日期排序
 * 日期相同时按文件名排序，确保排序结果稳定
 */
export function sortByDate(wallpapers, order = 'desc') {
  return [...wallpapers].sort((a, b) => {
    const dateA = new Date(a.createdAt)
    const dateB = new Date(b.createdAt)
    const dateDiff = order === 'desc' ? dateB - dateA : dateA - dateB

    // 日期相同时，按文件名排序确保稳定性
    if (dateDiff === 0) {
      return a.filename.localeCompare(b.filename)
    }

    return dateDiff
  })
}

/**
 * 按热度排序（使用预计算的 Map）
 * 热度相同时按日期排序，日期也相同时按文件名排序
 */
export function sortByPopularity(wallpapers, popularityMap) {
  return [...wallpapers].sort((a, b) => {
    const scoreA = popularityMap.get(a.filename)?.score || 0
    const scoreB = popularityMap.get(b.filename)?.score || 0

    // 热度相同时按最新排序
    if (scoreB === scoreA) {
      const dateDiff = new Date(b.createdAt) - new Date(a.createdAt)
      // 日期也相同时按文件名排序
      if (dateDiff === 0) {
        return a.filename.localeCompare(b.filename)
      }
      return dateDiff
    }

    return scoreB - scoreA
  })
}

/**
 * 按下载量排序
 * 下载量相同时按日期排序，日期也相同时按文件名排序
 */
export function sortByDownloads(wallpapers, popularityMap) {
  return [...wallpapers].sort((a, b) => {
    const countA = popularityMap.get(a.filename)?.downloads || 0
    const countB = popularityMap.get(b.filename)?.downloads || 0

    // 下载量相同时按最新排序
    if (countB === countA) {
      const dateDiff = new Date(b.createdAt) - new Date(a.createdAt)
      // 日期也相同时按文件名排序
      if (dateDiff === 0) {
        return a.filename.localeCompare(b.filename)
      }
      return dateDiff
    }

    return countB - countA
  })
}

/**
 * 按浏览量排序
 * 浏览量相同时按日期排序，日期也相同时按文件名排序
 */
export function sortByViews(wallpapers, popularityMap) {
  return [...wallpapers].sort((a, b) => {
    const countA = popularityMap.get(a.filename)?.views || 0
    const countB = popularityMap.get(b.filename)?.views || 0

    // 浏览量相同时按最新排序
    if (countB === countA) {
      const dateDiff = new Date(b.createdAt) - new Date(a.createdAt)
      // 日期也相同时按文件名排序
      if (dateDiff === 0) {
        return a.filename.localeCompare(b.filename)
      }
      return dateDiff
    }

    return countB - countA
  })
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
