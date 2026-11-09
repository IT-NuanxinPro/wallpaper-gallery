import { describe, expect, it, vi } from 'vitest'
import { createWallpaperEventRecorder, getWallpaperSessionId } from '../src/services/wallpaperEventService.js'

function createStorage() {
  const values = new Map()
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
}

const wallpaper = { filename: 'same.jpg', path: '/wallpaper/desktop/a/same.jpg' }

describe('壁纸事件幂等与重试', () => {
  it('同一会话跨实例稳定，存储不可用时仍有合法会话ID', () => {
    const storage = createStorage()
    expect(getWallpaperSessionId(storage)).toBe(getWallpaperSessionId(storage))
    expect(getWallpaperSessionId(null)).toMatch(/^[\da-f-]{36}$/i)
  })

  it('网络错误、429和5xx有限重试，始终使用同一个事件ID', async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockRejectedValueOnce(Object.assign(new Error('busy'), { status: 503 }))
      .mockResolvedValue({ status: 'accepted' })
    const recorder = createWallpaperEventRecorder({ send, storage: createStorage(), wait: async () => {} })
    await expect(recorder.recordDownload(wallpaper, 'desktop')).resolves.toEqual({ status: 'accepted' })
    expect(send).toHaveBeenCalledTimes(3)
    expect(new Set(send.mock.calls.map(([event]) => event.p_event_id)).size).toBe(1)
    expect(send.mock.calls[0][0]).toMatchObject({ p_event_type: 'download' })
  })

  it('并发预览共享请求，成功后10分钟去重，刷新仍保留去重状态', async () => {
    const storage = createStorage()
    let finish
    let now = 1_000_000
    const send = vi.fn(() => new Promise(resolve => { finish = resolve }))
    const recorder = createWallpaperEventRecorder({ send, storage, now: () => now })
    const first = recorder.recordView(wallpaper, 'desktop')
    const second = recorder.recordView(wallpaper, 'desktop')
    expect(send).toHaveBeenCalledOnce()
    finish({ status: 'accepted' })
    await Promise.all([first, second])
    const refreshed = createWallpaperEventRecorder({ send, storage, now: () => now })
    await expect(refreshed.recordView(wallpaper, 'desktop')).resolves.toEqual({ status: 'duplicate' })
    expect(send).toHaveBeenCalledOnce()
    now += 600_001
    const next = refreshed.recordView(wallpaper, 'desktop')
    expect(send).toHaveBeenCalledTimes(2)
    finish({ status: 'accepted' })
    await next
  })

  it('失败不标记预览成功，重新打开复用未确认事件，4xx不自动重试', async () => {
    const send = vi.fn().mockRejectedValueOnce(Object.assign(new Error('denied'), { status: 403 }))
      .mockResolvedValue({ status: 'accepted' })
    const recorder = createWallpaperEventRecorder({ send, storage: createStorage() })
    await expect(recorder.recordView(wallpaper, 'desktop')).rejects.toThrow('denied')
    expect(send).toHaveBeenCalledOnce()
    await recorder.recordView(wallpaper, 'desktop')
    expect(send.mock.calls[0][0].p_event_id).toBe(send.mock.calls[1][0].p_event_id)
  })

  it('下载每次新操作独立计数，同名不同路径预览分别计数', async () => {
    const send = vi.fn().mockResolvedValue({ status: 'accepted' })
    const recorder = createWallpaperEventRecorder({ send, storage: createStorage() })
    await recorder.recordDownload(wallpaper, 'desktop')
    await recorder.recordDownload(wallpaper, 'desktop')
    await recorder.recordView(wallpaper, 'desktop')
    await recorder.recordView({ ...wallpaper, path: '/wallpaper/desktop/b/same.jpg' }, 'desktop')
    expect(send).toHaveBeenCalledTimes(4)
    expect(new Set(send.mock.calls.map(([event]) => event.p_event_id)).size).toBe(4)
    expect(send.mock.calls[2][0].p_asset_key).not.toBe(send.mock.calls[3][0].p_asset_key)
  })

  it.each([429, 500])('HTTP %s 重试耗尽后停止，下一次预览仍可继续上报', async (status) => {
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('retryable'), { status }))
    const recorder = createWallpaperEventRecorder({ send, storage: createStorage(), wait: async () => {} })
    await expect(recorder.recordView(wallpaper, 'desktop')).rejects.toThrow('retryable')
    expect(send).toHaveBeenCalledTimes(3)
    send.mockResolvedValue({ status: 'accepted' })
    await recorder.recordView(wallpaper, 'desktop')
    expect(send).toHaveBeenCalledTimes(4)
    expect(new Set(send.mock.calls.map(([event]) => event.p_event_id)).size).toBe(1)
  })
})
