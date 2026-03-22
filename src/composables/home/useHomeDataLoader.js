import { computed, onMounted, ref, watch } from 'vue'

export function useHomeDataLoader({
  currentSeries,
  showMobileSeriesNotice,
  filterStore,
  hotTagsStore,
  popularityStore,
  seriesStore,
  syncSeriesFromRoute,
  wallpaperStore,
}) {
  const isInitialized = ref(false)
  const isLoading = ref(false)

  const loading = computed(() => isLoading.value || wallpaperStore.loading || popularityStore.loading)
  const error = computed(() => wallpaperStore.error)

  async function loadSeriesData(series) {
    if (!series || isLoading.value || showMobileSeriesNotice.value)
      return

    isLoading.value = true

    try {
      filterStore.setDefaultSortBySeries(series)

      await Promise.all([
        wallpaperStore.initSeries(series),
        popularityStore.fetchPopularityData(series),
        hotTagsStore.fetchHotTags(series),
      ])
    }
    finally {
      isLoading.value = false
    }
  }

  function handleReload() {
    wallpaperStore.initSeries(currentSeries.value, true)
  }

  watch(currentSeries, async (newSeries, oldSeries) => {
    if (!isInitialized.value)
      return

    if (newSeries && newSeries !== oldSeries) {
      await loadSeriesData(newSeries)
    }
  })

  watch(() => filterStore.categoryFilter, async (newValue) => {
    if (!isInitialized.value || currentSeries.value !== 'bing' || showMobileSeriesNotice.value)
      return

    if (newValue && /^\d{4}-\d{2}$/.test(newValue)) {
      const year = Number.parseInt(newValue.split('-')[0])
      await wallpaperStore.loadBingYear(year)
    }
  })

  onMounted(async () => {
    syncSeriesFromRoute()
    await loadSeriesData(seriesStore.currentSeries)
    isInitialized.value = true
  })

  return {
    error,
    handleReload,
    isInitialized,
    loading,
    loadSeriesData,
  }
}
