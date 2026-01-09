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
 * 检测是否为 Android 平台
 * @returns {boolean}
 */
function isAndroid() {
  return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.getPlatform() === 'android'
}

/**
 * 获取或创建相册，返回 albumIdentifier（Android 必需）
 * @param {string} albumName - 相册名称
 * @returns {Promise<string|undefined>} albumIdentifier（仅 Android 返回）
 */
async function getOrCreateAlbumIdentifier(albumName) {
  if (!isAndroid()) {
    return undefined // iOS 不需要 albumIdentifier
  }

  try {
    const { Media } = await import('@capacitor-community/media')

    // 先尝试获取已存在的相册
    const albums = await Media.getAlbums()
    const existingAlbum = albums.albums.find(a => a.name === albumName)

    if (existingAlbum) {
      console.log('[getOrCreateAlbumIdentifier] 找到已存在的相册:', existingAlbum.identifier)
      return existingAlbum.identifier
    }

    // 创建新相册
    const result = await Media.createAlbum({ name: albumName })
    console.log('[getOrCreateAlbumIdentifier] 创建新相册:', result.identifier)
    return result.identifier
  }
  catch (error) {
    console.error('[getOrCreateAlbumIdentifier] 获取/创建相册失败:', error)
    throw error
  }
}

/**
 * 检测是否为 PWA 环境（standalone 模式）
 * @returns {boolean}
 */
function isPWA() {
  if (typeof window === 'undefined')
    return false

  // 检测 standalone 模式（iOS Safari 和 Android Chrome）
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    return true

  // 检测 navigator.standalone（iOS Safari 旧版）
  if (window.navigator.standalone === true)
    return true

  // 检测是否在 PWA 中（通过 user agent 和 window 特性）
  if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches)
    return true

  return false
}

/**
 * 检测是否为移动设备
 * @returns {boolean}
 */
function isMobileDevice() {
  if (typeof navigator === 'undefined')
    return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
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
    if (isNativePlatform()) {
      const { Toast } = await import('@capacitor/toast')
      await Toast.show({
        text: message,
        duration: type === 'error' ? 'long' : 'short',
      })
    }
    else {
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
  }
  catch (e) {
    console.warn('[showToast] Toast 显示失败:', e)
  }
}

/**
 * 确保下载所需的权限已授予（原生平台）
 * @returns {Promise<{granted: boolean, message: string}>}
 */
async function ensureDownloadPermissions() {
  try {
    const { Filesystem } = await import('@capacitor/filesystem')

    // 检查 Filesystem 权限
    let fsStatus = await Filesystem.checkPermissions()
    console.log('[ensureDownloadPermissions] Filesystem 权限状态:', JSON.stringify(fsStatus))

    // 兼容不同版本的 Capacitor，字段可能是 publicStorage 或 public
    const fsPermission = fsStatus.publicStorage || fsStatus.public
    if (fsPermission !== 'granted') {
      fsStatus = await Filesystem.requestPermissions()
      console.log('[ensureDownloadPermissions] 请求后状态:', JSON.stringify(fsStatus))
    }

    const fsPermissionAfter = fsStatus.publicStorage || fsStatus.public
    if (fsPermissionAfter !== 'granted') {
      return { granted: false, message: '需要存储权限才能下载图片' }
    }

    // 检查 Media 权限（保存到相册需要）
    try {
      const { Media } = await import('@capacitor-community/media')
      let mediaStatus = await Media.checkPermissions()
      console.log('[ensureDownloadPermissions] Media 权限状态:', JSON.stringify(mediaStatus))

      // 兼容不同的权限状态
      const photosPerm = mediaStatus.photos || mediaStatus.camera
      if (photosPerm !== 'granted' && photosPerm !== 'limited') {
        mediaStatus = await Media.requestPermissions()
        console.log('[ensureDownloadPermissions] Media 请求后状态:', JSON.stringify(mediaStatus))
      }

      const photosPermAfter = mediaStatus.photos || mediaStatus.camera
      if (photosPermAfter === 'denied') {
        return { granted: false, message: '需要相册权限才能保存图片' }
      }
    }
    catch (e) {
      // Media 插件不可用时，只要 Filesystem 权限通过就继续
      console.warn('[ensureDownloadPermissions] Media 插件不可用，跳过:', e.message || e)
    }

    return { granted: true, message: '' }
  }
  catch (error) {
    console.error('[ensureDownloadPermissions] 权限检查失败:', error.message || error)
    // 权限检查失败时，尝试继续执行（让后续操作处理权限问题）
    return { granted: true, message: '' }
  }
}

