import { computed, nextTick, onUnmounted, ref, shallowRef, toValue, watch } from 'vue'

const PAGE_SIZE = 20

export function useGridPagination({ wallpapers, minimumDisplayCount = PAGE_SIZE }) {
  const requestedCount = () => Math.max(PAGE_SIZE, Math.min(100000, Math.ceil(Number(toValue(minimumDisplayCount)) || PAGE_SIZE)))
  const displayCount = ref(requestedCount())
  const isLoadingMore = ref(false)
  const loadMoreSentinel = shallowRef(null)
  const observationVersion = ref(0)
  const supportsIntersectionObserver = typeof IntersectionObserver !== 'undefined'

  let loadRafId = null
  let observer = null
  let disposed = false
  let loadGeneration = 0

  const displayedItems = computed(() => wallpapers.value.slice(0, displayCount.value))

  const hasMoreData = computed(() => displayCount.value < wallpapers.value.length)

  function loadMore() {
    if (disposed || isLoadingMore.value || !hasMoreData.value)
      return

    isLoadingMore.value = true
    const generation = loadGeneration

    loadRafId = requestAnimationFrame(async () => {
      loadRafId = null
      displayCount.value = Math.min(displayCount.value + PAGE_SIZE, wallpapers.value.length)
      // 等当前批次完成渲染，再接受下一次观察回调。
      await nextTick()
      if (!disposed && generation === loadGeneration) {
        isLoadingMore.value = false
        observationVersion.value += 1
      }
    })
  }

  watch([loadMoreSentinel, hasMoreData, observationVersion], ([target, hasMore]) => {
    observer?.disconnect()
    observer = null
    if (!target || !hasMore || !supportsIntersectionObserver || disposed)
      return

    let wasIntersecting = false
    const currentObserver = new IntersectionObserver((entries) => {
      if (observer !== currentObserver || disposed)
        return
      for (const entry of entries) {
        if (entry.target !== target)
          continue
        if (entry.isIntersecting && !wasIntersecting)
          loadMore()
        wasIntersecting = entry.isIntersecting
      }
    }, { rootMargin: '0px 0px 240px 0px' })
    observer = currentObserver
    observer.observe(target)
  }, { flush: 'post' })

  function resetDisplayCount() {
    loadGeneration += 1
    cancelAnimationFrame(loadRafId)
    loadRafId = null
    isLoadingMore.value = false
    displayCount.value = requestedCount()
    observationVersion.value += 1
  }

  watch(() => toValue(minimumDisplayCount), () => {
    displayCount.value = requestedCount()
  })

  onUnmounted(() => {
    disposed = true
    observer?.disconnect()
    observer = null
    cancelAnimationFrame(loadRafId)
  })

  return {
    displayCount,
    displayedItems,
    hasMoreData,
    loadMore,
    loadMoreSentinel,
    supportsIntersectionObserver,
    isLoadingMore,
    resetDisplayCount,
  }
}

export { PAGE_SIZE }
