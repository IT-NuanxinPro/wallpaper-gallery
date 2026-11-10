import { toValue, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useInteractionStore } from '@/stores/interaction'

export function useInteractionPrefetch(records, { auth = useAuthStore(), interaction = useInteractionStore() } = {}) {
  return watch([() => toValue(records), () => auth.isConfigured, () => auth.isAuthenticated], ([items, configured, authenticated]) => {
    if (!configured || !authenticated)
      return
    for (const series of new Set(items.map(item => item.series || item._series).filter(Boolean)))
      interaction.prefetchForSeries(series)
  }, { immediate: true })
}
