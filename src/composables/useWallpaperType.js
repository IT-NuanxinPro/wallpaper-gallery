import { storeToRefs } from 'pinia'
import { useSeriesStore } from '@/stores/series'

export function useWallpaperType() {
  const seriesStore = useSeriesStore()

  const {
    currentSeries,
    currentSeriesConfig,
    availableSeriesOptions,
  } = storeToRefs(seriesStore)

  return {
    currentSeries,
    currentSeriesConfig,
    availableSeriesOptions,
  }
}
