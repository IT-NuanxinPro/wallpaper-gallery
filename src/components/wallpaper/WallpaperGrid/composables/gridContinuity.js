export function classifyGridChange(previous, next, previousSeries, nextSeries) {
  if (previousSeries !== nextSeries)
    return 'series'
  if (!previous.length)
    return 'none'
  if (previous.length === next.length && previous.every((key, index) => key === next[index]))
    return 'none'
  if (next.length > previous.length && previous.every((key, index) => key === next[index]))
    return 'append'
  const previousKeys = new Set(previous)
  return next.length === previous.length && next.every(key => previousKeys.has(key)) ? 'reorder' : 'filter'
}

export function measureVisibleCards(grid, viewport = { width: globalThis.innerWidth, height: globalThis.innerHeight }) {
  const cards = new Map()
  for (const element of grid?.children || []) {
    const key = element.dataset?.gridKey
    if (!key || element.dataset.leaving === 'true')
      continue
    const rect = element.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < viewport.height && rect.right > 0 && rect.left < viewport.width) {
      const opacity = typeof getComputedStyle === 'function' ? Number(getComputedStyle(element).opacity) : 1
      cards.set(key, { element, rect, opacity })
    }
  }
  return cards
}

export function animateGridChange(previous, next, { mode, reduced = false } = {}) {
  const animations = []
  if (!reduced && ['filter', 'reorder', 'series'].includes(mode)) {
    for (const [key, { element, rect }] of next) {
      if (!element.animate)
        continue
      const old = previous.get(key)?.rect
      const opacity = previous.get(key)?.opacity ?? 1
      const offsetX = old ? old.left - rect.left : 0
      const offsetY = old ? old.top - rect.top : 0
      if (old && mode !== 'series' && (offsetX || offsetY)) {
        animations.push(element.animate([
          { transform: `translate(${offsetX}px, ${offsetY}px)`, opacity },
          { transform: 'translate(0px, 0px)', opacity: 1 },
        ], { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }))
      }
      else if (!old || mode === 'series' || opacity < 1) {
        animations.push(element.animate([{ opacity: old && mode !== 'series' ? opacity : 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' }))
      }
    }
  }
  return () => animations.forEach(animation => animation.cancel())
}
