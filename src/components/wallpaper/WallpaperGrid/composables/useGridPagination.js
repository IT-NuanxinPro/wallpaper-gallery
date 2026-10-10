import { computed, onUnmounted, ref } from 'vue'

const PAGE_SIZE = 20

export function useGridPagination({ wallpapers }) {
  const displayCount = ref(PAGE_SIZE)
  const isLoadingMore = ref(false)

  // RAF 节流标记
  let scrollRafId = null
  let loadRafId = null

  const displayedItems = computed(() => wallpapers.value.slice(0, displayCount.value))

  const hasMoreData = computed(() => displayCount.value < wallpapers.value.length)

  function loadMore() {
    if (isLoadingMore.value || !hasMoreData.value)
      return

    isLoadingMore.value = true

    loadRafId = requestAnimationFrame(() => {
      loadRafId = null
      displayCount.value = Math.min(displayCount.value + PAGE_SIZE, wallpapers.value.length)
      isLoadingMore.value = false
    })
  }

  function checkScroll() {
    scrollRafId = null

    if (isLoadingMore.value || !hasMoreData.value)
      return

    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const windowHeight = window.innerHeight
    const documentHeight = document.documentElement.scrollHeight

    if (scrollTop + windowHeight >= documentHeight - 200) {
      loadMore()
    }
  }

  function handleScroll() {
    if (scrollRafId)
      return
    scrollRafId = requestAnimationFrame(checkScroll)
  }

  function resetDisplayCount() {
    cancelAnimationFrame(loadRafId)
    loadRafId = null
    isLoadingMore.value = false
    displayCount.value = PAGE_SIZE
  }

  onUnmounted(() => {
    cancelAnimationFrame(scrollRafId)
    cancelAnimationFrame(loadRafId)
  })

  return {
    displayCount,
    displayedItems,
    handleScroll,
    isLoadingMore,
    resetDisplayCount,
  }
}

export { PAGE_SIZE }
