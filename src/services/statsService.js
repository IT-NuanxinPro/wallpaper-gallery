// ========================================
// 统计服务核心模块（简化版）
// ========================================
// 负责：静态数据加载、RPC 写入

import { createStatsSnapshot, fetchStatsPages, parseStatsSnapshot } from '@/utils/stats/snapshot'
import { normalizeWallpaperFilename } from '@/utils/wallpaper/identity'
import {
  getCachedStats,
  setCachedStats,
} from './localStatsCache'
import { recordWallpaperDownload, recordWallpaperView } from './wallpaperEventService'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// 静态统计文件路径
const STATS_BASE_URL = '/data/stats'

function normalizeStatsImageId(imageId, series) {
  return normalizeWallpaperFilename(imageId, series)
}

/**
 * 检查 Supabase 是否配置
 */
export function isSupabaseConfigured() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY)
}

function parseLegacyStats(data, series) {
  if (!data || typeof data !== 'object' || 'schema' in data)
    throw new Error('统计快照格式无效')

  const stats = new Map()
  const rows = Array.isArray(data)
    ? data
    : Object.entries(data).map(([image_id, value]) => ({ image_id, ...(typeof value === 'number' ? { views: value } : value) }))
  for (const row of rows) {
    const imageId = normalizeStatsImageId(row.image_id, series)
    if (!imageId)
      continue
    const key = `${series}:${imageId}`
    const previous = stats.get(key) || { views: 0, downloads: 0, likes: 0, collects: 0 }
    for (const field of ['views', 'downloads', 'likes', 'collects']) {
      const value = row[field] ?? row[`total_${field}`] ?? 0
      if (!Number.isSafeInteger(value) || value < 0)
        throw new Error('旧版统计字段无效')
      previous[field] += value
    }
    stats.set(key, previous)
  }
  stats.metadata = { schema: 1, exportedAt: null, periodStartedAt: null, periodAvailable: false, stale: true }
  return stats
}

/**
 * 加载完整静态统计快照；旧格式不推测文件名与资源路径的对应关系。
 */
export async function loadStaticStats(series, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCachedStats(series)
    if (cached)
      return cached
  }

  const response = await fetch(`${STATS_BASE_URL}/hot-${series}.json`, {
    cache: forceRefresh ? 'reload' : 'default',
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok)
    throw new Error(`静态统计读取失败: HTTP ${response.status}`)

  const data = await response.json()
  const stats = data?.schema === 2 ? parseStatsSnapshot(data, series) : parseLegacyStats(data, series)
  setCachedStats(series, stats)
  return stats
}

/**
 * 记录预览（异步写入数据库）
 * @param {object} wallpaper - 壁纸对象
 * @param {string} series - 系列名称
 */
export function recordView(wallpaper, series) {
  return recordWallpaperView(wallpaper, series)
}

/**
 * 下载发起后记录事件，登录用户的下载历史由服务端同一事务写入。
 */
export function recordDownload(wallpaper, series) {
  return recordWallpaperDownload(wallpaper, series)
}

/**
 * 点赞/收藏也使用完整分页，避免 REST 默认行数上限截断。
 */
export async function loadLikeCollectCounts(series) {
  const stats = await loadStatsFromSupabase(series)
  return new Map([...stats].map(([key, value]) => [key, { likes: value.likes, collects: value.collects }]))
}

/**
 * 静态文件不可用时，从 Supabase 读取全部统计页。
 */
export async function loadStatsFromSupabase(series, pageSize = 500) {
  if (!isSupabaseConfigured())
    throw new Error('统计服务尚未配置')

  const pageResult = await fetchStatsPages(async (params) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_stats_page`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok)
      throw new Error(`统计读取失败: HTTP ${response.status}`)
    return response.json()
  }, series, pageSize)

  const stats = parseStatsSnapshot(createStatsSnapshot(pageResult), series)
  setCachedStats(series, stats)
  return stats
}
