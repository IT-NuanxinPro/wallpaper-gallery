import { effectScope } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCopyFeedback } from '../src/composables/useCopyFeedback.js'

let scope
beforeEach(() => { vi.useFakeTimers(); scope = effectScope() })
afterEach(() => { scope.stop(); vi.useRealTimers() })

it('复制中避免重复提交，成功在按钮显示1.5秒后恢复默认', async () => {
  let finish
  let attempts = 0
  const copy = scope.run(() => useCopyFeedback(() => { attempts++; return new Promise(resolve => { finish = resolve }) }))
  const pending = copy.run()
  expect(copy.pending.value).toBe(true)
  await copy.run()
  expect(attempts).toBe(1)
  finish(true)
  await pending
  expect(copy.label.value).toBe('已复制')
  expect(copy.pending.value).toBe(false)
  vi.advanceTimersByTime(1500)
  expect(copy.label.value).toBe('复制分享链接')
})

it('失败保留就近可重试状态，切换记录后忽略迟到结果并清理终态定时器', async () => {
  let attempt = 0
  let finish
  const copy = scope.run(() => useCopyFeedback(() => ++attempt === 1 ? Promise.resolve(false) : new Promise(resolve => { finish = resolve })))
  await copy.run()
  expect(copy.label.value).toBe('重试复制')
  expect(copy.feedback.value).toContain('复制失败')
  const pending = copy.run()
  copy.reset()
  finish(true)
  await pending
  expect(copy.label.value).toBe('复制分享链接')
  expect(vi.getTimerCount()).toBe(0)
})
