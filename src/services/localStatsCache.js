// ========================================
// 本地统计缓存管理
// ========================================
// 管理 localStorage 缓存和 sessionStorage 乐观更新队列

const CACHE_PREFIX = 'stats_'
const OPTIMISTIC_KEY = 'stats_optimistic'
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
 * 获取乐观更新队列
 * @returns {object} - { views: { imageId: count }, downloads: { imageId: count } }
 */
export function getOptimisticQueue() {
  try {
    const cached = sessionStorage.getItem(OPTIMISTIC_KEY)
    if (!cached) {
      return { views: {}, downloads: {} }
    }
    return JSON.parse(cached)
  }
  catch (error) {
    console.warn('[LocalStatsCache] 读取乐观队列失败:', error)
    return { views: {}, downloads: {} }
  }
}

/**
 * 增加乐观更新计数
 * @param {string} imageId - 图片 ID
 * @param {'view'|'download'} type - 类型
 */
export function incrementOptimistic(imageId, type) {
  try {
    const queue = getOptimisticQueue()
    const key = type === 'view' ? 'views' : 'downloads'

    if (!queue[key][imageId]) {
      queue[key][imageId] = 0
    }
    queue[key][imageId] += 1

    sessionStorage.setItem(OPTIMISTIC_KEY, JSON.stringify(queue))
  }
  catch (error) {
    console.warn('[LocalStatsCache] 更新乐观队列失败:', error)
  }
}

/**
 * 清除乐观更新队列
 */
export function clearOptimisticQueue() {
  try {
    sessionStorage.removeItem(OPTIMISTIC_KEY)
  }
  catch (error) {
    console.warn('[LocalStatsCache] 清除乐观队列失败:', error)
  }
}

/**
 * 合并静态数据与乐观更新
 * @param {Map} staticStats - 静态统计数据 Map<imageId, {views, downloads}>
 * @returns {Map} - 合并后的统计数据
 */
export function mergeWithOptimistic(staticStats) {
  const queue = getOptimisticQueue()
  const merged = new Map(staticStats)

  // 合并 views
  Object.entries(queue.views).forEach(([imageId, count]) => {
    if (merged.has(imageId)) {
      const current = merged.get(imageId)
      merged.set(imageId, {
        ...current,
        views: (current.views || 0) + count,
      })
    }
    else {
      merged.set(imageId, { views: count, downloads: 0 })
    }
  })

  // 合并 downloads
  Object.entries(queue.downloads).forEach(([imageId, count]) => {
    if (merged.has(imageId)) {
      const current = merged.get(imageId)
      merged.set(imageId, {
        ...current,
        downloads: (current.downloads || 0) + count,
      })
    }
    else {
      merged.set(imageId, { views: 0, downloads: count })
    }
  })

  return merged
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
    clearOptimisticQueue()
  }
  catch (error) {
    console.warn('[LocalStatsCache] 清除所有缓存失败:', error)
  }
}

/**
 * 获取缓存统计信息（调试用）
 */
export function getCacheInfo() {
  const info = {
    series: [],
    optimisticQueue: getOptimisticQueue(),
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_PREFIX)) {
        const series = key.replace(CACHE_PREFIX, '')
        const cached = localStorage.getItem(key)
        if (cached) {
          const { data, timestamp } = JSON.parse(cached)
          const age = Date.now() - timestamp
          info.series.push({
            series,
            count: data.length,
            age: `${Math.round(age / 1000 / 60)} 分钟`,
            expired: age > CACHE_TTL,
          })
        }
      }
    }
  }
  catch (error) {
    console.warn('[LocalStatsCache] 获取缓存信息失败:', error)
  }

  return info
}
