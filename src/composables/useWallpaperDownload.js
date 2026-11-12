import { computed, getCurrentScope, onScopeDispose, ref, toValue } from 'vue'
import { authorizeWallpaperDownload, downloadProtectionEnabled } from '@/services/downloadProtectionService'
import { recordDownload } from '@/services/statsService'
import { trackWallpaperDownload } from '@/utils/common/analytics'
import { buildWallpaperDownloadFilename, downloadFile } from '@/utils/common/format'
import { getWallpaperIdentity } from '@/utils/wallpaper/identity'

const TERMINAL_LABELS = {
  'browser-started': '下载已发起',
  'native-completed': '文件已保存',
  'opened-fallback': '已打开原链接',
  'blocked': '暂时无法下载',
  'cancelled': '已取消',
  'failed': '下载失败',
}

export function useWallpaperDownload(wallpaper, series, { onRecorded } = {}) {
  const downloading = ref(false)
  const downloadProgress = ref({ phase: 'idle', loaded: 0, total: null })
  const downloadFeedback = ref('')
  const downloadStatus = computed(() => downloadProgress.value.phase)
  const downloadPercent = computed(() => {
    const { loaded, total } = downloadProgress.value
    return downloading.value && total > 0 ? Math.min(99, Math.floor(loaded / total * 100)) : null
  })
  const downloadLabel = computed(() => {
    const { phase, loaded } = downloadProgress.value
    if (TERMINAL_LABELS[phase])
      return TERMINAL_LABELS[phase]
    if (phase === 'idle')
      return '下载文件'
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
  const canCancelDownload = computed(() => downloading.value && downloadStatus.value !== 'native')
  let controller
  let terminalTimer
  let generation = 0
  let disposed = false

  function setTerminal(status, feedback = '') {
    clearTimeout(terminalTimer)
    downloading.value = false
    controller = null
    downloadProgress.value = { phase: status, loaded: 0, total: null }
    downloadFeedback.value = feedback
    const revision = generation
    terminalTimer = setTimeout(() => {
      if (!disposed && generation === revision)
        downloadProgress.value = { phase: 'idle', loaded: 0, total: null }
    }, 1500)
  }

  function cancelDownload() {
    if (!controller)
      return
    const pending = controller
    generation++
    controller = null
    pending.abort()
    setTerminal('cancelled')
  }

  function resetDownload() {
    generation++
    controller?.abort()
    controller = null
    clearTimeout(terminalTimer)
    downloading.value = false
    downloadProgress.value = { phase: 'idle', loaded: 0, total: null }
    downloadFeedback.value = ''
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true
      resetDownload()
    })
  }

  async function handleDownload() {
    const current = toValue(wallpaper)
    if (!current || downloading.value || disposed)
      return

    // 资源快照用于下载及统计；递增版本只允许当前操作更新按钮。
    const snapshot = { ...current, resolution: current.resolution ? { ...current.resolution } : undefined }
    const downloadSeries = toValue(series)
    const assetKey = getWallpaperIdentity(snapshot, downloadSeries).assetKey
    const revision = ++generation
    const requestController = new AbortController()
    const { signal } = requestController
    const isCurrent = () => !disposed && revision === generation && !signal.aborted
    const matchesResource = () => getWallpaperIdentity(toValue(wallpaper), toValue(series)).assetKey === assetKey
    const finish = (status, feedback = '') => {
      if (!isCurrent())
        return
      if (matchesResource())
        setTerminal(status, feedback)
      else
        resetDownload()
    }
    clearTimeout(terminalTimer)
    controller = requestController
    downloading.value = true
    downloadFeedback.value = ''
    downloadProgress.value = { phase: 'connecting', loaded: 0, total: null }
    try {
      let downloadUrl = snapshot.downloadUrl || snapshot.url
      if (downloadProtectionEnabled()) {
        downloadProgress.value = { phase: 'verifying', loaded: 0, total: null }
        try {
          downloadUrl = await authorizeWallpaperDownload(snapshot, downloadSeries, { signal })
          signal.throwIfAborted()
        }
        catch (error) {
          if (error?.name === 'AbortError' || !isCurrent()) {
            finish('cancelled')
            return { status: 'cancelled' }
          }
          finish('blocked', error.message || '下载验证暂不可用，请稍后重试')
          return { status: 'blocked' }
        }
      }
      const result = await downloadFile(downloadUrl, buildWallpaperDownloadFilename(snapshot), {
        signal,
        onProgress(value) {
          if (isCurrent() && downloading.value && matchesResource())
            downloadProgress.value = value
        },
      })
      if (!isCurrent())
        return { status: 'cancelled' }
      if (result.status === 'opened-fallback') {
        finish(result.status, '已打开原始链接，请在新页面保存文件')
        return result
      }
      if (['browser-started', 'native-completed'].includes(result.status)) {
        trackWallpaperDownload(snapshot, downloadSeries)
        recordDownload(snapshot, downloadSeries).then((recorded) => {
          if (recorded.status === 'accepted' && !disposed && revision === generation && matchesResource())
            onRecorded?.(assetKey)
        }).catch((error) => {
          if (import.meta.env.DEV)
            console.warn('[WallpaperDownload] 下载已发起，统计上报失败:', error)
        })
        finish(result.status)
      }
      else {
        finish(TERMINAL_LABELS[result.status] ? result.status : 'failed', result.status === 'cancelled' ? '' : '下载未完成，请重试')
      }
      return result
    }
    catch (error) {
      if (error?.name === 'AbortError' || !isCurrent()) {
        finish('cancelled')
        return { status: 'cancelled' }
      }
      finish('failed', error?.name === 'TimeoutError' ? '下载超时，请稍后重试' : '下载失败，请稍后重试')
      if (import.meta.env.DEV)
        console.warn('[WallpaperDownload] 下载失败:', error)
      return { status: 'failed' }
    }
  }

  return { downloading, downloadStatus, downloadFeedback, downloadLabel, downloadPercent, canCancelDownload, handleDownload, cancelDownload, resetDownload }
}
