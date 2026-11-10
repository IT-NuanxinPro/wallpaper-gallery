import { ElMessage } from 'element-plus'
import { getCurrentScope, onScopeDispose, ref, toValue } from 'vue'
import { recordDownload } from '@/services/statsService'
import { trackWallpaperDownload } from '@/utils/common/analytics'
import { buildWallpaperDownloadFilename, downloadFile } from '@/utils/common/format'

export function useWallpaperDownload(wallpaper, series) {
  const downloading = ref(false)
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
    try {
      const result = await downloadFile(snapshot.downloadUrl || snapshot.url, buildWallpaperDownloadFilename(snapshot), { signal: controller.signal })
      if (result.status === 'opened-fallback') {
        ElMessage.info('已打开原始链接，请在新页面保存文件')
        return result
      }
      if (['browser-started', 'native-completed'].includes(result.status)) {
        trackWallpaperDownload(snapshot, downloadSeries)
        recordDownload(snapshot, downloadSeries).catch((error) => {
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
      ElMessage.error('下载失败，请稍后重试')
      if (import.meta.env.DEV)
        console.warn('[WallpaperDownload] 下载失败:', error)
      return { status: 'failed' }
    }
    finally {
      downloading.value = false
      controller = null
    }
  }

  return { downloading, handleDownload, cancelDownload }
}
