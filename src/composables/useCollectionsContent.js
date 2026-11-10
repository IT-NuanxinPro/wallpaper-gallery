import { onBeforeUnmount, ref } from 'vue'
import { useInteractionPrefetch } from '@/composables/useInteractionPrefetch'
import { loadCollectionWallpapers } from '@/services/collectionsService'

export function useCollectionsContent() {
  const records = ref([])
  const loading = ref(true)
  const failedKeys = ref([])
  const missingKeys = ref([])
  useInteractionPrefetch(records)
  let controller
  let revision = 0
  async function reload() {
    controller?.abort()
    controller = new AbortController()
    const version = ++revision
    loading.value = true
    try {
      const result = await loadCollectionWallpapers({ signal: controller.signal })
      if (version !== revision)
        return
      records.value = result.records
      failedKeys.value = result.failedKeys
      missingKeys.value = result.missingKeys
    }
    catch (error) {
      if (version === revision && error.name !== 'AbortError')
        failedKeys.value = ['unavailable']
    }
    finally {
      if (version === revision)
        loading.value = false
    }
  }
  reload()
  onBeforeUnmount(() => {
    revision++
    controller?.abort()
  })
  return { records, loading, failedKeys, missingKeys, reload }
}
