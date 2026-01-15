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
