import { computed } from 'vue'
import { useModal } from '@/composables/useModal'

export function useWallpaperNavigator(wallpaperStore) {
  const { isOpen, currentData, open, close, updateData } = useModal()

  const currentWallpaper = computed(() => currentData.value)

  function handleSelectWallpaper(wallpaper) {
    open(wallpaper)
  }

  function handlePrevWallpaper() {
    if (!currentWallpaper.value)
      return

    const prev = wallpaperStore.getPrevWallpaper(currentWallpaper.value.id)
    if (prev) {
      updateData(prev)
    }
  }

  function handleNextWallpaper() {
    if (!currentWallpaper.value)
      return

    const next = wallpaperStore.getNextWallpaper(currentWallpaper.value.id)
    if (next) {
      updateData(next)
    }
  }

  return {
    close,
    currentWallpaper,
    handleNextWallpaper,
    handlePrevWallpaper,
    handleSelectWallpaper,
    isOpen,
  }
}