/**
 * 使用 FileTransfer 下载文件（原生平台，流式下载，不占用内存）
 * @param {string} url - 文件 URL
 * @param {string} filename - 文件名
 * @returns {Promise<boolean>} 是否成功使用 FileTransfer
 */
async function downloadWithFileTransfer(url, filename) {
  let tempPath = null
  try {
    // 动态导入，避免在 Web 环境加载
    const { FileTransfer } = await import('@capacitor/file-transfer')
    const { Filesystem, Directory } = await import('@capacitor/filesystem')

    // 创建临时文件路径
    tempPath = `WallpaperGallery/temp/${Date.now()}_${filename}`

    // 确保目录存在（根据文档，需要先创建目录）
    try {
      await Filesystem.mkdir({
        path: 'WallpaperGallery/temp',
        directory: Directory.Cache,
        recursive: true,
      })
    }
    catch (e) {
      // 目录已存在或其他错误，继续执行
      if (e.code !== 'OS-PLUG-FILE-0010') {
        // 不是"目录已存在"错误，记录警告
        console.warn('[downloadWithFileTransfer] 创建目录失败:', e)
      }
    }

    // 获取完整文件路径（FileTransfer 需要完整 URI）
    const fileInfo = await Filesystem.getUri({
      directory: Directory.Cache,
      path: tempPath,
    })

    // 使用 FileTransfer 下载（流式下载，不占用内存）
    await FileTransfer.downloadFile({
      url,
      path: fileInfo.uri,
      progress: false,
    })

    // 下载完成后，使用 Media 插件保存到相册
    const { Media } = await import('@capacitor-community/media')

    // Android 需要先获取 albumIdentifier，iOS 直接用 album 字符串
    const albumIdentifier = await getOrCreateAlbumIdentifier('WallpaperGallery')

    await Media.savePhoto({
      path: fileInfo.uri,
      ...(albumIdentifier
        ? { albumIdentifier } // Android: 使用 albumIdentifier
        : { album: 'WallpaperGallery' }), // iOS: 使用 album 字符串
    })

    console.log('[downloadWithFileTransfer] 下载并保存成功!')
    await showToast('已保存到相册', 'success')
    return true
  }
  catch (error) {
    // FileTransfer 插件不可用或下载失败，返回 false 使用降级方案
    if (error.code) {
      // FileTransfer 或 Filesystem 错误代码
      console.warn('[downloadWithFileTransfer] 操作失败:', error.code, error.message)
      // 根据错误代码提供更具体的提示
      if (error.code === 'OS-PLUG-FLTR-0006') {
        await showToast('下载失败，请授予存储权限', 'error')
      }
      else if (error.code === 'OS-PLUG-FLTR-0008') {
        await showToast('下载失败，无法连接到服务器', 'error')
      }
    }
    else {
      console.warn('[downloadWithFileTransfer] FileTransfer 插件不可用，使用降级方案')
    }
    return false
  }
  finally {
    // 确保清理临时文件（无论成功或失败）
    if (tempPath) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        await Filesystem.deleteFile({
          path: tempPath,
          directory: Directory.Cache,
        })
      }
      catch (e) {
        // 忽略清理错误，避免影响主流程
        console.warn('[downloadWithFileTransfer] 清理临时文件失败:', e)
      }
    }
  }
}

/**
 * 使用 Media 插件保存图片到相册（Capacitor）
 * @param {Blob} blob - 文件 Blob
 * @param {string} filename - 文件名
 */
