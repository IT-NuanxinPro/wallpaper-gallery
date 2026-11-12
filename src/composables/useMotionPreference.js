import { getCurrentScope, onScopeDispose, readonly, ref } from 'vue'

const reducedMotion = ref(false)
const subscribers = new Set()
let mediaQuery

function updatePreference(event) {
  reducedMotion.value = event.matches
  subscribers.forEach(notify => notify(event.matches))
}

// CSS 使用同一媒体查询，JS 动画共享一个监听并随最后一个使用者释放。
export function subscribeMotionPreference(notify) {
  if (!mediaQuery) {
    mediaQuery = globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)')
    reducedMotion.value = Boolean(mediaQuery?.matches)
    mediaQuery?.addEventListener?.('change', updatePreference)
  }
  subscribers.add(notify)
  notify(reducedMotion.value)
  return () => {
    subscribers.delete(notify)
    if (!subscribers.size) {
      mediaQuery?.removeEventListener?.('change', updatePreference)
      mediaQuery = undefined
    }
  }
}

export function useMotionPreference() {
  const dispose = subscribeMotionPreference(() => {})
  if (getCurrentScope())
    onScopeDispose(dispose)
  else
    dispose()
  return readonly(reducedMotion)
}
