import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadHotTags } from '@/services/hotTagsService'
import { HOT_TAGS_CACHE_TTL_MS } from '@/utils/config/hotTags'

export const useHotTagsStore = defineStore('hotTags', () => {
  const currentSeries = ref('')
  const tags = ref([])
  const loading = ref(false)
  const cache = ref({})
  let requestVersion = 0

  async function fetchHotTags(series, forceRefresh = false) {
    if (!series)
      return

    const currentRequestVersion = ++requestVersion
    if (series === 'video') {
      currentSeries.value = series
      tags.value = []
      loading.value = false
      return
    }

    const cached = cache.value[series]
    if (!forceRefresh && cached && Date.now() - cached.fetchedAt < HOT_TAGS_CACHE_TTL_MS) {
      currentSeries.value = series
      tags.value = cached.tags
      loading.value = false
      return
    }

    tags.value = []
    loading.value = true

    try {
      const data = await loadHotTags(series)

      if (currentRequestVersion !== requestVersion) {
        return
      }

      cache.value[series] = { tags: data, fetchedAt: Date.now() }
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
