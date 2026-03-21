import { computed, ref } from 'vue'

const PAGE_SIZE = 20

export function useGridPagination({ timers, wallpapers }) {
  const displayCount = ref(PAGE_SIZE)
  const isLoadingMore = ref(false)
  const scrollPaused = ref(false)

  const displayedItems = computed(() => wallpapers.value.slice(0, displayCount.value))

  const hasMoreData = computed(() => displayCount.value < wallpapers.value.length)

  function loadMore() {
    if (isLoadingMore.value || !hasMoreData.value)
      return

    isLoadingMore.value = true

    const timer = setTimeout(() => {
      timers.delete(timer)
      displayCount.value = Math.min(displayCount.value + PAGE_SIZE, wallpapers.value.length)
      isLoadingMore.value = false
    }, 150)
    timers.add(timer)
  }

  function handleScroll() {
    if (scrollPaused.value || isLoadingMore.value || !hasMoreData.value)
      return

    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const windowHeight = window.innerHeight
    const documentHeight = document.documentElement.scrollHeight

    if (scrollTop + windowHeight >= documentHeight - 200) {
      loadMore()
    }
  }

  function pauseScrollLoad() {
    scrollPaused.value = true
  }

  function resetDisplayCount() {
    displayCount.value = PAGE_SIZE
  }

  function resumeScrollLoad() {
    scrollPaused.value = false
  }

  return {
    displayCount,
    displayedItems,
    handleScroll,
    isLoadingMore,
    pauseScrollLoad,
    resetDisplayCount,
    resumeScrollLoad,
  }
}

export { PAGE_SIZE }
