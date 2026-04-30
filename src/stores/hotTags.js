import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadHotTags } from '@/services/hotTagsService'

export const useHotTagsStore = defineStore('hotTags', () => {
  const currentSeries = ref('')
  const tags = ref([])
  const loading = ref(false)
  const cache = ref({})
  let requestVersion = 0

  async function fetchHotTags(series, forceRefresh = false) {
    if (!series)
      return

    if (series === 'video') {
      currentSeries.value = series
      tags.value = []
      loading.value = false
      return
    }

    if (!forceRefresh && cache.value[series]) {
      currentSeries.value = series
      tags.value = cache.value[series]
      return
    }

    const currentRequestVersion = ++requestVersion
    loading.value = true

    try {
      const data = await loadHotTags(series)

      if (currentRequestVersion !== requestVersion) {
        return
      }

      cache.value[series] = data
      currentSeries.value = series
      tags.value = data
    }
    finally {
      if (currentRequestVersion === requestVersion) {
        loading.value = false
      }
    }
  }

  return {
    cache,
    currentSeries,
    tags,
    loading,
    fetchHotTags,
  }
})
