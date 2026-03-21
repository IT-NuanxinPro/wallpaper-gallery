import { watch } from 'vue'

export function useHomeSeriesSync(route, seriesStore, isInitialized) {
  function syncSeriesFromRoute() {
    const routeSeries = route.meta?.series
    if (routeSeries) {
      seriesStore.currentSeries = routeSeries
    }
    else if (!seriesStore.currentSeries) {
      seriesStore.initSeries()
    }
  }

  watch(() => route.meta?.series, (newSeries, oldSeries) => {
    if (!isInitialized.value)
      return

    if (newSeries && newSeries !== oldSeries) {
      seriesStore.initFromRoute(newSeries)
    }
  })

  return {
    syncSeriesFromRoute,
  }
}
