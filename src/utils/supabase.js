// ========================================
// Supabase 壁纸统计服务（重构版）
// ========================================
// 统计功能已迁移到 statsService.js
// 此文件保留用于向后兼容，建议直接使用 statsService

import {
  isSupabaseConfigured as checkSupabaseConfigured,
  recordDownload as statsRecordDownload,
  recordView as statsRecordView,
} from '@/services/statsService'

/**
 * 检查 Supabase 是否已配置
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  return checkSupabaseConfigured()
}

/**
 * 记录壁纸预览（打开弹窗查看）
 * @param {object} wallpaper - 壁纸对象
 * @param {string} series - 系列 (desktop/mobile/avatar/bing)
 */
export function recordView(wallpaper, series) {
  statsRecordView(wallpaper, series)
}

/**
 * 记录壁纸下载
 * @param {object} wallpaper - 壁纸对象
 * @param {string} series - 系列 (desktop/mobile/avatar/bing)
 */
export function recordDownload(wallpaper, series) {
  statsRecordDownload(wallpaper, series)
}

// ========================================
// 以下函数已废弃，保留空实现用于向后兼容
// 统计数据现在从静态文件加载，请使用 popularityStore
// ========================================

/**
 * @deprecated 使用 popularityStore.getDownloadCount() 替代
 */
export async function getDownloadStats(_limit = 50) {
  console.warn('[Supabase] getDownloadStats 已废弃，请使用 popularityStore')
  return []
}

/**
 * @deprecated 使用 popularityStore 替代
 */
export async function getPopularWallpapers(_series = 'desktop', _limit = 20) {
  console.warn('[Supabase] getPopularWallpapers 已废弃，请使用 popularityStore')
  return []
}

/**
 * @deprecated 使用 popularityStore.getDownloadCount() 替代
 */
export async function getWallpaperDownloadCount(_filename, _series) {
  console.warn('[Supabase] getWallpaperDownloadCount 已废弃，请使用 popularityStore')
  return 0
}

/**
 * @deprecated 使用 popularityStore.getViewCount() 替代
 */
export async function getWallpaperViewCount(_filename, _series) {
  console.warn('[Supabase] getWallpaperViewCount 已废弃，请使用 popularityStore')
  return 0
}

/**
 * @deprecated 使用 popularityStore 替代
 */
export async function getPopularByTimeRange(_series, _days, _limit = 100) {
  console.warn('[Supabase] getPopularByTimeRange 已废弃，请使用 popularityStore')
  return []
}
