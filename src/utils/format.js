// ========================================
// 格式化工具函数
// ========================================

import { CDN_VERSION, RESOLUTION_THRESHOLDS, SERIES_CONFIG } from '@/utils/constants'

// URL 构建器（运行时动态拼接，防止静态分析提取完整 URL）
const _urlParts = {
  p: 'https://',
  h: 'cdn.jsdelivr.net',
  g: '/gh/IT-NuanxinPro',
  r: `/nuanXinProPic@${CDN_VERSION}`,
}

/**
 * 动态构建图片 URL（支持 cdnTag 缓存优化）
 * @param {string} path - 相对路径，如 /wallpaper/desktop/xxx.png
 * @param {string} [cdnTag] - 可选的 CDN tag (用于精准缓存控制)
 * @returns {string} 完整 URL
 *
 * @example
 * // 使用默认 CDN_VERSION
 * buildImageUrl('/wallpaper/desktop/xxx.png')
 *
 * // 使用图片专属 tag (推荐)
 * buildImageUrl('/wallpaper/desktop/xxx.png', 'v1.0.5')
 */
export function buildImageUrl(path, cdnTag) {
  const { p, h, g } = _urlParts
  const tag = cdnTag || CDN_VERSION
  const r = `/nuanXinProPic@${tag}`
  return `${p}${h}${g}${r}${path}`
}

/**
 * 从完整 URL 提取路径部分
 * @param {string} url - 完整 URL
 * @returns {string} 路径部分
 */
export function extractPathFromUrl(url) {
  if (!url)
    return ''
  const marker = '@main'
  const idx = url.indexOf(marker)
  if (idx === -1)
    return url
  return url.slice(idx + marker.length)
}

/**
 * 根据真实分辨率获取标签
 * @param {number} width - 图片宽度
 * @param {number} height - 图片高度
 * @returns {object} { width, height, label, type }
 */
export function getResolutionLabel(width, height) {
  const maxSide = Math.max(width, height) // 取长边判断
  for (const threshold of RESOLUTION_THRESHOLDS) {
    if (maxSide >= threshold.minWidth) {
      return {
        width,
        height,
        label: threshold.label,
        type: threshold.type,
      }
    }
  }
  return { width, height, label: '标清', type: 'secondary' }
}

/**
 * 格式化数字（如 1.2k）
 * @param {number} num - 数字
 * @returns {string} 格式化后的数字字符串
 */
