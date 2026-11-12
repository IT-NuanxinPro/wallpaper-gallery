import { nextTick, onScopeDispose, toValue, watch } from 'vue'

const activeDialogs = []
const focusableSelector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

// 自定义弹层共享焦点生命周期；最上层独占 Escape 和 Tab。
export function useDialogFocus(open, panel, close) {
  const identity = {}
  let trigger = null
  let generation = 0

  function focusableElements() {
    return [...(toValue(panel)?.querySelectorAll(focusableSelector) || [])]
      .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length)
  }

  function handleKeydown(event) {
    if (activeDialogs.at(-1) !== identity || !toValue(open))
      return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    }
    if (event.key !== 'Tab')
      return
    const elements = focusableElements()
    const first = elements[0]
    const last = elements.at(-1)
    const outside = !toValue(panel)?.contains(document.activeElement)
    if (!first || outside || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
      event.preventDefault()
      ;(event.shiftKey ? last : first)?.focus({ preventScroll: true })
    }
  }

  function release() {
    generation++
    const index = activeDialogs.indexOf(identity)
    if (index < 0)
      return
    const wasTop = index === activeDialogs.length - 1
    activeDialogs.splice(index, 1)
    document.removeEventListener('keydown', handleKeydown, true)
    if (wasTop && trigger?.isConnected)
      trigger.focus({ preventScroll: true })
    trigger = null
  }

  watch(() => toValue(open), async (visible) => {
    if (!visible) {
      release()
      return
    }
    trigger = document.activeElement
    activeDialogs.push(identity)
    document.addEventListener('keydown', handleKeydown, true)
    const request = ++generation
    await nextTick()
    if (request !== generation || !toValue(open))
      return
    const root = toValue(panel)
    const preferred = root?.querySelector('[data-autofocus], [aria-pressed="true"], [aria-selected="true"]')
    ;(preferred || focusableElements()[0] || root)?.focus({ preventScroll: true })
  }, { flush: 'post', immediate: true })

  onScopeDispose(release)
}