async function saveToPhotoLibrary(blob, filename) {
  let tempPath = null
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Media } = await import('@capacitor-community/media')

    // 先将文件保存到临时目录
    const base64Data = await blobToBase64(blob)
    tempPath = `WallpaperGallery/temp/${Date.now()}_${filename}`

    // 确保目录存在（虽然 writeFile 的 recursive: true 会创建，但显式创建更安全）
    try {
      await Filesystem.mkdir({
        path: 'WallpaperGallery/temp',
        directory: Directory.Cache,
        recursive: true,
      })
    }
    catch (e) {
      // 目录已存在或其他错误，继续执行
      if (e.code !== 'OS-PLUG-FILE-0010') {
        console.warn('[saveToPhotoLibrary] 创建目录失败:', e)
      }
    }

    // 写入文件（recursive: true 确保父目录存在）
    await Filesystem.writeFile({
      path: tempPath,
      data: base64Data,
      directory: Directory.Cache, // 使用缓存目录（临时文件）
      recursive: true,
    })

    // 获取文件 URI（Media 插件需要完整 URI）
    const fileUri = await Filesystem.getUri({
      path: tempPath,
      directory: Directory.Cache,
    })

    // Android 需要先获取 albumIdentifier，iOS 直接用 album 字符串
    const albumIdentifier = await getOrCreateAlbumIdentifier('WallpaperGallery')

    // 保存到相册
    await Media.savePhoto({
      path: fileUri.uri,
      ...(albumIdentifier
        ? { albumIdentifier } // Android: 使用 albumIdentifier
        : { album: 'WallpaperGallery' }), // iOS: 使用 album 字符串
    })

    console.log('[saveToPhotoLibrary] 保存成功!')
    await showToast('已保存到相册', 'success')
    return true
  }
  catch (error) {
    console.error('[saveToPhotoLibrary] 保存失败:', error)
    // 根据错误代码提供更具体的提示
    if (error.code === 'OS-PLUG-FILE-0007') {
      await showToast('保存失败，请授予存储权限', 'error')
    }
    // 如果 Media 插件不可用，返回 false 使用降级方案
    return false
  }
  finally {
    // 确保清理临时文件（无论成功或失败）
    if (tempPath) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        await Filesystem.deleteFile({
          path: tempPath,
          directory: Directory.Cache,
        })
      }
      catch (e) {
        // 忽略清理错误，避免影响主流程
        console.warn('[saveToPhotoLibrary] 清理临时文件失败:', e)
      }
    }
  }
}

/**
 * 使用 Web Share API 分享图片（PWA 移动端）
 * @param {Blob} blob - 文件 Blob
 * @param {string} filename - 文件名
 */
async function shareImage(blob, filename) {
  if (!navigator.share || !navigator.canShare) {
    return false
  }

  try {
    const file = new File([blob], filename, { type: blob.type })

    // 检查是否可以分享文件
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: '保存壁纸',
        text: '保存这张壁纸到相册',
      })
      await showToast('已分享，请选择保存到相册', 'success')
      return true
    }
  }
  catch (error) {
    // 用户取消分享不算错误
    if (error.name !== 'AbortError') {
      console.error('[shareImage] 分享失败:', error)
    }
  }

  return false
}

/**
 * 在原生平台保存文件到相册
 * @param {Blob} blob - 文件 Blob
 * @param {string} filename - 文件名
 */
async function saveFileNative(blob, filename) {
  console.log('[saveFileNative] 开始保存:', filename)

  try {
    // 优先使用 Media 插件保存到相册
    const saved = await saveToPhotoLibrary(blob, filename)
    if (saved) {
      return
    }

    // 降级：使用 Filesystem 保存到 Documents 目录
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const base64Data = await blobToBase64(blob)
    console.log('[saveFileNative] Base64 转换完成, 长度:', base64Data.length)

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
 * 在 Web 平台保存文件
 * @param {Blob} blob - 文件 Blob
 * @param {string} filename - 文件名
 */
async function saveFileWeb(blob, filename) {
  // PWA 移动端：优先使用 Web Share API（让用户选择保存到相册）
  if (isPWA() && isMobileDevice()) {
    const shared = await shareImage(blob, filename)
    if (shared) {
      return
    }
    // 如果 Web Share 失败或用户取消，继续使用下载方式
  }

  // 标准下载方式（适用于桌面端和移动端 H5）
  const blobUrl = URL.createObjectURL(blob)
  let link = null

  try {
    link = document.createElement('a')
    link.href = blobUrl
    link.download = filename

    // 移动端 H5：某些浏览器不支持 download 属性，需要特殊处理
    // 但先尝试使用 download 属性，如果不行浏览器会自动降级
    if (isMobileDevice() && !isPWA()) {
      // 移动端 H5：保留 download 属性，但添加 target 作为降级
      link.target = '_blank'
    }

    document.body.appendChild(link)
    link.click()

    // 延迟释放 URL，确保下载开始
    // 使用固定延迟，避免内存泄漏
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl)
    }, 100)
  }
  finally {
    // 确保清理 DOM 元素
    if (link && link.parentNode) {
      document.body.removeChild(link)
    }
    link = null
  }
}

