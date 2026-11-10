import { computed, onBeforeUnmount, toValue, watch } from 'vue'
import { useModal } from '@/composables/useModal'
import { buildWallpaperAssetKey } from '@/utils/wallpaper/identity'

export function useWallpaperNavigator(results, { resultsReady = () => true } = {}) {
  const { isOpen, currentData, open, close, updateData } = useModal()

  const currentWallpaper = computed(() => currentData.value)
  const orderedResults = computed(() => toValue(results) || [])
  const currentIndex = computed(() => {
    const key = buildWallpaperAssetKey(currentWallpaper.value)
    return key ? orderedResults.value.findIndex(item => buildWallpaperAssetKey(item) === key) : -1
  })
  let preloads = []

  function cancelPreloads() {
    preloads.forEach((image) => {
      image.onload = null
      image.onerror = null
      image.src = ''
    })
    preloads = []
  }

  function handleSelectWallpaper(wallpaper) {
    open(wallpaper)
  }

  function handlePrevWallpaper() {
    if (!isOpen.value || !toValue(resultsReady) || currentIndex.value <= 0)
      return

    const prev = orderedResults.value[currentIndex.value - 1]
    if (prev) {
      updateData(prev)
    }
  }

  function handleNextWallpaper() {
    if (!isOpen.value || !toValue(resultsReady) || currentIndex.value < 0)
      return

    const next = orderedResults.value[currentIndex.value + 1]
    if (next) {
      updateData(next)
    }
  }

  watch([orderedResults, () => toValue(resultsReady)], () => {
    if (!isOpen.value || !toValue(resultsReady))
      return
    const selected = orderedResults.value[currentIndex.value]
    if (!selected)
      close()
    else if (selected !== currentWallpaper.value)
      updateData(selected)
  })

  watch([orderedResults, currentIndex, isOpen, () => toValue(resultsReady)], () => {
    cancelPreloads()
    if (!isOpen.value || !toValue(resultsReady) || currentIndex.value < 0 || typeof Image === 'undefined')
      return
    const neighbors = [orderedResults.value[currentIndex.value - 1], orderedResults.value[currentIndex.value + 1]]
    const urls = new Set(neighbors
      .filter(item => item && item.mediaType !== 'video' && item.previewUrl !== item.url && item.previewUrl !== item.downloadUrl)
      .map(item => item.previewUrl)
      .filter(url => typeof url === 'string' && url && !/\.(?:mp4|webm)(?:[?#]|$)/i.test(url)))
    urls.forEach((url) => {
      const image = new Image()
      image.decoding = 'async'
      image.src = url
      preloads.push(image)
    })
  }, { flush: 'post' })

  onBeforeUnmount(cancelPreloads)

  return {
    close,
    currentWallpaper,
    handleNextWallpaper,
    handlePrevWallpaper,
    handleSelectWallpaper,
    isOpen,
  }
}
