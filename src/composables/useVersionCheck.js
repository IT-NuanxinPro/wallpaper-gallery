/**
 * 版本检测服务
 * - 页面进入时检查一次服务器版本
 * - 检测到新版本时通知用户
 * - 支持强制刷新清除缓存
 */

import { onMounted, ref } from 'vue'

// 当前版本（构建时注入）
// eslint-disable-next-line no-undef
const CURRENT_VERSION = __APP_VERSION__ || '0.0.0'
// eslint-disable-next-line no-undef
const BUILD_TIME = __BUILD_TIME__ || ''

// 配置
const VERSION_URL = `${import.meta.env.BASE_URL}version.json`

// 全局状态（单例）
const hasNewVersion = ref(false)
const newVersionInfo = ref(null)
const isChecking = ref(false)

let initialized = false

/**
 * 获取服务器版本（带缓存破坏）
 */
async function fetchServerVersion() {
  try {
    const timestamp = Date.now()
    const response = await fetch(`${VERSION_URL}?t=${timestamp}`, {
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
    console.warn('[VersionCheck] 获取版本信息失败:', error.message)
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
 * 检查版本更新
 */
async function checkForUpdates() {
  if (isChecking.value)
    return

  isChecking.value = true

  try {
    const serverVersion = await fetchServerVersion()

    if (!serverVersion) {
      return
    }

    // 比较版本号
    const comparison = compareVersions(serverVersion.version, CURRENT_VERSION)

    if (comparison > 0) {
      // 服务器版本更新
      hasNewVersion.value = true
      newVersionInfo.value = {
        current: CURRENT_VERSION,
        latest: serverVersion.version,
        buildTime: serverVersion.buildTime,
      }
      console.log(`[VersionCheck] 发现新版本: ${CURRENT_VERSION} → ${serverVersion.version}`)
    }
  }
  catch (error) {
    console.warn('[VersionCheck] 检查更新失败:', error)
  }
  finally {
    isChecking.value = false
  }
}

/**
 * 强制刷新页面（清除缓存）
 */
function forceRefresh() {
  // 清除 Service Worker 缓存
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach(registration => registration.unregister())
    })
  }

  // 清除应用缓存
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach(name => caches.delete(name))
    })
  }

  // 强制刷新：添加时间戳参数绕过所有缓存（包括 CDN）
  const url = new URL(window.location.href)
  url.searchParams.set('_t', Date.now())
  window.location.href = url.toString()
}

/**
 * 忽略本次更新
 */
function dismissUpdate() {
  hasNewVersion.value = false
  // 可以在 sessionStorage 中记录，避免本次会话重复提示
  if (newVersionInfo.value) {
    sessionStorage.setItem('dismissed_version', newVersionInfo.value.latest)
  }
}

/**
 * 版本检测 Composable
 */
export function useVersionCheck() {
  onMounted(() => {
    if (!initialized) {
      initialized = true

      // 检查是否已忽略过此版本
      const dismissedVersion = sessionStorage.getItem('dismissed_version')
      if (dismissedVersion && newVersionInfo.value?.latest === dismissedVersion) {
        hasNewVersion.value = false
        return
      }

      // 延迟 5 秒后检查一次（避免影响首屏加载）
      setTimeout(checkForUpdates, 5000)
    }
  })

  return {
    // 状态
    hasNewVersion,
    newVersionInfo,
    isChecking,
    currentVersion: CURRENT_VERSION,
    buildTime: BUILD_TIME,

    // 方法
    checkForUpdates,
    forceRefresh,
    dismissUpdate,
  }
}

// 导出常量供其他模块使用
export { BUILD_TIME, CURRENT_VERSION }
