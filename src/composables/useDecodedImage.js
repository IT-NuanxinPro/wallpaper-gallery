import { onScopeDispose, ref, watch } from 'vue'

export function getMediaAspectRatio(resolution, fallback = '16 / 10') {
  const width = Number(resolution?.width)
  const height = Number(resolution?.height)
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? `${width} / ${height}`
    : fallback
}

export function useDecodedImage(source, { strictDecode = false } = {}) {
  const ready = ref(false)
  const failed = ref(false)
  let version = 0
  watch(source, () => {
    version++
    ready.value = false
    failed.value = false
  }, { flush: 'sync' })
  onScopeDispose(() => {
    version++
  })

  async function handleLoad(event) {
    const currentVersion = version
    const image = event.target
    try {
      await image.decode?.()
    }
    catch {
      if (strictDecode) {
        if (currentVersion === version)
          failed.value = true
        return false
      }
      // 已完成加载的图片在部分浏览器中不支持 decode，保留原生 load 回退。
    }
    if (currentVersion !== version || !image.naturalWidth)
      return false
    ready.value = true
    failed.value = false
    return true
  }

  function handleError() {
    failed.value = true
    ready.value = false
  }

  return { ready, failed, handleLoad, handleError }
}