export function formatNumber(num) {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小字符串
 */
export function formatFileSize(bytes) {
  if (bytes === 0)
    return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${units[i]}`
}

/**
 * 格式化日期
 * @param {string|number|Date} date - 日期
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 格式化相对时间
 * @param {string|number|Date} date - 日期
 * @returns {string} 相对时间字符串
 */
export function formatRelativeTime(date) {
  const now = new Date()
  const d = new Date(date)
  const diff = now - d

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (years > 0)
    return `${years} 年前`
  if (months > 0)
    return `${months} 个月前`
  if (days > 0)
    return `${days} 天前`
  if (hours > 0)
    return `${hours} 小时前`
  if (minutes > 0)
    return `${minutes} 分钟前`
  return '刚刚'
}

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 扩展名（小写）
 */
export function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase()
}

/**
 * 防抖函数
 * @param {Function} fn - 要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export function debounce(fn, delay = 300) {
  let timer = null
  return function (...args) {
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

/**
 * 高亮文本中的关键词
 * @param {string} text - 原始文本
 * @param {string} keyword - 要高亮的关键词
 * @returns {Array<{text: string, highlight: boolean}>} 分段数组
 */
export function highlightText(text, keyword) {
  if (!keyword || !text) {
    return [{ text, highlight: false }]
  }

  // 转义正则特殊字符
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  return parts.filter(Boolean).map(part => ({
    text: part,
    highlight: part.toLowerCase() === keyword.toLowerCase(),
  }))
}

/**
 * 获取显示用的文件名（去除分类前缀和文件后缀）
 * @param {string} filename - 原始文件名，格式：分类--名称.扩展名
 * @returns {string} 显示名称，格式：名称（不含后缀）
 * @example
 * getDisplayFilename('动漫--刀剑神域_亚丝娜.jpg') // '刀剑神域_亚丝娜'
 * getDisplayFilename('风景_山水.png') // '风景_山水'
 */
export function getDisplayFilename(filename) {
  if (!filename)
    return ''
  const separator = '--'
  const index = filename.indexOf(separator)
  // 去除分类前缀
  let name = index === -1 ? filename : filename.slice(index + separator.length)
  // 去除文件后缀
  const lastDotIndex = name.lastIndexOf('.')
  if (lastDotIndex > 0) {
    name = name.slice(0, lastDotIndex)
  }
  return name
}

/**
 * 下载文件
 * @param {string} url - 文件 URL
 * @param {string} filename - 保存的文件名
 */
export async function downloadFile(url, filename) {
  // 动态重建 URL（如果是 CDN 链接）
  let finalUrl = url
  if (url.includes('@main')) {
    const path = extractPathFromUrl(url)
    finalUrl = buildImageUrl(path)
  }

  const response = await fetch(finalUrl)

  // 如果 CDN 返回 403 或 404，回退到 GitHub Raw CDN
  if (!response.ok || response.status === 403 || response.status === 404) {
    console.warn('[downloadFile] CDN 失败，回退到 GitHub Raw CDN:', response.status)
    finalUrl = buildRawImageUrl(finalUrl)
    const fallbackResponse = await fetch(finalUrl)

    if (!fallbackResponse.ok) {
      throw new Error(`GitHub Raw CDN 失败: ${fallbackResponse.status}`)
    }

    const blob = await fallbackResponse.blob()
    const blobUrl = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  }
  else {
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  }
}

/**
 * 构建 GitHub Raw CDN URL（无大小限制）
 * @param {string} cdnUrl - jsDelivr CDN URL
 * @returns {string} GitHub Raw CDN URL
 */
export function buildRawImageUrl(cdnUrl) {
  // 从 jsDelivr URL 提取路径
  // 示例: https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.1.14/wallpaper/...
  const match = cdnUrl.match(/\/gh\/IT-NuanxinPro\/nuanXinProPic@([^/]+)(\/.*)/)
  if (match) {
    const version = match[1]
    const path = match[2]
    return `https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/${version}${path}`
  }
  return cdnUrl
}

// ========================================
// Bing 壁纸专用函数
// ========================================

/**
 * 构建 Bing 缩略图 URL
 * @param {string} urlbase - Bing urlbase，如 /th?id=OHR.xxx_EN-US123
 * @returns {string} 缩略图 URL（400x240）
 */
export function buildBingThumbnailUrl(urlbase) {
  if (!urlbase)
    return ''
  const bingCdnBase = SERIES_CONFIG.bing?.bingCdnBase || 'https://www.bing.com'
  return `${bingCdnBase}${urlbase}_400x240.jpg`
}

/**
 * 构建 Bing 预览图 URL
 * @param {string} urlbase - Bing urlbase，如 /th?id=OHR.xxx_EN-US123
 * @returns {string} 预览图 URL（1920x1080）
 */
export function buildBingPreviewUrl(urlbase) {
  if (!urlbase)
    return ''
  const bingCdnBase = SERIES_CONFIG.bing?.bingCdnBase || 'https://www.bing.com'
  return `${bingCdnBase}${urlbase}_1920x1080.jpg`
}

/**
 * 构建 Bing UHD 原图 URL（直接使用 Bing CDN）
 * Bing 图片链接永久有效，无需本地存储
 * @param {string} urlbase - Bing urlbase，如 /th?id=OHR.xxx_ZH-CN123
 * @returns {string} UHD 原图 URL
 */
export function buildBingUHDUrl(urlbase) {
  if (!urlbase)
    return ''
  const bingCdnBase = SERIES_CONFIG.bing?.bingCdnBase || 'https://cn.bing.com'
  return `${bingCdnBase}${urlbase}_UHD.jpg`
}

/**
 * 格式化 Bing 壁纸日期显示（卡片简洁版）
 * @param {string} date - 日期字符串，如 2025-01-01
 * @returns {string} 格式化后的日期，如 25年1月1日
 */
export function formatBingDate(date) {
  if (!date)
    return ''
  const d = new Date(date)
  const year = d.getFullYear() % 100 // 取后两位，如 2025 -> 25
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${year}年${month}月${day}日`
}

/**
 * 格式化 Bing 壁纸完整日期显示
 * @param {string} date - 日期字符串，如 2025-01-01
 * @returns {string} 格式化后的日期，如 2025年1月1日
 */
export function formatBingFullDate(date) {
  if (!date)
    return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${year}年${month}月${day}日`
}
