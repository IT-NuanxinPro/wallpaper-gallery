import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { nextTick, ref, watch } from 'vue'

gsap.registerPlugin(Flip)

export function useGridAnimations({
  displayViewMode,
  displayedItems,
  gridRef,
  isMobileOrTablet,
  timers,
  viewMode,
  wrapperRef,
}) {
  const isAnimating = ref(false)
  const isFlipWarmedUp = ref(false)

  function clearWrapperHeight() {
    if (wrapperRef.value) {
      wrapperRef.value.style.minHeight = ''
    }
  }

  function lockWrapperHeight() {
    if (!wrapperRef.value)
      return

    const currentHeight = wrapperRef.value.offsetHeight
    if (currentHeight > 0) {
      wrapperRef.value.style.minHeight = `${currentHeight}px`
    }
  }

  function releaseWrapperHeight() {
    if (!wrapperRef.value)
      return

    nextTick(() => {
      const timer = setTimeout(() => {
        timers.delete(timer)
        clearWrapperHeight()
      }, 220)
      timers.add(timer)
    })
  }

  function warmupFlip() {
    if (isFlipWarmedUp.value || !gridRef.value)
      return

    const cards = gridRef.value.querySelectorAll('.wallpaper-card')
    if (cards.length > 0) {
      Flip.getState(cards, { simple: true })
      isFlipWarmedUp.value = true
    }
  }

  function cleanupCardAnimationStyles(cards) {
    cards.forEach((card) => {
      card.style.transform = ''
      card.style.opacity = ''
    })
  }

  function animateCardsIn() {
    if (!gridRef.value)
      return

    nextTick(() => {
      const cards = gridRef.value?.querySelectorAll('.wallpaper-card')
      if (!cards || cards.length === 0)
        return

      if (isMobileOrTablet.value) {
        gsap.set(cards, {
          opacity: 0,
          scale: 0.85,
          y: 20,
        })

        gsap.to(cards, {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.4,
          stagger: {
            amount: 0.35,
            from: 'start',
            grid: [2, 'auto'],
          },
          ease: 'back.out(1.2)',
          onComplete: () => cleanupCardAnimationStyles(cards),
        })
        return
      }

      gsap.set(cards, {
        opacity: 0,
        y: 15,
      })

      gsap.to(cards, {
        opacity: 1,
        y: 0,
        duration: 0.3,
        stagger: {
          amount: 0.2,
          from: 'start',
        },
        ease: 'power2.out',
        onComplete: () => {
          cleanupCardAnimationStyles(cards)
          warmupFlip()
        },
      })
    })
  }

  watch(viewMode, async (newMode, oldMode) => {
    if (!gridRef.value || newMode === oldMode)
      return

    if (isAnimating.value) {
      gsap.killTweensOf('.wallpaper-card')
    }

    isAnimating.value = true

    try {
      const cards = gridRef.value.querySelectorAll('.wallpaper-card')

      if (cards.length === 0) {
        displayViewMode.value = newMode
        isAnimating.value = false
        return
      }

      lockWrapperHeight()

      const state = Flip.getState(cards, {
        simple: true,
      })

      displayViewMode.value = newMode
      await nextTick()

      const animationConfig = isMobileOrTablet.value
        ? {
            duration: 0.35,
            ease: 'power2.out',
            stagger: {
              amount: 0.08,
              from: 'start',
              grid: [2, 'auto'],
            },
          }
        : {
            duration: 0.45,
            ease: 'power2.inOut',
            stagger: {
              amount: 0.12,
              from: 'start',
            },
          }

      Flip.from(state, {
        ...animationConfig,
        absolute: true,
        scale: true,
        onComplete: () => {
          isAnimating.value = false
          isFlipWarmedUp.value = true
          clearWrapperHeight()
        },
      })
    }
    catch (error) {
      console.warn('View mode animation error:', error)
      displayViewMode.value = newMode
      isAnimating.value = false
      clearWrapperHeight()
    }
  })

  function initializeGridAnimations() {
    if (gridRef.value && displayedItems.value.length > 0) {
      animateCardsIn()
      return
    }

    const timer = setTimeout(() => {
      timers.delete(timer)
      warmupFlip()
    }, 500)
    timers.add(timer)
  }

  function cleanupGridAnimations() {
    gsap.killTweensOf('.wallpaper-card')
    if (gridRef.value) {
      const cards = gridRef.value.querySelectorAll('.wallpaper-card')
      if (cards.length > 0) {
        gsap.killTweensOf(cards)
      }
    }
  }

  return {
    animateCardsIn,
    cleanupGridAnimations,
    initializeGridAnimations,
    isAnimating,
    lockWrapperHeight,
    releaseWrapperHeight,
    warmupFlip,
  }
}
