import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

export function useHeaderNavSlider({ availableSeriesOptions, currentSeries, isMobile, route }) {
  const navRef = ref(null)
  const navSliderStyle = ref({
    opacity: 0,
    width: '0px',
    transform: 'translateX(0px)',
  })
  let navSliderRafId = 0

  const isSeriesActive = computed(() => (seriesId) => {
    if (route.path === '/') {
      return currentSeries.value === seriesId
    }

    return seriesId === 'desktop'
      ? route.path === '/desktop'
      : route.path === `/${seriesId}`
  })

  const activeSeriesId = computed(() => {
    for (const option of availableSeriesOptions.value) {
      if (isSeriesActive.value(option.id))
        return option.id
    }

    return 'desktop'
  })

  function resetNavSlider() {
    navSliderStyle.value = {
      opacity: 0,
      width: '0px',
      transform: 'translateX(0px)',
    }
  }

  function measureNavSliderPosition() {
    if (!navRef.value || isMobile.value) {
      resetNavSlider()
      return false
    }

    const activeLink = navRef.value.querySelector('.nav-link.is-active, .nav-link.router-link-active')
    if (!activeLink) {
      resetNavSlider()
      return false
    }

    const navRect = navRef.value.getBoundingClientRect()
    const linkRect = activeLink.getBoundingClientRect()

    if (!linkRect.width || !navRect.width) {
      resetNavSlider()
      return false
    }

    navSliderStyle.value = {
      opacity: 1,
      width: `${linkRect.width}px`,
      transform: `translateX(${linkRect.left - navRect.left - 4}px)`,
    }
    return true
  }

  async function updateNavSliderPosition(retries = 4) {
    await nextTick()
    cancelAnimationFrame(navSliderRafId)
    navSliderRafId = requestAnimationFrame(() => {
      const positioned = measureNavSliderPosition()
      if (!positioned && retries > 0) {
        updateNavSliderPosition(retries - 1)
      }
    })
  }

  function handleResize() {
    updateNavSliderPosition()
  }

  watch(activeSeriesId, () => updateNavSliderPosition(), { flush: 'post' })
  watch(() => route.path, () => updateNavSliderPosition(), { flush: 'post' })

  onMounted(() => {
    updateNavSliderPosition()
    window.addEventListener('resize', handleResize)
    window.addEventListener('load', handleResize)

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        updateNavSliderPosition()
      })
    }
  })

  onUnmounted(() => {
    cancelAnimationFrame(navSliderRafId)
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('load', handleResize)
  })

  return {
    activeSeriesId,
    isSeriesActive,
    navRef,
    navSliderStyle,
  }
}
