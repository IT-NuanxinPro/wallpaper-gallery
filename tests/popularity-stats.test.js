import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadStaticStats, loadStatsFromSupabase } from '../src/services/statsService.js'
import { usePopularityStore } from '../src/stores/popularity.js'

vi.mock('@/services/statsService', () => ({ loadStaticStats: vi.fn(), loadStatsFromSupabase: vi.fn() }))

function stats(entries, schema = 2) {
  const map = new Map(entries)
  map.metadata = { schema, exportedAt: '2026-11-09T00:00:00Z', periodAvailable: schema === 2, weekStart: '2026-11-09', monthStart: '2026-11-01', weekAvailable: true, monthAvailable: true }
  return map
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('资源身份统计和系列切换', () => {
  it('同文件名不同路径独立显示，不用 legacy 计数补缺项', async () => {
    loadStaticStats.mockResolvedValue(stats([
      ['desktop:path:/wallpaper/desktop/a/same.jpg', { views: 4, downloads: 2 }],
      ['desktop:path:/wallpaper/desktop/b/same.jpg', { views: 8, downloads: 1 }],
      ['desktop:same.jpg', { views: 900, legacy_ambiguous: true }],
    ]))
    const store = usePopularityStore()
    await store.fetchPopularityData('desktop')
    expect(store.getViewCount({ filename: 'same.jpg', path: '/wallpaper/desktop/a/same.jpg' })).toBe(4)
    expect(store.getViewCount({ filename: 'same.jpg', path: '/wallpaper/desktop/b/same.jpg' })).toBe(8)
    expect(store.getViewCount({ filename: 'same.jpg', path: '/wallpaper/desktop/c/same.jpg' })).toBe(0)
    expect(store.getViewCount('same.jpg')).toBeNull()
    store.adjustLikeCount('desktop:path:/wallpaper/desktop/a/same.jpg', 1)
    expect(store.getLikeCount({ path: '/wallpaper/desktop/a/same.jpg', filename: 'same.jpg' })).toBe(1)
  })

  it('旧快照不能将不确定单图归零或复用累计作为期间数据', async () => {
    loadStaticStats.mockResolvedValue(stats([['desktop:same.jpg', { views: 900 }]], 1))
    const store = usePopularityStore()
    await store.fetchPopularityData('desktop')
    expect(store.getViewCount({ filename: 'same.jpg', path: '/wallpaper/desktop/a/same.jpg' })).toBeNull()
    expect(store.snapshotError).toContain('旧版')
    expect(store.getPeriodScore({ filename: 'same.jpg', path: '/wallpaper/desktop/a/same.jpg' }, 'week')).toBe(0)
  })

  it('视频可以加载统计，先发出的桌面请求不能覆盖视频结果', async () => {
    let resolveDesktop
    loadStaticStats.mockImplementation(series => series === 'desktop'
      ? new Promise(resolve => resolveDesktop = resolve)
      : Promise.resolve(stats([['video:path:/wallpaper/video/clip.mp4', { views: 7 }]])))
    const store = usePopularityStore()
    const first = store.fetchPopularityData('desktop')
    await store.fetchPopularityData('video')
    resolveDesktop(stats([['desktop:path:/wallpaper/desktop/image.jpg', { views: 99 }]]))
    await first
    expect(store.currentSeries).toBe('video')
    expect(store.getViewCount({ filename: 'clip.mp4', path: '/wallpaper/video/clip.mp4' })).toBe(7)
    expect(store.statsMap.size).toBe(1)
    expect(store.loading).toBe(false)
  })

  it('页面保持打开跨上海周一时清空旧期间分数，恢复可见也刷新，释放store清理计时器', async () => {
    vi.useFakeTimers()
    vi.setSystemTime('2026-11-08T15:59:30Z')
    const listeners = new Map()
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: (event, handler) => listeners.set(event, handler),
      removeEventListener: (event, handler) => { if (listeners.get(event) === handler) listeners.delete(event) },
    })
    const map = stats([['desktop:path:/wallpaper/desktop/a.jpg', { views: 100, week_views: 10, month_views: 20 }]])
    map.metadata.weekStart = '2026-11-02'
    loadStaticStats.mockResolvedValue(map)
    const store = usePopularityStore()
    await store.fetchPopularityData('desktop')
    expect(store.getPeriodScore('desktop:path:/wallpaper/desktop/a.jpg', 'week')).toBe(10)
    await vi.advanceTimersByTimeAsync(60000)
    expect(store.getPeriodScore('desktop:path:/wallpaper/desktop/a.jpg', 'week')).toBe(0)
    expect(store.getPeriodScore('desktop:path:/wallpaper/desktop/a.jpg', 'month')).toBe(20)
    vi.setSystemTime('2026-12-01T00:00:00Z')
    listeners.get('visibilitychange')()
    expect(store.getPeriodScore('desktop:path:/wallpaper/desktop/a.jpg', 'month')).toBe(0)
    expect(loadStaticStats).toHaveBeenCalledTimes(1)
    store.$dispose()
    expect(vi.getTimerCount()).toBe(0)
    expect(listeners.size).toBe(0)
  })

  it('有效空快照不重复触发远程请求，读取失败保留上次快照并报告错误', async () => {
    const store = usePopularityStore()
    loadStaticStats.mockResolvedValue(stats([]))
    await store.fetchPopularityData('video')
    expect(loadStatsFromSupabase).not.toHaveBeenCalled()
    loadStaticStats.mockRejectedValueOnce(new Error('static unavailable'))
    loadStatsFromSupabase.mockRejectedValueOnce(new Error('RPC unavailable'))
    await store.fetchPopularityData('video', true)
    expect(store.statsMetadata.schema).toBe(2)
    expect(store.snapshotError).toContain('上次快照')
  })
})
