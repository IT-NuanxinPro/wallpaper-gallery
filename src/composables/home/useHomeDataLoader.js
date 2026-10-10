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
  let visualRequestVersion = 0

  const loading = computed(() => isLoading.value || wallpaperStore.loading)
  const error = computed(() => wallpaperStore.error)

  async function loadSeriesData(series, forceRefresh = false) {
    if (!series || showMobileSeriesNotice.value)
      return

    const currentRequestVersion = ++visualRequestVersion
    isLoading.value = true

    try {
      filterStore.setDefaultSortBySeries(series)

      popularityStore.fetchPopularityData(series, forceRefresh).catch((err) => {
        console.warn('[HomeDataLoader] 热门数据加载失败:', err)
      })
      hotTagsStore.fetchHotTags(series, forceRefresh).catch((err) => {
        console.warn('[HomeDataLoader] 热门标签加载失败:', err)
      })

      await wallpaperStore.initSeries(series, forceRefresh)
    }
    finally {
      if (visualRequestVersion === currentRequestVersion) {
        isLoading.value = false
      }
    }
  }

  function handleReload() {
    loadSeriesData(currentSeries.value, true)
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
    isInitialized.value = true
    await loadSeriesData(seriesStore.currentSeries)
  })

  return {
    error,
    handleReload,
    isInitialized,
    loading,
    loadSeriesData,
  }
}
