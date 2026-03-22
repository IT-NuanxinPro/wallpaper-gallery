import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadHotTags } from '@/services/hotTagsService'

export const useHotTagsStore = defineStore('hotTags', () => {
  const currentSeries = ref('')
  const tags = ref([])
  const loading = ref(false)
  const cache = ref({})

  async function fetchHotTags(series, forceRefresh = false) {
    if (!series)
      return

    if (!forceRefresh && cache.value[series]) {
      currentSeries.value = series
      tags.value = cache.value[series]
      return
    }

    loading.value = true

    try {
      const data = await loadHotTags(series)
      cache.value[series] = data
      currentSeries.value = series
      tags.value = data
    }
    finally {
      loading.value = false
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
