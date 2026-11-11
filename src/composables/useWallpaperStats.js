import { computed, onMounted, onScopeDispose, ref, toValue, watch } from 'vue'
import { loadWallpaperStats } from '@/services/wallpaperStatsService'

export function useWallpaperStats(record, { load = loadWallpaperStats } = {}) {
  const assetKey = computed(() => toValue(record)?.assetKey || '')
  const stats = ref(null)
  const loading = ref(false)
  const failed = ref(false)
  let version = 0
  let controller
  let stopWatching
  let disposed = false

  async function refresh(expectedKey = assetKey.value) {
    if (disposed || !expectedKey || expectedKey !== assetKey.value)
      return false
    const request = ++version
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    failed.value = false
    try {
      const result = await load(expectedKey, { signal: controller.signal })
      if (request !== version || disposed)
        return false
      stats.value = result
      return true
    }
    catch {
      if (request === version && !disposed) {
        stats.value = null
        failed.value = true
      }
      return false
    }
    finally {
      if (request === version && !disposed)
        loading.value = false
    }
  }

  function afterSuccessful(action) {
    return async (...args) => {
      const key = assetKey.value
      const result = await action(...args)
      if (result?.success === true)
        await refresh(key)
      return result
    }
  }

  // 统计独立于首屏媒体，SSR 仅输出相同占位结构。
  onMounted(() => {
    stopWatching = watch(assetKey, () => {
      version++
      controller?.abort()
      stats.value = null
      loading.value = false
      failed.value = false
      refresh()
    }, { immediate: true, flush: 'sync' })
  })
  onScopeDispose(() => {
    disposed = true
    version++
    controller?.abort()
    stopWatching?.()
  })
  return { stats, loading, failed, refresh, afterSuccessful }
}
