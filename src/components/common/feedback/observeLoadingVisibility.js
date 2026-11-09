const targets = new Map()
let observer

function updateVisibility() {
  for (const state of targets.values())
    state.update(state.intersecting && !document.hidden)
}

export function observeLoadingVisibility(element, update) {
  if (!targets.size) {
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const state = targets.get(entry.target)
          if (!state)
            continue
          state.intersecting = entry.isIntersecting
          state.update(state.intersecting && !document.hidden)
        }
      })
    }
    document.addEventListener('visibilitychange', updateVisibility)
  }

  // 所有加载器共用一个观察器与页面事件，离屏时不持续运行 SVG 动画。
  const state = { update, intersecting: !observer }
  targets.set(element, state)
  update(state.intersecting && !document.hidden)
  observer?.observe(element)

  return () => {
    if (targets.get(element) !== state)
      return
    targets.delete(element)
    observer?.unobserve(element)
    if (!targets.size) {
      observer?.disconnect()
      observer = undefined
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }
}
