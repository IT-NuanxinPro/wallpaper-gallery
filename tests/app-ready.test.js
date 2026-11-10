import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

describe('客户端首屏就绪信号', () => {
  it('等待初始路由、Vue更新及两帧绘制，不等待认证或图片', async () => {
    const modulePath = new URL('../src/utils/platform/appReady.js', import.meta.url)
    expect(fs.existsSync(modulePath)).toBe(true)
    const { signalAppReady } = await import('../src/utils/platform/appReady.js')
    const frames = []
    const attributes = new Map()
    const events = []
    let resolveRoute
    vi.stubGlobal('document', { documentElement: { setAttribute: (name, value) => attributes.set(name, value) } })
    vi.stubGlobal('window', { requestAnimationFrame: callback => frames.push(callback), dispatchEvent: event => events.push(event.type) })
    vi.stubGlobal('CustomEvent', class { constructor(type) { this.type = type } })
    try {
      const completion = signalAppReady({ isReady: () => new Promise(resolve => { resolveRoute = resolve }) })
      expect(attributes.size).toBe(0)
      resolveRoute()
      for (let index = 0; index < 6; index++) await Promise.resolve()
      expect(frames).toHaveLength(1)
      frames.shift()()
      await Promise.resolve()
      expect(attributes.size).toBe(0)
      frames.shift()()
      await completion
      expect(attributes.get('data-wallpaper-app-ready')).toBe('true')
      expect(events).toEqual(['wallpaper:app-ready'])
    }
    finally {
      vi.unstubAllGlobals()
    }
  })
})
