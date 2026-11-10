import { computed, onMounted, ref, watch } from 'vue'

export function useHomeDataLoader({
  currentSeries,
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

  const loading = computed(() => wallpaperStore.loading
    || (isLoading.value && wallpaperStore.currentRenderedSeries !== currentSeries.value))
  const error = computed(() => wallpaperStore.error)

  async function loadSeriesData(series, forceRefresh = false) {
    if (!series)
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
      // 刷新不会改变已选月份，不能只依赖 categoryFilter 的变更监听。
      if (currentRequestVersion === visualRequestVersion && currentSeries.value === 'bing'
        && /^\d{4}-\d{2}$/.test(filterStore.categoryFilter)) {
        await wallpaperStore.loadBingYear(Number.parseInt(filterStore.categoryFilter.slice(0, 4)))
      }
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
    if (!isInitialized.value || currentSeries.value !== 'bing')
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
