import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCachedStats, setCachedStats } from '../src/services/localStatsCache.js'
import { loadStaticStats } from '../src/services/statsService.js'
import { createStatsSnapshot, parseStatsSnapshot } from '../src/utils/stats/snapshot.js'

vi.mock('../src/services/wallpaperEventService', () => ({ recordWallpaperDownload: vi.fn(), recordWallpaperView: vi.fn() }))

let storage
beforeEach(() => {
  storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const row = {
  asset_key: 'video:path:/wallpaper/video/clip.mp4', image_id: 'path:/wallpaper/video/clip.mp4',
  views: 5, downloads: 2, likes: 0, collects: 0, week_views: 1, week_downloads: 0, month_views: 1, month_downloads: 0,
}

describe('统计快照读取与缓存', () => {
  it('旧缓存不会污染新统计，视频快照正常读取且缓存metadata', async () => {
    storage.set('stats_video', JSON.stringify({ data: [['clip.mp4', { views: 99 }]], timestamp: Date.now() }))
    const payload = createStatsSnapshot({ items: [row], periodStartedAt: '2026-11-09T00:00:00Z', weekStart: '2026-11-09', monthStart: '2026-11-01' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }))
    const result = await loadStaticStats('video')
    expect(result.get(row.asset_key).views).toBe(5)
    expect(result.metadata.schema).toBe(2)
    expect(storage.has('stats_v2_video')).toBe(true)
    expect((await loadStaticStats('video')).metadata.exportedAt).toBe(payload.exportedAt)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('损坏或部分快照拒绝加载，不写入缓存', async () => {
    const payload = createStatsSnapshot({ items: [{ ...row, week_views: undefined }], periodStartedAt: '2026-11-09T00:00:00Z', weekStart: '2026-11-09', monthStart: '2026-11-01' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }))
    await expect(loadStaticStats('video')).rejects.toThrow('week_views')
    expect(storage.has('stats_v2_video')).toBe(false)
  })

  it('旧格式保留真实历史值及schema，不能伪造期间分布', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ image_id: 'clip.mp4', views: 99 }] }))
    const result = await loadStaticStats('video')
    expect(result.get('video:clip.mp4').views).toBe(99)
    expect(result.metadata).toMatchObject({ schema: 1, periodAvailable: false, exportedAt: null })
    expect(result.get('video:clip.mp4').week_views).toBeUndefined()
  })

  it('缓存读取时重新判断是否过时和跨期，超过一小时失效', () => {
    vi.useFakeTimers()
    vi.setSystemTime('2026-11-08T15:50:00Z')
    const snapshot = parseStatsSnapshot(createStatsSnapshot({ items: [row], periodStartedAt: '2026-11-01T00:00:00Z', weekStart: '2026-11-02', monthStart: '2026-11-01' }), 'video')
    setCachedStats('video', snapshot)
    vi.setSystemTime('2026-11-08T16:10:00Z')
    expect(getCachedStats('video').metadata).toMatchObject({ weekAvailable: false, monthAvailable: true })
    vi.setSystemTime('2026-11-08T17:00:01Z')
    expect(getCachedStats('video')).toBeNull()
  })
})