/**
 * 下载文件（带防护机制，支持 Web 和原生平台）
 * @param {string} url - 文件 URL
 * @param {string} filename - 保存的文件名
 * @param {number} delay - 延迟时间（毫秒），默认 300ms
 */
export async function downloadFile(url, filename, delay = 300) {
  let delayTimeoutId = null
  let timeoutId = null
  let timeoutId2 = null
  let controller = null
  let controller2 = null

  try {
    // 延迟执行，增加批量下载成本
    await new Promise((resolve) => {
      delayTimeoutId = setTimeout(resolve, delay)
    })

    // 原生平台：先检查并请求权限
    if (isNativePlatform()) {
      const permResult = await ensureDownloadPermissions()
      if (!permResult.granted) {
        await showToast(permResult.message, 'error')
        return
      }
    }

    // 动态重建 URL
    let finalUrl = url

    // 统一使用 jsDelivr CDN
    if (url.includes('@main')) {
      const path = extractPathFromUrl(url)
      finalUrl = buildImageUrl(path)
    }
    else if (!url.includes('cdn.jsdelivr.net')) {
      // 如果不是完整的 jsDelivr URL，则重建
      finalUrl = url
    }

    console.log('[downloadFile] 开始下载:', finalUrl)

    // 添加超时控制 - 60秒
    controller = new AbortController()
    timeoutId = setTimeout(() => {
      controller.abort()
      timeoutId = null
    }, 60000)

    let response = await fetch(finalUrl, { signal: controller.signal })

    // 清理第一个超时器
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    // 如果失败，尝试备用 CDN（ghproxy 镜像）
    if (!response.ok) {
      console.warn('[downloadFile] jsDelivr CDN 失败，尝试 ghproxy 镜像:', response.status)

      // 切换到 ghproxy 镜像
      finalUrl = buildRawImageUrl(url)

      console.log('[downloadFile] 备用 CDN:', finalUrl)

      controller2 = new AbortController()
      timeoutId2 = setTimeout(() => {
        controller2.abort()
        timeoutId2 = null
      }, 60000)

      response = await fetch(finalUrl, { signal: controller2.signal })

      // 清理第二个超时器
      if (timeoutId2) {
        clearTimeout(timeoutId2)
        timeoutId2 = null
      }

      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`)
      }
    }

    const blob = await response.blob()
    console.log('[downloadFile] 下载完成，大小:', blob.size)

    // 根据平台选择保存方式
    if (isNativePlatform()) {
      // 原生平台（Capacitor）：优先使用 FileTransfer 下载，然后保存到相册
      // FileTransfer 优势：流式下载，不占用内存，支持进度监听
      const useFileTransfer = await downloadWithFileTransfer(finalUrl, filename)
      if (!useFileTransfer) {
        // 降级：使用 fetch + blob 方式
        await saveFileNative(blob, filename)
      }
    }
    else if (isPWA() && isMobileDevice()) {
      // PWA 移动端：使用 Web Share API 让用户保存到相册
      await saveFileWeb(blob, filename)
    }
    else {
      // 普通 Web 环境：使用下载方式
      await saveFileWeb(blob, filename)
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
  finally {
    // 确保清理所有定时器，防止内存泄漏
    if (delayTimeoutId) {
      clearTimeout(delayTimeoutId)
    }
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    if (timeoutId2) {
      clearTimeout(timeoutId2)
    }
    // 清理 AbortController（虽然会自动清理，但显式清理更安全）
    controller = null
    controller2 = null
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
