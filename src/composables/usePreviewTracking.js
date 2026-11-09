import { toValue, watch } from 'vue'
import { recordView } from '@/services/statsService'
import { trackWallpaperPreview } from '@/utils/common/analytics'
import { getWallpaperIdentity } from '@/utils/wallpaper/identity'

export function isCurrentMediaEvent(event, source) {
  const loadedSource = event?.target?.currentSrc || event?.target?.src
  if (!loadedSource || !source)
    return false
  const base = globalThis.location?.href || 'http://localhost/'
  return new URL(loadedSource, base).href === new URL(source, base).href
}

export function usePreviewTracking({ wallpaper, series, isOpen, ready, enabled = true }) {
  let trackedKey = ''
  return watch([
    () => getWallpaperIdentity(toValue(wallpaper), toValue(series)).assetKey,
    () => toValue(isOpen) && toValue(enabled),
    () => toValue(ready),
  ], ([assetKey, open, loaded], previous) => {
    if (assetKey !== previous?.[0] || !open)
      trackedKey = ''
    if (!assetKey || !open || !loaded || trackedKey === assetKey)
      return

    trackedKey = assetKey
    const snapshot = { ...toValue(wallpaper) }
    const previewSeries = toValue(series)
    recordView(snapshot, previewSeries).then((result) => {
      if (result.status === 'accepted')
        trackWallpaperPreview(snapshot, previewSeries)
    }).catch((error) => {
      if (trackedKey === assetKey)
        trackedKey = ''
      if (import.meta.env.DEV)
        console.warn('[PreviewTracking] 预览统计上报失败:', error)
    })
  }, { immediate: true, flush: 'post' })
}
