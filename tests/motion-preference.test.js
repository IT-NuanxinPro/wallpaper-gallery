import { effectScope } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { useMotionPreference } from '../src/composables/useMotionPreference.js'

const scopes = []
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.unstubAllGlobals()
})

it('多个控件共用动态偏好监听，切换立即同步，最后一个卸载时释放', () => {
  const listeners = new Set()
  const query = {
    matches: true,
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
  }
  vi.stubGlobal('window', { matchMedia: () => query })
  const first = effectScope()
  const second = effectScope()
  scopes.push(first, second)
  const firstPreference = first.run(useMotionPreference)
  const secondPreference = second.run(useMotionPreference)
  expect(firstPreference.value).toBe(true)
  expect(listeners.size).toBe(1)
  query.matches = false
  listeners.forEach(listener => listener(query))
  expect(firstPreference.value).toBe(false)
  expect(secondPreference.value).toBe(false)
  first.stop()
  expect(listeners.size).toBe(1)
  second.stop()
  expect(listeners.size).toBe(0)
})

it('服务端没有 window 时也能安全读取默认偏好', () => {
  vi.stubGlobal('window', undefined)
  const scope = effectScope()
  scopes.push(scope)
  expect(scope.run(useMotionPreference).value).toBe(false)
})
