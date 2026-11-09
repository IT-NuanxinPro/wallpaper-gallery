import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let attributes
let media
let listeners
let storage

beforeEach(() => {
  vi.resetModules()
  attributes = new Map()
  listeners = new Map()
  storage = new Map()
  media = {
    matches: false,
    addEventListener: vi.fn((name, callback) => listeners.set(name, callback)),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('window', {
    matchMedia: () => media,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    addEventListener: vi.fn((name, callback) => listeners.set(`window:${name}`, callback)), clearTimeout: vi.fn(), setTimeout: vi.fn(),
  })
  vi.stubGlobal('document', {
    documentElement: { setAttribute: (name, value) => attributes.set(name, value), style: {} },
    querySelector: () => null,
    addEventListener: vi.fn(),
    visibilityState: 'visible',
    createElement: () => ({}),
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('系统主题与桌面窗口合同', () => {
  it('区分用户选择的system模式与当前light结果，避免桌面壳把当前颜色锁为手动主题', async () => {
    const { useTheme } = await import('../src/composables/useTheme.js')
    const state = useTheme()
    state.initTheme()
    expect(attributes.get('data-theme')).toBe('light')
    expect(attributes.get('data-theme-mode')).toBe('system')
    state.setThemeMode('dark')
    expect(attributes.get('data-theme-mode')).toBe('dark')
    state.setThemeMode('system')
    expect(attributes.get('data-theme-mode')).toBe('system')
  })

  it('使用系统change事件的新值，兼容WebView媒体查询实例尚未同步的时序', async () => {
    const { useTheme } = await import('../src/composables/useTheme.js')
    const state = useTheme()
    state.initTheme()
    listeners.get('change')({ matches: true })
    expect(state.theme.value).toBe('dark')
    state.setThemeMode('light')
    listeners.get('change')({ matches: true })
    expect(state.theme.value).toBe('light')
  })

  it('页面恢复显示时重新读取系统主题，手动模式保持用户选择', async () => {
    const { useTheme } = await import('../src/composables/useTheme.js')
    const state = useTheme()
    state.initTheme()
    media.matches = true
    listeners.get('window:pageshow')()
    expect(state.theme.value).toBe('dark')
    state.setThemeMode('light')
    listeners.get('window:focus')()
    expect(state.theme.value).toBe('light')
  })
})
