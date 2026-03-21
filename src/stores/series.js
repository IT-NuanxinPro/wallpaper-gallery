import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getDeviceTypeRef } from '@/composables/useDevice'
import { DEFAULT_SERIES, DEVICE_SERIES, SERIES_CONFIG, STORAGE_KEYS } from '@/utils/config/constants'

export const useSeriesStore = defineStore('series', () => {
  const currentSeries = ref(null)
  const deviceType = getDeviceTypeRef()
  const availableSeries = computed(() => DEVICE_SERIES[deviceType.value] || DEVICE_SERIES.desktop)
  const currentSeriesConfig = computed(() => currentSeries.value ? SERIES_CONFIG[currentSeries.value] : null)
  const availableSeriesOptions = computed(() => availableSeries.value.map(seriesId => SERIES_CONFIG[seriesId]))

  function initSeries() {
    const savedSeries = localStorage.getItem(STORAGE_KEYS.CURRENT_SERIES)
    if (savedSeries && availableSeries.value.includes(savedSeries)) {
      currentSeries.value = savedSeries
      return savedSeries
    }

    const device = deviceType.value
    const defaultSeries = DEFAULT_SERIES[device] || 'desktop'
    currentSeries.value = defaultSeries
    return defaultSeries
  }

  function initFromRoute(seriesId) {
    if (seriesId && availableSeries.value.includes(seriesId)) {
      currentSeries.value = seriesId
      localStorage.setItem(STORAGE_KEYS.CURRENT_SERIES, seriesId)
    }
  }

  function switchSeries(seriesId) {
    if (!availableSeries.value.includes(seriesId)) {
      console.warn(`Series ${seriesId} is not available for current device`)
      return false
    }

    currentSeries.value = seriesId
    localStorage.setItem(STORAGE_KEYS.CURRENT_SERIES, seriesId)
    return true
  }

  function isSeriesAvailable(seriesId) {
    return availableSeries.value.includes(seriesId)
  }

  return {
    currentSeries,
    deviceType,
    availableSeries,
    currentSeriesConfig,
    availableSeriesOptions,
    initSeries,
    initFromRoute,
    switchSeries,
    isSeriesAvailable,
  }
})
