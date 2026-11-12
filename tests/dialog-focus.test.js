import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useDialogFocus } from '../src/composables/useDialogFocus.js'

afterEach(() => vi.unstubAllGlobals())

it('弹层进入选中项，Tab 限制焦点，Escape 关闭并恢复触发器', async () => {
  const document = Object.assign(new EventTarget(), { activeElement: null })
  vi.stubGlobal('document', document)
  const node = () => ({ isConnected: true, disabled: false, hidden: false, getAttribute: () => null, getClientRects: () => [1], focus() { document.activeElement = this } })
  const trigger = node()
  const first = node()
  const last = node()
  const panel = { ...node(), querySelector: () => last, querySelectorAll: () => [first, last], contains: target => target === first || target === last }
  trigger.focus()
  const open = ref(false)
  const scope = effectScope()
  scope.run(() => useDialogFocus(open, ref(panel), () => { open.value = false }))
  open.value = true
  await nextTick()
  await nextTick()
  expect(document.activeElement).toBe(last)
  const tab = new Event('keydown', { cancelable: true })
  Object.defineProperty(tab, 'key', { value: 'Tab' })
  document.dispatchEvent(tab)
  expect(document.activeElement).toBe(first)
  const escape = new Event('keydown', { cancelable: true })
  Object.defineProperty(escape, 'key', { value: 'Escape' })
  document.dispatchEvent(escape)
  await nextTick()
  expect(open.value).toBe(false)
  expect(document.activeElement).toBe(trigger)
  scope.stop()
})

it('快速开关不会让过期 focus 任务偷走焦点', async () => {
  const trigger = { isConnected: true, focus: vi.fn() }
  vi.stubGlobal('document', Object.assign(new EventTarget(), { activeElement: trigger }))
  const target = { focus: vi.fn() }
  const open = ref(false)
  const scope = effectScope()
  scope.run(() => useDialogFocus(open, ref({ querySelector: () => target, querySelectorAll: () => [target] }), () => {}))
  open.value = true
  await nextTick()
  open.value = false
  await nextTick()
  await nextTick()
  expect(target.focus).not.toHaveBeenCalled()
  scope.stop()
})
