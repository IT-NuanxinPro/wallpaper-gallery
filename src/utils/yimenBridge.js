// ========================================
// 一门云 JS Bridge 工具函数
// ========================================

/**
 * 检测是否在一门云 App 环境中
 * @returns {boolean}
 */
export function isYimenApp() {
  return typeof window !== 'undefined' && window.jsBridge && window.jsBridge.isReady()
}

/**
 * 等待 JS Bridge 准备就绪
 * @returns {Promise<boolean>}
 */
export function waitForBridge() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.jsBridge) {
      resolve(false)
      return
    }

    if (window.jsBridge.isReady()) {
      resolve(true)
      return
    }

    window.jsBridge.ready(() => {
      resolve(true)
    })

    // 超时处理
    setTimeout(() => {
      resolve(false)
    }, 3000)
  })
}

/**
 * 保存图片到相册
 * @param {string} imageUrl - 图片 URL
 * @param {string} _filename - 文件名（可选）
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function saveImageToAlbum(imageUrl, _filename = '') {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      throw new Error('JS Bridge 未准备就绪')
    }

    return new Promise((resolve) => {
      window.jsBridge.saveImageToAlbum(imageUrl, (success) => {
        if (success) {
          resolve({
            success: true,
            message: '图片已保存到相册',
          })
        }
        else {
          resolve({
            success: false,
            message: '保存失败，请检查权限设置',
          })
        }
      })
    })
  }
  catch (error) {
    console.error('保存图片到相册失败:', error)
    return {
      success: false,
      message: error.message || '保存失败',
    }
  }
}

/**
 * 下载图片到应用私有目录
 * @param {string} imageUrl - 图片 URL
 * @param {string} filename - 文件名
 * @returns {Promise<{success: boolean, message?: string, filePath?: string}>}
 */
export async function downloadImageToAppDir(imageUrl, filename) {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      throw new Error('JS Bridge 未准备就绪')
    }

    // 首先下载图片数据
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`)
    }

    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // 转换为 Base64
    let binary = ''
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }
    const base64Data = btoa(binary)

    // 保存到应用私有目录
    const filePath = `fs://file/wallpapers/${filename}`

    return new Promise((resolve) => {
      // 先确保目录存在
      window.jsBridge.fs.mkdir('fs://file/wallpapers/', (_mkdirSuccess) => {
        // 不管目录创建是否成功，都尝试写入文件（目录可能已存在）
        window.jsBridge.fs.writeBinary(filePath, base64Data, (writeSuccess, msg) => {
          if (writeSuccess) {
            resolve({
              success: true,
              message: '图片已下载到应用目录',
              filePath,
            })
          }
          else {
            resolve({
              success: false,
              message: msg || '保存到应用目录失败',
            })
          }
        })
      })
    })
  }
  catch (error) {
    console.error('下载图片到应用目录失败:', error)
    return {
      success: false,
      message: error.message || '下载失败',
    }
  }
}

/**
 * 获取应用目录中的壁纸列表
 * @returns {Promise<{success: boolean, files?: string[], message?: string}>}
 */
export async function getDownloadedWallpapers() {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      throw new Error('JS Bridge 未准备就绪')
    }

    return new Promise((resolve) => {
      window.jsBridge.fs.list('fs://file/wallpapers/', (success, data) => {
        if (success && Array.isArray(data)) {
          // 过滤出图片文件（排除目录）
          const imageFiles = data.filter(file =>
            !file.endsWith('/')
            && /\.(?:jpe?g|png|gif|bmp|webp)$/i.test(file),
          )
          resolve({
            success: true,
            files: imageFiles,
          })
        }
        else {
          resolve({
            success: false,
            message: '获取文件列表失败',
            files: [],
          })
        }
      })
    })
  }
  catch (error) {
    console.error('获取下载的壁纸列表失败:', error)
    return {
      success: false,
      message: error.message || '获取列表失败',
      files: [],
    }
  }
}

/**
 * 删除应用目录中的壁纸文件
 * @param {string} filename - 文件名
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function deleteDownloadedWallpaper(filename) {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      throw new Error('JS Bridge 未准备就绪')
    }

    const filePath = `fs://file/wallpapers/${filename}`

    return new Promise((resolve) => {
      window.jsBridge.fs.delete(filePath, (success, msg) => {
        if (success) {
          resolve({
            success: true,
            message: '文件删除成功',
          })
        }
        else {
          resolve({
            success: false,
            message: msg || '删除失败',
          })
        }
      })
    })
  }
  catch (error) {
    console.error('删除壁纸文件失败:', error)
    return {
      success: false,
      message: error.message || '删除失败',
    }
  }
}

/**
 * 获取文件大小
 * @param {string} filename - 文件名
 * @returns {Promise<{success: boolean, size?: number, message?: string}>}
 */
export async function getFileSize(filename) {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      throw new Error('JS Bridge 未准备就绪')
    }

    const filePath = `fs://file/wallpapers/${filename}`

    return new Promise((resolve) => {
      window.jsBridge.fs.size(filePath, (success, size) => {
        if (success) {
          resolve({
            success: true,
            size: Number.parseInt(size) || 0,
          })
        }
        else {
          resolve({
            success: false,
            message: '获取文件大小失败',
            size: 0,
          })
        }
      })
    })
  }
  catch (error) {
    console.error('获取文件大小失败:', error)
    return {
      success: false,
      message: error.message || '获取失败',
      size: 0,
    }
  }
}

/**
 * 检查文件是否存在
 * @param {string} filename - 文件名
 * @returns {Promise<boolean>}
 */
