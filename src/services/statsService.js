// ========================================
// 统计服务核心模块（简化版）
// ========================================
// 负责：静态数据加载、RPC 写入

import {
  getCachedStats,
  setCachedStats,
} from './localStatsCache'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// 静态统计文件路径
const STATS_BASE_URL = '/data/stats'

/**
 * 检查 Supabase 是否配置
 */
export function isSupabaseConfigured() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY)
}

/**
 * 加载静态统计数据
 * @param {string} series - 系列名称
 * @param {boolean} forceRefresh - 是否强制刷新（忽略缓存）
 * @returns {Promise<Map>} - 统计数据 Map<imageId, {views, downloads}>
 */
export async function loadStaticStats(series, forceRefresh = false) {
  // 检查缓存
  if (!forceRefresh) {
    const cached = getCachedStats(series)
    if (cached) {
      if (import.meta.env.DEV) {
        console.log(`[StatsService] 使用缓存数据: ${series}`)
      }
      return cached
    }
  }

  try {
    const url = `${STATS_BASE_URL}/hot-${series}.json`
    const response = await fetch(url)

    if (!response.ok) {
      // 静态文件不存在时返回空 Map（可能还未生成）
      if (response.status === 404) {
        console.warn(`[StatsService] 静态统计文件不存在: ${url}`)
        return new Map()
      }
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    // 转换为 Map
    const statsMap = new Map()
    if (Array.isArray(data)) {
      // 数组格式：[{ image_id, views, downloads }, ...]
      data.forEach((item) => {
        statsMap.set(item.image_id, {
          views: item.views || item.total_views || 0,
          downloads: item.downloads || item.total_downloads || 0,
        })
      })
    }
    else if (typeof data === 'object') {
      // 对象格式：{ image_id: { views, downloads }, ... }
      Object.entries(data).forEach(([imageId, stats]) => {
        if (typeof stats === 'number') {
          // 简化格式：{ image_id: views }
          statsMap.set(imageId, { views: stats, downloads: 0 })
        }
        else {
          statsMap.set(imageId, {
            views: stats.views || stats.total_views || 0,
            downloads: stats.downloads || stats.total_downloads || 0,
          })
        }
      })
    }

    // 写入缓存
    setCachedStats(series, statsMap)

    if (import.meta.env.DEV) {
      console.log(`[StatsService] 加载静态数据: ${series}, ${statsMap.size} 条`)
    }

    return statsMap
  }
  catch (error) {
    console.error(`[StatsService] 加载静态统计失败: ${series}`, error)
    return new Map()
  }
}

/**
 * 记录预览（异步写入数据库）
 * @param {object} wallpaper - 壁纸对象
 * @param {string} series - 系列名称
 */
export function recordView(wallpaper, series) {
  if (!isSupabaseConfigured())
    return

  const imageId = wallpaper.filename || wallpaper.id

  // 异步写入 Supabase（静默失败）
  callRPC('increment_view', {
    img_id: imageId,
    series_name: series,
    cat: wallpaper.category || null,
  }).catch((err) => {
    if (import.meta.env.DEV) {
      console.warn('[StatsService] 写入预览统计失败:', err)
    }
  })
}

/**
 * 记录下载（异步写入数据库）
 * @param {object} wallpaper - 壁纸对象
 * @param {string} series - 系列名称
 */
export function recordDownload(wallpaper, series) {
  if (!isSupabaseConfigured())
    return

  const imageId = wallpaper.filename || wallpaper.id

  // 异步写入 Supabase（静默失败）
  callRPC('increment_download', {
    img_id: imageId,
    series_name: series,
    cat: wallpaper.category || null,
  }).catch((err) => {
    if (import.meta.env.DEV) {
      console.warn('[StatsService] 写入下载统计失败:', err)
    }
  })
}

/**
 * 调用 Supabase RPC 函数
 * @param {string} functionName - 函数名
 * @param {object} params - 参数
 */
async function callRPC(functionName, params) {
  if (!isSupabaseConfigured()) {
    return
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`RPC ${functionName} failed: ${response.status}`)
  }
}

/**
 * 从 Supabase 直接加载热门数据（备用方案，仅在静态文件不可用时使用）
 * @param {string} series - 系列名称
 * @param {number} limit - 返回数量
 * @returns {Promise<Map>}
 */
export async function loadStatsFromSupabase(series, limit = 100) {
  if (!isSupabaseConfigured()) {
    return new Map()
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_hot_stats`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          series_filter: series,
          limit_count: limit,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const statsMap = new Map()

    if (Array.isArray(data)) {
      data.forEach((item) => {
        statsMap.set(item.image_id, {
          views: item.total_views || 0,
          downloads: item.total_downloads || 0,
        })
      })
    }

    // 写入缓存
    setCachedStats(series, statsMap)

    return statsMap
  }
  catch (error) {
    console.error('[StatsService] 从 Supabase 加载统计失败:', error)
    return new Map()
  }
}
