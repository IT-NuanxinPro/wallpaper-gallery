/**
 * Electron API 适配器
 * 封装调用 window.electronAPI 的工具函数
 */

/**
 * 检查是否在 Electron 环境
 */
export function isElectron() {
  return typeof window !== 'undefined' && window.electronAPI?.isElectron === true
}

/**
 * 获取平台信息
 */
export function getPlatform() {
  return window.electronAPI?.platform || null
}

/**
 * 读取本地文件（Electron 专用）
 * @param {string} filePath - 相对于 renderer 目录的文件路径
 * @returns {Promise<{success: boolean, data?: string, message?: string}>}
 */
export async function readLocalFile(filePath) {
  if (!isElectron()) {
    return { success: false, message: '不在 Electron 环境中' }
  }

  try {
    const result = await window.electronAPI.readLocalFile(filePath)
    return result
  }
  catch (error) {
    console.error('readLocalFile 调用失败:', error)
    return { success: false, message: error.message }
  }
}

/**
 * 下载图片到本地
 * @param {string} url - 图片 URL
 * @param {string} filename - 建议的文件名
 * @returns {Promise<{success: boolean, filePath?: string, message?: string}>}
 */
export async function downloadImage(url, filename) {
  if (!isElectron()) {
    console.warn('downloadImage: 不在 Electron 环境中')
    return { success: false, message: '不在 Electron 环境中' }
  }

  try {
    const result = await window.electronAPI.downloadImage(url, filename)
    return result
  }
  catch (error) {
    console.error('downloadImage 调用失败:', error)
    return { success: false, message: error.message }
  }
}

/**
 * 设置图片为桌面壁纸
 * @param {string} url - 图片 URL
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function setWallpaper(url) {
  if (!isElectron()) {
    console.warn('setWallpaper: 不在 Electron 环境中')
    return { success: false, message: '不在 Electron 环境中' }
  }

  try {
    const result = await window.electronAPI.setWallpaper(url)
    return result
  }
  catch (error) {
    console.error('setWallpaper 调用失败:', error)
    return { success: false, message: error.message }
  }
}

/**
 * 打开壁纸文件夹
 * @returns {Promise<{success: boolean, path?: string, message?: string}>}
 */
export async function openWallpaperFolder() {
  if (!isElectron()) {
    console.warn('openWallpaperFolder: 不在 Electron 环境中')
    return { success: false, message: '不在 Electron 环境中' }
  }

  try {
    const result = await window.electronAPI.openWallpaperFolder()
    return result
  }
  catch (error) {
    console.error('openWallpaperFolder 调用失败:', error)
    return { success: false, message: error.message }
  }
}

/**
 * 窗口控制
 */
export const windowControls = {
  minimize() {
    if (isElectron()) {
      window.electronAPI.minimize()
    }
  },
  maximize() {
    if (isElectron()) {
      window.electronAPI.maximize()
    }
  },
  close() {
    if (isElectron()) {
      window.electronAPI.close()
    }
  },
}
