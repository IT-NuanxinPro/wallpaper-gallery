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
 * 动态构建图片 URL（防止静态分析）
 * @param {string} path - 相对路径，如 /wallpaper/desktop/xxx.png
 * @returns {string} 完整 URL
 */
export function buildImageUrl(path) {
  const { p, h, g, r } = _urlParts
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
 * 检测是否在 Capacitor 原生环境中运行
 * @returns {boolean}
 */
function isNativePlatform() {
  return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()
}

/**
 * 将 Blob 转换为 Base64
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * 显示 Toast 提示
 */
async function showToast(message, type = 'success') {
  try {
    const { useToast } = await import('@/composables/useToast')
    const toast = useToast()
    if (type === 'success') {
      toast.success(message)
    }
    else if (type === 'error') {
      toast.error(message)
    }
    else {
      toast.info(message)
    }
  }
  catch (e) {
    console.warn('[showToast] Toast 显示失败:', e)
  }
}

/**
 * 在原生平台保存文件到相册
 * @param {Blob} blob - 文件 Blob
 * @param {string} filename - 文件名
 */
async function saveFileNative(blob, filename) {
  console.log('[saveFileNative] 开始保存:', filename)

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const base64Data = await blobToBase64(blob)
    console.log('[saveFileNative] Base64 转换完成, 长度:', base64Data.length)

    // 直接保存到 Documents 目录（稳定可靠）
    await Filesystem.writeFile({
      path: `WallpaperGallery/${filename}`,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true,
    })

    console.log('[saveFileNative] 保存成功!')
    await showToast('已保存到 Documents/WallpaperGallery', 'success')
  }
  catch (error) {
    console.error('[saveFileNative] 保存失败:', error)
    await showToast('保存失败，请检查存储权限', 'error')
  }
}

/**
 * 在 Web 平台下载文件
 * @param {Blob} blob - 文件 Blob
 * @param {string} filename - 文件名
 */
function saveFileWeb(blob, filename) {
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(blobUrl)
}

/**
 * 下载文件（带防护机制，支持 Web 和原生平台）
 * @param {string} url - 文件 URL
 * @param {string} filename - 保存的文件名
 * @param {number} delay - 延迟时间（毫秒），默认 300ms
 */
export async function downloadFile(url, filename, delay = 300) {
  // 延迟执行，增加批量下载成本
  await new Promise(resolve => setTimeout(resolve, delay))

  try {
    // 动态重建 URL
    let finalUrl = url

    // 原生平台优先使用 GitHub Raw CDN（国内更稳定）
    if (isNativePlatform()) {
      finalUrl = buildRawImageUrl(url)
    }
    else if (url.includes('@main')) {
      const path = extractPathFromUrl(url)
      finalUrl = buildImageUrl(path)
    }

    console.log('[downloadFile] 开始下载:', finalUrl)

    // 添加超时控制 - 60秒
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    let response = await fetch(finalUrl, { signal: controller.signal })
    clearTimeout(timeoutId)

    // 如果失败，尝试备用 CDN
    if (!response.ok) {
      console.warn('[downloadFile] 主 CDN 失败，尝试备用:', response.status)

      // 切换 CDN
      if (finalUrl.includes('raw.githubusercontent.com')) {
        const path = extractPathFromUrl(url)
        finalUrl = buildImageUrl(path)
      }
      else {
        finalUrl = buildRawImageUrl(url)
      }

      console.log('[downloadFile] 备用 CDN:', finalUrl)

      const controller2 = new AbortController()
      const timeoutId2 = setTimeout(() => controller2.abort(), 60000)
      response = await fetch(finalUrl, { signal: controller2.signal })
      clearTimeout(timeoutId2)

      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`)
      }
    }

    const blob = await response.blob()
    console.log('[downloadFile] 下载完成，大小:', blob.size)

    // 根据平台选择保存方式
    if (isNativePlatform()) {
      await saveFileNative(blob, filename)
    }
    else {
      saveFileWeb(blob, filename)
    }
  }
  catch (error) {
    console.error('[downloadFile] 下载失败:', error.name, error.message)
    // 降级方案
    if (isNativePlatform()) {
      // 原生环境：显示错误提示
      if (error.name === 'AbortError') {
        await showToast('下载超时，请检查网络连接', 'error')
      }
      else {
        await showToast('下载失败，请稍后重试', 'error')
      }
    }
    else {
      // Web 环境：直接打开链接
      window.open(url, '_blank')
    }
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
    // 使用 ghproxy 镜像加速（国内可访问）
    return `https://ghproxy.net/https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/${version}${path}`
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
