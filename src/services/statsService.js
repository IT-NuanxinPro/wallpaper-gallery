// ========================================
// 统计服务核心模块（简化版）
// ========================================
// 负责：静态数据加载、RPC 写入

import { normalizeWallpaperFilename } from '@/utils/wallpaper/identity'
import {
  getCachedStats,
  setCachedStats,
} from './localStatsCache'
import { recordAuthenticatedDownloadHistory } from './userActivityService'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// 静态统计文件路径
const STATS_BASE_URL = '/data/stats'

function normalizeStatsImageId(imageId, series) {
  return normalizeWallpaperFilename(imageId, series)
}

function mergeStatsEntry(statsMap, imageId, stats, series) {
  const normalizedId = normalizeStatsImageId(imageId, series)
  if (!normalizedId)
    return

  const prev = statsMap.get(normalizedId) || { views: 0, downloads: 0, likes: 0, collects: 0 }
  statsMap.set(normalizedId, {
    views: prev.views + (stats.views || 0),
    downloads: prev.downloads + (stats.downloads || 0),
    likes: prev.likes + (stats.likes || 0),
    collects: prev.collects + (stats.collects || 0),
  })
}

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
  if (series === 'video') {
    return new Map()
  }

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
      // 数组格式：[{ image_id, views, downloads, likes, collects }, ...]
      data.forEach((item) => {
        mergeStatsEntry(statsMap, item.image_id, {
          views: item.views || item.total_views || 0,
          downloads: item.downloads || item.total_downloads || 0,
          likes: item.likes || item.total_likes || 0,
          collects: item.collects || item.total_collects || 0,
        }, series)
      })
    }
    else if (typeof data === 'object') {
      // 对象格式：{ image_id: { views, downloads }, ... }
      Object.entries(data).forEach(([imageId, stats]) => {
        if (typeof stats === 'number') {
          // 简化格式：{ image_id: views }
          mergeStatsEntry(statsMap, imageId, { views: stats, downloads: 0, likes: 0, collects: 0 }, series)
        }
        else {
          mergeStatsEntry(statsMap, imageId, {
            views: stats.views || stats.total_views || 0,
            downloads: stats.downloads || stats.total_downloads || 0,
            likes: stats.likes || stats.total_likes || 0,
            collects: stats.collects || stats.total_collects || 0,
          }, series)
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

  const imageId = normalizeStatsImageId(wallpaper.filename || wallpaper.id, series)

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

  const imageId = normalizeStatsImageId(wallpaper.filename || wallpaper.id, series)

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

  recordAuthenticatedDownloadHistory(wallpaper, series).catch((err) => {
    if (import.meta.env.DEV) {
      console.warn('[StatsService] 写入登录下载历史失败:', err)
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
 * 从 Supabase 加载壁纸的点赞/收藏聚合计数
 * @param {string} series - 系列名称
 * @returns {Promise<Map<string, {likes: number, collects: number}>>}
 */
export async function loadLikeCollectCounts(series) {
  if (!isSupabaseConfigured()) {
    return new Map()
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/image_stats?series=eq.${encodeURIComponent(series)}&or=(total_likes.gt.0,total_collects.gt.0)&select=image_id,total_likes,total_collects`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    )

    if (!response.ok) {
      return new Map()
    }

    const data = await response.json()
    const countsMap = new Map()

    if (Array.isArray(data)) {
      data.forEach((item) => {
        const normalizedId = normalizeStatsImageId(item.image_id, series)
        if (normalizedId) {
          countsMap.set(normalizedId, {
            likes: item.total_likes || 0,
            collects: item.total_collects || 0,
          })
        }
      })
    }

    return countsMap
  }
  catch (error) {
    console.error('[StatsService] 加载点赞/收藏统计失败:', error)
    return new Map()
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
        mergeStatsEntry(statsMap, item.image_id, {
          views: item.total_views || 0,
          downloads: item.total_downloads || 0,
          likes: item.total_likes || 0,
          collects: item.total_collects || 0,
        }, series)
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
