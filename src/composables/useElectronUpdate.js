/**
 * Electron 更新检查服务
 * - 检查应用版本更新
 * - 检查壁纸数据更新（通过对比线上数据的 buildTime）
 */

import { onMounted, ref } from 'vue'

// 当前版本（构建时注入）
// eslint-disable-next-line no-undef
const CURRENT_VERSION = __APP_VERSION__ || '0.0.0'
// eslint-disable-next-line no-undef
const BUILD_TIME = __BUILD_TIME__ || ''

// 配置
const ELECTRON_VERSION_URL = `${import.meta.env.BASE_URL}electron-version.json`
// const WEB_DATA_URL = 'https://wallpaper.061129.xyz/data/desktop.json' // 检查线上数据

// 全局状态
const hasAppUpdate = ref(false)
const hasDataUpdate = ref(false)
const appUpdateInfo = ref(null)
const dataUpdateInfo = ref(null)
const isChecking = ref(false)

let initialized = false

/**
 * 获取远程版本信息
 */
async function fetchVersion(url) {
  try {
    const timestamp = Date.now()
    const response = await fetch(`${url}?t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  }
  catch (error) {
    console.warn('[ElectronUpdate] 获取版本信息失败:', url, error.message)
    return null
  }
}

/**
 * 比较版本号
 * @returns {number} 1: a > b, -1: a < b, 0: a === b
 */
function compareVersions(a, b) {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0
    const numB = partsB[i] || 0

    if (numA > numB)
      return 1
    if (numA < numB)
      return -1
  }

  return 0
}

/**
 * 检查应用版本更新
 */
async function checkAppUpdate() {
  try {
    const serverVersion = await fetchVersion(ELECTRON_VERSION_URL)

    if (!serverVersion)
      return

    const comparison = compareVersions(serverVersion.version, CURRENT_VERSION)

    if (comparison > 0) {
      hasAppUpdate.value = true
      appUpdateInfo.value = {
        current: CURRENT_VERSION,
        latest: serverVersion.version,
        buildTime: serverVersion.buildTime,
        changelog: serverVersion.changelog,
      }
      console.log(`[ElectronUpdate] 发现应用新版本: ${CURRENT_VERSION} → ${serverVersion.version}`)
    }
  }
  catch (error) {
    console.warn('[ElectronUpdate] 检查应用更新失败:', error)
  }
}

/**
 * 检查壁纸数据更新（使用 Web 版本号）
 */
async function checkDataUpdate() {
  try {
    // 使用 Web 版本号作为数据版本（Web 定时部署会自动更新）
    const webVersion = await fetchVersion('https://wallpaper.061129.xyz/version.json')

    if (!webVersion)
      return

    // 从 localStorage 获取本地数据版本
    const localDataVersion = localStorage.getItem('wallpaper_data_version') || '0.0.0'

    const comparison = compareVersions(webVersion.version, localDataVersion)

    if (comparison > 0) {
      hasDataUpdate.value = true
      dataUpdateInfo.value = {
        current: localDataVersion,
        latest: webVersion.version,
        updateTime: webVersion.buildTime,
        changelog: '发现新的壁纸内容',
      }
      console.log(`[ElectronUpdate] 发现壁纸数据更新: ${localDataVersion} → ${webVersion.version}`)
    }
  }
  catch (error) {
    console.warn('[ElectronUpdate] 检查数据更新失败:', error)
  }
}

/**
 * 检查所有更新
 */
async function checkForUpdates() {
  if (isChecking.value)
    return

  isChecking.value = true

  try {
    await Promise.all([
      checkAppUpdate(),
      checkDataUpdate(),
    ])
  }
  finally {
    isChecking.value = false
  }
}

/**
 * 更新壁纸数据
 */
async function updateWallpaperData() {
  try {
    console.log('[ElectronUpdate] 开始更新壁纸数据...')

    // 调用 Electron API 下载最新数据
    if (window.electronAPI?.updateWallpaperData) {
      const result = await window.electronAPI.updateWallpaperData()

      if (result.success) {
        // 保存版本号
        if (dataUpdateInfo.value?.latest) {
          localStorage.setItem('wallpaper_data_version', dataUpdateInfo.value.latest)
        }

        hasDataUpdate.value = false
        dataUpdateInfo.value = null

        console.log('[ElectronUpdate] 壁纸数据更新成功')
        return { success: true, message: result.message || '壁纸数据更新成功' }
      }
      else {
        throw new Error(result.message || '更新失败')
      }
    }
    else {
      throw new Error('Electron API 不可用')
    }
  }
  catch (error) {
    console.error('[ElectronUpdate] 更新壁纸数据失败:', error)
    return { success: false, message: error.message }
  }
}

/**
 * 打开下载页面（应用更新）
 */
function openDownloadPage() {
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal('https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/latest')
  }
  else {
    window.open('https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/latest', '_blank')
  }
}

/**
 * 忽略本次更新
 */
function dismissAppUpdate() {
  hasAppUpdate.value = false
  if (appUpdateInfo.value) {
    sessionStorage.setItem('dismissed_app_version', appUpdateInfo.value.latest)
  }
}

function dismissDataUpdate() {
  hasDataUpdate.value = false
  if (dataUpdateInfo.value) {
    sessionStorage.setItem('dismissed_data_version', dataUpdateInfo.value.latest)
  }
}

/**
 * Electron 更新检查 Composable
 */
export function useElectronUpdate() {
  onMounted(() => {
    // 仅在 Electron 环境中使用
    const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron

    if (!isElectron) {
      return
    }

    if (!initialized) {
      initialized = true

      // 检查是否已忽略过此版本
      const dismissedAppVersion = sessionStorage.getItem('dismissed_app_version')
      const dismissedDataVersion = sessionStorage.getItem('dismissed_data_version')

      if (dismissedAppVersion && appUpdateInfo.value?.latest === dismissedAppVersion) {
        hasAppUpdate.value = false
      }

      if (dismissedDataVersion && dataUpdateInfo.value?.latest === dismissedDataVersion) {
        hasDataUpdate.value = false
      }

      // 延迟 3 秒检查更新（避免影响启动速度）
      setTimeout(checkForUpdates, 3000)

      // 每小时检查一次数据更新
      setInterval(checkDataUpdate, 60 * 60 * 1000)
    }
  })

  return {
    // 状态
    hasAppUpdate,
    hasDataUpdate,
    appUpdateInfo,
    dataUpdateInfo,
    isChecking,
    currentVersion: CURRENT_VERSION,
    buildTime: BUILD_TIME,

    // 方法
    checkForUpdates,
    updateWallpaperData,
    openDownloadPage,
    dismissAppUpdate,
    dismissDataUpdate,
  }
}

// 导出常量供其他模块使用
export { BUILD_TIME, CURRENT_VERSION }
