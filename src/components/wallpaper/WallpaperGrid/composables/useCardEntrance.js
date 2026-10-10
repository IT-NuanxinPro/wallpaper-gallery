import { gsap } from 'gsap'
import { onBeforeUnmount, onMounted, watch } from 'vue'

// 只动画首次进入视野的卡片，不改动网格、尺寸、定位或滚动位置。
export function useCardEntrance({ displayedItems, gridRef }) {
  const entered = new WeakSet()
  const observed = new Set()
  const tweens = new Set()
  let observer
  let mediaQuery

  function reveal(cards, animate = true) {
    cards.forEach((card) => {
      observer?.unobserve(card)
      observed.delete(card)
      entered.add(card)
    })
    if (!cards.length || !animate || mediaQuery?.matches)
      return

    const tween = gsap.fromTo(cards, { opacity: 0, y: 24 }, {
      opacity: 1,
      y: 0,
      duration: 0.46,
      stagger: { amount: Math.min(0.18, (cards.length - 1) * 0.045) },
      ease: 'power3.out',
      clearProps: 'opacity,transform',
      onComplete: () => tweens.delete(tween),
    })
    tweens.add(tween)
  }

  function refresh() {
    for (const card of observed) {
      if (!card.isConnected) {
        observer?.unobserve(card)
        observed.delete(card)
      }
    }
    const fresh = [...(gridRef.value?.querySelectorAll('.wallpaper-card') || [])]
      .filter(card => !entered.has(card) && !observed.has(card))
    if (!observer || mediaQuery?.matches) {
      reveal(fresh, false)
      return
    }
    fresh.forEach((card) => {
      observed.add(card)
      observer.observe(card)
    })
  }

  function settle() {
    tweens.forEach(tween => tween.progress(1).kill())
    tweens.clear()
    if (mediaQuery?.matches)
      reveal([...observed], false)
  }

  watch([gridRef, displayedItems], refresh, { flush: 'post' })

  onMounted(() => {
    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    mediaQuery.addEventListener('change', settle)
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver((entries) => {
        reveal(entries.filter(entry => entry.isIntersecting).map(entry => entry.target))
      }, { threshold: 0.04 })
    }
    refresh()
  })

  onBeforeUnmount(() => {
    settle()
    observer?.disconnect()
    observed.clear()
    mediaQuery?.removeEventListener('change', settle)
  })
}
