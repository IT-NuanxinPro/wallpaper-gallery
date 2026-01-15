// ========================================
// 本地统计缓存管理（简化版）
// ========================================
// 仅管理静态数据的 localStorage 缓存

const CACHE_PREFIX = 'stats_'
const CACHE_TTL = 60 * 60 * 1000 // 1 小时

/**
 * 获取缓存的静态统计数据
 * @param {string} series - 系列名称
 * @returns {Map|null} - 统计数据 Map 或 null（缓存过期/不存在）
 */
export function getCachedStats(series) {
  try {
    const key = `${CACHE_PREFIX}${series}`
    const cached = localStorage.getItem(key)
    if (!cached)
      return null

    const { data, timestamp } = JSON.parse(cached)

    // 检查是否过期
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(key)
      return null
    }

    return new Map(data)
  }
  catch (error) {
    console.warn('[LocalStatsCache] 读取缓存失败:', error)
    return null
  }
}

/**
 * 设置静态统计数据缓存
 * @param {string} series - 系列名称
 * @param {Map} statsMap - 统计数据 Map
 */
export function setCachedStats(series, statsMap) {
  try {
    const key = `${CACHE_PREFIX}${series}`
    const data = {
      data: Array.from(statsMap.entries()),
      timestamp: Date.now(),
    }
    localStorage.setItem(key, JSON.stringify(data))
  }
  catch (error) {
    console.warn('[LocalStatsCache] 写入缓存失败:', error)
  }
}

/**
 * 清除指定系列的缓存
 * @param {string} series - 系列名称
 */
export function clearSeriesCache(series) {
  try {
    const key = `${CACHE_PREFIX}${series}`
    localStorage.removeItem(key)
  }
  catch (error) {
    console.warn('[LocalStatsCache] 清除缓存失败:', error)
  }
}

/**
 * 清除所有统计缓存
 */
export function clearAllCache() {
  try {
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  }
  catch (error) {
    console.warn('[LocalStatsCache] 清除所有缓存失败:', error)
  }
}
