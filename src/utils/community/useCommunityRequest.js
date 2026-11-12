import { onBeforeUnmount, onMounted, ref, toValue, watch } from 'vue'

// 缓存只存活于当前组件；账号/授权范围变化、页面隐藏或卸载时立即失效。
export function useCommunityRequest(source, load, { cache = false, cacheScope, retainDataOnRefresh = false } = {}) {
  const state = ref({ status: 'idle', data: null })
  const entries = new Map()
  let revision = 0
  let controller
  let activeKey
  let activeScope
  let disposed = false
  const keyOf = () => JSON.stringify(toValue(source))
  const scopeOf = () => JSON.stringify(toValue(cacheScope) ?? null)
  const invalidateCache = () => entries.clear()

  async function run(force = false) {
    if (disposed)
      return
    const key = keyOf()
    const scope = scopeOf()
    const sameRequest = activeKey === key && activeScope === scope
    const previousData = sameRequest && retainDataOnRefresh ? state.value.data : null
    if (activeScope !== scope)
      invalidateCache()
    activeKey = key
    activeScope = scope
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    const current = ++revision
    const cached = entries.get(key)
    if (cache && !force && cached && Date.now() - cached.at < 30000) {
      state.value = { status: cached.data === null ? 'empty' : 'ready', data: cached.data }
      return state.value
    }
    state.value = { status: 'loading', data: previousData }
    try {
      const data = await load(signal)
      if (current !== revision || signal.aborted || disposed)
        return
      state.value = { status: data === null ? 'empty' : 'ready', data }
      if (cache) {
        entries.delete(key)
        entries.set(key, { at: Date.now(), data })
        if (entries.size > 12)
          entries.delete(entries.keys().next().value)
      }
    }
    catch (error) {
      if (current === revision && !signal.aborted && !disposed) {
        entries.delete(key)
        state.value = { status: 'error', data: previousData, error }
      }
    }
    return state.value
  }

  function cancel() {
    revision++
    controller?.abort()
    invalidateCache()
    state.value = { status: 'idle', data: null }
  }
  const refresh = () => run(true)
  const onVisibility = () => {
    if (document.visibilityState === 'visible')
      refresh()
    else
      cancel()
  }
  // 稳定序列化键避免同值数组/对象重新计算造成无意义刷新。
  watch([keyOf, scopeOf], () => run(), { immediate: true, flush: 'sync' })
  onMounted(() => document.addEventListener('visibilitychange', onVisibility))
  onBeforeUnmount(() => {
    disposed = true
    cancel()
    document.removeEventListener('visibilitychange', onVisibility)
  })
  return { state, refresh, invalidateCache }
}
