import { ElMessage } from 'element-plus'
import { computed, getCurrentScope, onScopeDispose, ref, toValue } from 'vue'
import { authorizeWallpaperDownload, downloadProtectionEnabled } from '@/services/downloadProtectionService'
import { recordDownload } from '@/services/statsService'
import { trackWallpaperDownload } from '@/utils/common/analytics'
import { buildWallpaperDownloadFilename, downloadFile } from '@/utils/common/format'
import { getWallpaperIdentity } from '@/utils/wallpaper/identity'

export function useWallpaperDownload(wallpaper, series, { onRecorded } = {}) {
  const downloading = ref(false)
  const downloadProgress = ref({ phase: 'idle', loaded: 0, total: null })
  const downloadPercent = computed(() => {
    const { loaded, total } = downloadProgress.value
    return total > 0 ? Math.min(99, Math.floor(loaded / total * 100)) : null
  })
  const downloadLabel = computed(() => {
    const { phase, loaded } = downloadProgress.value
    if (phase === 'verifying')
      return '正在验证'
    if (phase === 'native')
      return '正在保存'
    if (phase === 'saving')
      return '准备保存'
    if (phase === 'switching')
      return '切换线路'
    if (phase === 'receiving' && loaded > 0)
      return downloadPercent.value === null ? `已接收 ${(loaded / 1024 / 1024).toFixed(1)} MB` : `下载 ${downloadPercent.value}%`
    return '连接文件'
  })
  const canCancelDownload = computed(() => downloading.value && downloadProgress.value.phase !== 'native')
  let controller

  function cancelDownload() {
    controller?.abort()
  }

  if (getCurrentScope())
    onScopeDispose(cancelDownload)

  async function handleDownload() {
    const current = toValue(wallpaper)
    if (!current || downloading.value)
      return

    // 异步下载期间允许切图，事件始终归属于点击时的资源。
    const snapshot = { ...current, resolution: current.resolution ? { ...current.resolution } : undefined }
    const downloadSeries = toValue(series)
    controller = new AbortController()
    downloading.value = true
    downloadProgress.value = { phase: 'connecting', loaded: 0, total: null }
    try {
      let downloadUrl = snapshot.downloadUrl || snapshot.url
      if (downloadProtectionEnabled()) {
        downloadProgress.value = { phase: 'verifying', loaded: 0, total: null }
        try {
          downloadUrl = await authorizeWallpaperDownload(snapshot, downloadSeries, { signal: controller.signal })
          controller.signal.throwIfAborted()
        }
        catch (error) {
          if (error?.name === 'AbortError')
            return { status: 'cancelled' }
          ElMessage.error(error.message || '下载验证暂不可用，请稍后重试')
          return { status: 'blocked' }
        }
      }
      const signal = controller.signal
      const result = await downloadFile(downloadUrl, buildWallpaperDownloadFilename(snapshot), {
        signal,
        onProgress(value) {
          if (!signal.aborted && controller?.signal === signal && downloading.value)
            downloadProgress.value = value
        },
      })
      if (result.status === 'opened-fallback') {
        ElMessage.info('已打开原始链接，请在新页面保存文件')
        return result
      }
      if (['browser-started', 'native-completed'].includes(result.status)) {
        trackWallpaperDownload(snapshot, downloadSeries)
        recordDownload(snapshot, downloadSeries).then((recorded) => {
          if (recorded.status === 'accepted')
            onRecorded?.(getWallpaperIdentity(snapshot, downloadSeries).assetKey)
        }).catch((error) => {
          if (import.meta.env.DEV)
            console.warn('[WallpaperDownload] 下载已发起，统计上报失败:', error)
        })
        ElMessage.success(result.status === 'native-completed' ? '文件已保存至下载目录' : '下载已发起')
      }
      return result
    }
    catch (error) {
      if (error?.name === 'AbortError')
        return { status: 'cancelled' }
      ElMessage.error(error?.name === 'TimeoutError' ? '下载超时，请稍后重试' : '下载失败，请稍后重试')
      if (import.meta.env.DEV)
        console.warn('[WallpaperDownload] 下载失败:', error)
      return { status: 'failed' }
    }
    finally {
      downloading.value = false
      controller = null
    }
  }

  return { downloading, downloadLabel, downloadPercent, canCancelDownload, handleDownload, cancelDownload }
}
