import { computed, onMounted, ref, watch } from 'vue'
import { buildRawImageUrl } from '@/utils/common/format'
import { SERIES_CONFIG } from '@/utils/config/constants'

const PRELOAD_COUNT = 20
const PRELOAD_TIMEOUT_MS = 8000
const SINGLE_IMAGE_TIMEOUT_MS = 4000

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

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  function getThumbnailCandidates(wallpaper) {
    if (!wallpaper) {
      return []
    }

    const candidates = [
      wallpaper.previewUrl,
      wallpaper.thumbnailUrl,
      wallpaper.url,
    ].filter(Boolean)

    candidates.push(...candidates.map(url => buildRawImageUrl(url)).filter(Boolean))

    return [...new Set(candidates)]
  }

  function preloadImage(url) {
    return new Promise((resolve) => {
      if (!url) {
        resolve(false)
        return
      }

      const image = new window.Image()
      let settled = false
      let timer = null

      const cleanup = () => {
        image.onload = null
        image.onerror = null
        clearTimeout(timer)
      }

      const finish = (loaded) => {
        if (settled) {
          return
        }

        settled = true
        cleanup()
        resolve(loaded)
      }

      timer = window.setTimeout(() => finish(false), SINGLE_IMAGE_TIMEOUT_MS)

      image.decoding = 'async'
      image.onload = () => finish(true)
      image.onerror = () => finish(false)
      image.src = url

      if (image.complete && image.naturalWidth > 0) {
        finish(true)
      }
    })
  }

  async function preloadWallpaperThumbnail(wallpaper) {
    const candidates = getThumbnailCandidates(wallpaper)
    for (const url of candidates) {
      const loaded = await preloadImage(url)
      if (loaded) {
        return true
      }
    }
    return false
  }

  async function preloadVisibleWallpapers(wallpapers) {
    const preloadTargets = wallpapers.slice(0, PRELOAD_COUNT)
    if (preloadTargets.length === 0) {
      return
    }

    await Promise.race([
      Promise.allSettled(preloadTargets.map(preloadWallpaperThumbnail)),
      wait(PRELOAD_TIMEOUT_MS),
    ])
  }

  async function loadSeriesData(series, forceRefresh = false) {
    if (!series || showMobileSeriesNotice.value)
      return

    const currentRequestVersion = ++visualRequestVersion
    isLoading.value = true

    try {
      filterStore.setDefaultSortBySeries(series)

      const latestPreloadPromise = SERIES_CONFIG[series]?.latestUrl
        ? wallpaperStore.loadSeriesLatest(series, forceRefresh)
            .then(items => preloadVisibleWallpapers(items))
            .catch((err) => {
              console.warn('[HomeDataLoader] 最新切片预热失败:', err)
            })
        : Promise.resolve()

      popularityStore.fetchPopularityData(series, forceRefresh).catch((err) => {
        console.warn('[HomeDataLoader] 热门数据加载失败:', err)
      })
      hotTagsStore.fetchHotTags(series, forceRefresh).catch((err) => {
        console.warn('[HomeDataLoader] 热门标签加载失败:', err)
      })

      await wallpaperStore.initSeries(series, forceRefresh)

      if (visualRequestVersion !== currentRequestVersion) {
        return
      }

      await Promise.allSettled([
        latestPreloadPromise,
        preloadVisibleWallpapers(wallpaperStore.wallpapers),
      ])
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
