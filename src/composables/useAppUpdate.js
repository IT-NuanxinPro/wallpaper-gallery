import { ref } from 'vue'

// eslint-disable-next-line no-undef
const APP_VERSION = __APP_VERSION__ || '1.0.0'

/**
 * App 更新检测
 * 仅在原生 App 环境中生效
 */
export function useAppUpdate() {
  const hasUpdate = ref(false)
  const latestVersion = ref('')
  const downloadUrl = ref('')
  const changelog = ref('')

  /**
   * 检测是否在原生平台
   */
  function isNativePlatform() {
    return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()
  }

  /**
   * 比较版本号
   * @returns {boolean} true 表示有新版本
   */
  function compareVersion(current, latest) {
    const currentParts = current.split('.').map(Number)
    const latestParts = latest.split('.').map(Number)

    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const c = currentParts[i] || 0
      const l = latestParts[i] || 0
      if (l > c)
        return true
      if (l < c)
        return false
    }
    return false
  }

  /**
   * 检查更新
   */
  async function checkUpdate() {
    // 仅在原生平台检查
    if (!isNativePlatform())
      return false

    try {
      const response = await fetch(`/app-version.json?${Date.now()}`)
      if (!response.ok)
        return false

      const data = await response.json()
      latestVersion.value = data.version
      downloadUrl.value = data.downloadUrl
      changelog.value = data.changelog

      hasUpdate.value = compareVersion(APP_VERSION, data.version)
      return hasUpdate.value
    }
    catch (error) {
      console.error('[useAppUpdate] 检查更新失败:', error)
      return false
    }
  }

  /**
   * 跳转下载
   */
  function goToDownload() {
    if (downloadUrl.value) {
      window.open(downloadUrl.value, '_blank')
    }
  }

  return {
    hasUpdate,
    latestVersion,
    downloadUrl,
    changelog,
    currentVersion: APP_VERSION,
    checkUpdate,
    goToDownload,
    isNativePlatform,
  }
}
