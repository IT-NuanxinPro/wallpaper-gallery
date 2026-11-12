import { onScopeDispose, ref, toValue, watch } from 'vue'

export function useLoadingSurface(busy, minVisible = 240, showDelay = 0) {
  const visible = ref(false)
  let hideTimer
  let showTimer
  let shownAt = 0

  watch(() => toValue(busy), (loading) => {
    clearTimeout(hideTimer)
    clearTimeout(showTimer)
    if (loading) {
      if (visible.value)
        return
      const show = () => {
        shownAt = performance.now()
        visible.value = true
      }
      if (toValue(showDelay) > 0)
        showTimer = setTimeout(show, toValue(showDelay))
      else
        show()
      return
    }
    if (!visible.value)
      return

    // 只延长视觉反馈；业务 busy 和内容交互仍由调用方即时恢复。
    const remaining = Math.max(0, toValue(minVisible) - (performance.now() - shownAt))
    if (remaining === 0) {
      visible.value = false
      return
    }
    hideTimer = setTimeout(() => {
      visible.value = false
    }, remaining)
  }, { immediate: true, flush: 'sync' })

  onScopeDispose(() => {
    clearTimeout(hideTimer)
    clearTimeout(showTimer)
  })
  return visible
}
