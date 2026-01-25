import { computed } from 'vue'

/**
 * Electron 环境检测
 */
export function useElectron() {
  const isElectron = computed(() => {
    return typeof window !== 'undefined' && window.electronAPI?.isElectron === true
  })

  const platform = computed(() => {
    return window.electronAPI?.platform || null
  })

  const isMac = computed(() => {
    return platform.value === 'darwin'
  })

  const isWindows = computed(() => {
    return platform.value === 'win32'
  })

  return {
    isElectron,
    platform,
    isMac,
    isWindows,
  }
}