export async function fileExists(filename) {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      return false
    }

    const filePath = `fs://file/wallpapers/${filename}`

    return new Promise((resolve) => {
      window.jsBridge.fs.exist(filePath, (exists) => {
        resolve(exists)
      })
    })
  }
  catch (error) {
    console.error('检查文件是否存在失败:', error)
    return false
  }
}

/**
 * 批量保存图片到相册
 * @param {string[]} imageUrls - 图片 URL 数组
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function saveImagesToAlbum(imageUrls) {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      throw new Error('JS Bridge 未准备就绪')
    }

    return new Promise((resolve) => {
      window.jsBridge.saveImagesToAlbum(imageUrls, (success) => {
        if (success) {
          resolve({
            success: true,
            message: `已保存 ${imageUrls.length} 张图片到相册`,
          })
        }
        else {
          resolve({
            success: false,
            message: '批量保存失败，请检查权限设置',
          })
        }
      })
    })
  }
  catch (error) {
    console.error('批量保存图片到相册失败:', error)
    return {
      success: false,
      message: error.message || '批量保存失败',
    }
  }
}

/**
 * 显示 Toast 提示
 * @param {string} message - 提示信息
 */
export async function showToast(message) {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      console.log('Toast (fallback):', message)
      return
    }

    window.jsBridge.toast(message)
  }
  catch (error) {
    console.error('显示 Toast 失败:', error)
    console.log('Toast (fallback):', message)
  }
}

/**
 * 请求权限
 * @param {string[]} permissions - 权限数组，如 ['WRITE_EXTERNAL_STORAGE']
 * @returns {Promise<{success: boolean, granted: boolean}>}
 */
export async function requestPermissions(permissions) {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      throw new Error('JS Bridge 未准备就绪')
    }

    return new Promise((resolve) => {
      window.jsBridge.requestPermissions(permissions, (granted) => {
        resolve({
          success: true,
          granted,
        })
      })
    })
  }
  catch (error) {
    console.error('请求权限失败:', error)
    return {
      success: false,
      granted: false,
    }
  }
}

/**
 * 获取设备信息
 * @returns {Promise<object|null>}
 */
export async function getDeviceInfo() {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      return null
    }

    return new Promise((resolve) => {
      window.jsBridge.deviceInfo((info) => {
        resolve(info)
      })
    })
  }
  catch (error) {
    console.error('获取设备信息失败:', error)
    return null
  }
}

/**
 * 检查是否有存储权限
 * @returns {Promise<boolean>}
 */
export async function checkStoragePermission() {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      return false
    }

    return new Promise((resolve) => {
      window.jsBridge.getSettingState('WRITE_EXTERNAL_STORAGE', (granted) => {
        resolve(granted)
      })
    })
  }
  catch (error) {
    console.error('检查存储权限失败:', error)
    return false
  }
}

/**
 * 打开应用设置页面
 */
export async function openAppSettings() {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      return
    }

    window.jsBridge.openSetting('APPLICATION_DETAILS_SETTINGS')
  }
  catch (error) {
    console.error('打开应用设置失败:', error)
  }
}
// ========================================
// 隐私协议相关功能
// ========================================

/**
 * 显示用户协议与隐私政策窗口
 * @param {Function} callback - 回调函数，参数为是否同意
 * @returns {Promise<boolean>}
 */
export async function showAgreement(callback) {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      throw new Error('JS Bridge 未准备就绪')
    }

    if (callback && typeof callback === 'function') {
      // 有回调的情况
      window.jsBridge.agreement(callback)
    }
    else {
      // 无回调的情况，返回 Promise
      return new Promise((resolve) => {
        window.jsBridge.agreement((agreed) => {
          resolve(agreed)
        })
      })
    }
  }
  catch (error) {
    console.error('显示用户协议失败:', error)
    if (callback) {
      callback(false)
    }
    else {
      return false
    }
  }
}

/**
 * 显示用户协议
 */
export async function showUserAgreement() {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      return
    }

    window.jsBridge.userAgreement()
  }
  catch (error) {
    console.error('显示用户协议失败:', error)
  }
}

/**
 * 显示隐私政策
 */
export async function showUserPrivacy() {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      return
    }

    window.jsBridge.userPrivacy()
  }
  catch (error) {
    console.error('显示隐私政策失败:', error)
  }
}

/**
 * 检查是否已同意用户协议与隐私政策
 * @returns {Promise<boolean>}
 */
export async function checkAgreementStatus() {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      return false
    }

    return new Promise((resolve) => {
      window.jsBridge.agreed((agreed) => {
        resolve(agreed)
      })
    })
  }
  catch (error) {
    console.error('检查协议状态失败:', error)
    return false
  }
}

/**
 * 设置用户协议状态（通知 App 用户已同意或拒绝）
 * @param {boolean} agreed - 是否同意
 * @returns {Promise<boolean>}
 */
export async function setAgreementStatus(agreed) {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      throw new Error('JS Bridge 未准备就绪')
    }

    return new Promise((resolve) => {
      window.jsBridge.agreed({
        agreed,
      }, (success) => {
        resolve(success)
      })
    })
  }
  catch (error) {
    console.error('设置协议状态失败:', error)
    return false
  }
}

/**
 * 监听用户协议同意/拒绝事件
 * @param {Function} callback - 回调函数，参数为是否同意
 */
export async function onAgreementChange(callback) {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      return
    }

    window.jsBridge.onAgree(callback)
  }
  catch (error) {
    console.error('监听协议变化失败:', error)
  }
}

/**
 * 退出应用
 * @param {boolean} killProcess - 是否强制退出进程
 */
export async function exitApp(killProcess = false) {
  try {
    const isReady = await waitForBridge()
    if (!isReady) {
      return
    }

    window.jsBridge.exit(killProcess)
  }
  catch (error) {
    console.error('退出应用失败:', error)
  }
}
