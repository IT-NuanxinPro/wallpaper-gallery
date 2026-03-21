import { ref } from 'vue'

const MOBILE_VIEW_MODE_ORDER = ['grid', 'list']

function getModeIndex(mode) {
  return MOBILE_VIEW_MODE_ORDER.indexOf(mode)
}

export function useGridTouchMode({ isMobileOrTablet, setViewMode, viewMode }) {
  const touchStartX = ref(0)
  const touchStartY = ref(0)
  const isSwiping = ref(false)

  function handleTouchStart(e) {
    if (!isMobileOrTablet.value)
      return

    touchStartX.value = e.touches[0].clientX
    touchStartY.value = e.touches[0].clientY
    isSwiping.value = false
  }

  function handleTouchMove(e) {
    if (!isMobileOrTablet.value)
      return

    const deltaX = e.touches[0].clientX - touchStartX.value
    const deltaY = e.touches[0].clientY - touchStartY.value

    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && Math.abs(deltaX) > 30) {
      isSwiping.value = true
    }
  }

  function handleTouchEnd(e) {
    if (!isMobileOrTablet.value || !isSwiping.value)
      return

    const deltaX = e.changedTouches[0].clientX - touchStartX.value
    if (Math.abs(deltaX) > 80) {
      const currentIndex = getModeIndex(viewMode.value)
      const newIndex = deltaX < 0
        ? (currentIndex + 1) % MOBILE_VIEW_MODE_ORDER.length
        : (currentIndex - 1 + MOBILE_VIEW_MODE_ORDER.length) % MOBILE_VIEW_MODE_ORDER.length

      setViewMode(MOBILE_VIEW_MODE_ORDER[newIndex])
    }

    isSwiping.value = false
  }

  return {
    handleTouchEnd,
    handleTouchMove,
    handleTouchStart,
  }
}
