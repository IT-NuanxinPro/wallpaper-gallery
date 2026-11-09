const pendingCards = new Set()
const runningAnimations = new Map()
let observer = null
let motionPreference = null

function releaseResources() {
  if (pendingCards.size === 0) {
    observer?.disconnect()
    observer = null
  }
  if (pendingCards.size === 0 && runningAnimations.size === 0) {
    motionPreference?.removeEventListener?.('change', handleMotionChange)
    motionPreference = null
  }
}

function handleMotionChange() {
  if (!motionPreference?.matches)
    return

  pendingCards.clear()
  for (const animation of runningAnimations.values())
    animation.cancel()
  runningAnimations.clear()
  releaseResources()
}

function revealCards(entries) {
  for (const entry of entries) {
    const card = entry.target
    if (!entry.isIntersecting || !pendingCards.has(card))
      continue

    pendingCards.delete(card)
    observer?.unobserve(card)
    if (motionPreference?.matches)
      continue

    // 入场只移动卡片，不把已显示的内容重新隐藏；图片自行完成一次解码淡入。
    // 独立 translate 与悬停 transform 分离，避免两段动画抢占同一属性。
    const animation = card.animate([
      { translate: '0 12px' },
      { translate: '0 0' },
    ], {
      duration: 280,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    })
    runningAnimations.set(card, animation)
    animation.onfinish = animation.oncancel = () => {
      runningAnimations.delete(card)
      releaseResources()
    }
  }
  releaseResources()
}

export const vCardReveal = {
  mounted(card) {
    if (typeof IntersectionObserver === 'undefined' || typeof card.animate !== 'function')
      return

    if (!motionPreference) {
      motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)') || null
      motionPreference?.addEventListener?.('change', handleMotionChange)
    }
    if (motionPreference?.matches) {
      releaseResources()
      return
    }

    observer ||= new IntersectionObserver(revealCards, { rootMargin: '0px 0px 80px 0px', threshold: 0 })
    pendingCards.add(card)
    observer.observe(card)
  },
  beforeUnmount(card) {
    if (pendingCards.delete(card))
      observer?.unobserve(card)
    runningAnimations.get(card)?.cancel()
    runningAnimations.delete(card)
    releaseResources()
  },
}
