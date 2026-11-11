import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createLatestCommunityRequest } from './profile'

// 回到页面时重新确认公开授权；离开页面立即丢弃缓存，避免账号切换串页。
export function useCommunityRequest(source, load) {
  const state = ref({ status: 'idle', data: null })
  const request = createLatestCommunityRequest({
    onState: (next) => {
      state.value = next
    },
  })
  const refresh = () => request.run(signal => load(signal))
  const onVisibility = () => {
    if (document.visibilityState === 'visible')
      refresh()
    else
      request.cancel()
  }
  watch(source, refresh, { immediate: true, flush: 'sync' })
  onMounted(() => document.addEventListener('visibilitychange', onVisibility))
  onBeforeUnmount(() => {
    request.cancel()
    document.removeEventListener('visibilitychange', onVisibility)
  })
  return { state, refresh }
}
