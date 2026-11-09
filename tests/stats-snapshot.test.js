import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportStats } from '../scripts/export-stats.js'
import { createStatsSnapshot, fetchStatsPages, parseStatsSnapshot } from '../src/utils/stats/snapshot.js'

function rpcRow(id, series = 'desktop', totalRows = 1) {
  const imageId = `path:/wallpaper/${series}/${String(id).padStart(5, '0')}.jpg`
  return {
    asset_key: `${series}:${imageId}`,
    image_id: imageId,
    total_views: id,
    total_downloads: 2,
    total_likes: 0,
    total_collects: 0,
    week_views: 1,
    week_downloads: 0,
    month_views: 2,
    month_downloads: 1,
    period_started_at: '2026-11-09T01:00:00Z',
    week_start: '2026-11-09',
    month_start: '2026-11-01',
    total_rows: totalRows,
    legacy_ambiguous: false,
  }
}

function pagedFetch(rows, cap = 500) {
  return vi.fn(async ({ p_after, p_limit }) => rows.filter(row => row.asset_key > p_after).slice(0, Math.min(cap, p_limit)))
}

const tempDirs = []
afterEach(() => {
  vi.useRealTimers()
  for (const dir of tempDirs.splice(0))
    fs.rmSync(dir, { recursive: true, force: true })
})

describe('统计全量分页与快照', () => {
  it('超过 500 条连续分页直到空页，包含末尾低热度记录', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => rpcRow(i, 'desktop', 1001))
    const fetchPage = pagedFetch(rows)
    const result = await fetchStatsPages(fetchPage, 'desktop')
    expect(fetchPage).toHaveBeenCalledTimes(4)
    expect(result.items).toHaveLength(1001)
    expect(result.items.at(-1).views).toBe(1000)
    expect(result).toMatchObject({ periodStartedAt: '2026-11-09T01:00:00Z', weekStart: '2026-11-09', monthStart: '2026-11-01' })
  })

  it('服务器将单页限制为 100 时仍完整返回 501 条', async () => {
    const fetchPage = pagedFetch(Array.from({ length: 501 }, (_, i) => rpcRow(i, 'desktop', 501)), 100)
    const result = await fetchStatsPages(fetchPage, 'desktop')
    expect(result.items).toHaveLength(501)
    expect(fetchPage).toHaveBeenCalledTimes(7)
  })

  it('重复/倒退游标及后续分页失败均拒绝部分结果', async () => {
    await expect(fetchStatsPages(async () => [rpcRow(1)], 'desktop', 1)).rejects.toThrow('游标')
    await expect(fetchStatsPages(async () => [rpcRow(2), rpcRow(1)], 'desktop', 2)).rejects.toThrow('游标')
    const failed = vi.fn().mockResolvedValueOnce([rpcRow(1)]).mockRejectedValueOnce(new Error('network'))
    await expect(fetchStatsPages(failed, 'desktop', 1)).rejects.toThrow('network')
  })

  it('分页跨周/月或提前空页时拒绝拼接部分结果', async () => {
    const weekChanged = pagedFetch([rpcRow(1, 'desktop', 2), { ...rpcRow(2, 'desktop', 2), week_start: '2026-11-16' }], 1)
    await expect(fetchStatsPages(weekChanged, 'desktop')).rejects.toThrow('周/月边界')
    const monthChanged = pagedFetch([rpcRow(1, 'desktop', 2), { ...rpcRow(2, 'desktop', 2), month_start: '2026-12-01' }], 1)
    await expect(fetchStatsPages(monthChanged, 'desktop')).rejects.toThrow('周/月边界')
    await expect(fetchStatsPages(pagedFetch([rpcRow(1, 'desktop', 2)]), 'desktop')).rejects.toThrow('完整数据')
  })

  it('导出任何系列失败时保留整套旧快照', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-test-'))
    tempDirs.push(outputDir)
    fs.writeFileSync(path.join(outputDir, 'hot-desktop.json'), 'previous-desktop')
    fs.writeFileSync(path.join(outputDir, 'hot-video.json'), 'previous-video')
    const fetchImpl = vi.fn(async (_, options) => {
      const { p_series, p_after } = JSON.parse(options.body)
      return p_series === 'desktop'
        ? { ok: true, json: async () => p_after ? [] : [rpcRow(1)] }
        : { ok: false, status: 503 }
    })
    await expect(exportStats({ outputDir, supabaseUrl: 'https://stats.test', supabaseKey: 'public', seriesList: ['desktop', 'video'], fetchImpl })).rejects.toThrow('503')
    expect(fs.readFileSync(path.join(outputDir, 'hot-desktop.json'), 'utf8')).toBe('previous-desktop')
    expect(fs.readFileSync(path.join(outputDir, 'hot-video.json'), 'utf8')).toBe('previous-video')
    expect(fs.existsSync(path.join(outputDir, 'summary.json'))).toBe(false)
  })

  it('成功导出包含全部资源与单独保留的 legacy 总量，Bing 孤立历史也单列', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-test-'))
    tempDirs.push(outputDir)
    fs.writeFileSync(path.join(outputDir, 'hot-tags-desktop.json'), 'tags')
    const legacy = { ...rpcRow(3, 'desktop', 2), asset_key: 'desktop:same.jpg', image_id: 'same.jpg', legacy_ambiguous: true }
    const bing = { ...rpcRow(1, 'bing', 2), asset_key: 'bing:bing-2026-11-09.jpg', image_id: 'bing-2026-11-09.jpg' }
    const bingLegacy = { ...rpcRow(7, 'bing', 2), asset_key: 'bing:微信图片.jpg', image_id: '微信图片.jpg' }
    const result = await exportStats({
      outputDir, supabaseUrl: 'https://stats.test', supabaseKey: 'public', seriesList: ['desktop', 'bing'],
      fetchImpl: async (_, options) => {
        const { p_series, p_after } = JSON.parse(options.body)
        return { ok: true, json: async () => p_after ? [] : p_series === 'bing' ? [bing, bingLegacy] : [rpcRow(1, 'desktop', 2), legacy] }
      },
    })
    const payload = JSON.parse(fs.readFileSync(path.join(outputDir, 'hot-desktop.json'), 'utf8'))
    expect(payload).toMatchObject({ schema: 2, rowCount: 2, weekStart: '2026-11-09', monthStart: '2026-11-01' })
    expect(result.series.desktop).toMatchObject({ totalViews: 4, legacyViews: 3, legacyAmbiguousCount: 1 })
    expect(result.series.bing).toMatchObject({ totalViews: 8, legacyViews: 7, legacyCount: 1 })
    expect(fs.readFileSync(path.join(outputDir, 'hot-tags-desktop.json'), 'utf8')).toBe('tags')
  })

  it('以显式上海周/月边界判断当期可用，不以导出完成时间冒充统计区间', () => {
    vi.useFakeTimers()
    vi.setSystemTime('2026-11-09T00:00:00Z')
    const stats = parseStatsSnapshot(createStatsSnapshot({ items: [], periodStartedAt: null, weekStart: null, monthStart: null }), 'desktop')
    expect(stats.metadata.weekAvailable).toBe(false)
    const items = [{ ...rpcRow(1), views: 1, downloads: 2, likes: 0, collects: 0 }]
    const pageResult = { items, periodStartedAt: '2026-10-01T00:00:00Z', weekStart: '2026-11-02', monthStart: '2026-11-01' }
    const currentMonth = parseStatsSnapshot(createStatsSnapshot(pageResult, '2026-11-09T00:00:00Z'), 'desktop')
    expect(currentMonth.metadata).toMatchObject({ weekAvailable: false, monthAvailable: true })
    vi.setSystemTime('2026-12-01T00:00:00Z')
    const old = parseStatsSnapshot(createStatsSnapshot(pageResult, '2026-11-09T00:00:00Z'), 'desktop')
    expect(old.metadata).toMatchObject({ stale: true, weekAvailable: false, monthAvailable: false })
  })

  it('快照缺少期间边界或行数被截短时拒绝加载', () => {
    const items = [{ ...rpcRow(1), views: 1, downloads: 2, likes: 0, collects: 0 }]
    const payload = createStatsSnapshot({ items, periodStartedAt: '2026-11-09T00:00:00Z', weekStart: '2026-11-09', monthStart: '2026-11-01' })
    expect(() => parseStatsSnapshot({ ...payload, weekStart: undefined }, 'desktop')).toThrow('格式无效')
    expect(() => parseStatsSnapshot({ ...payload, rowCount: 2 }, 'desktop')).toThrow('格式无效')
    expect(() => parseStatsSnapshot({ ...payload, items: [] }, 'desktop')).toThrow('格式无效')
  })
})
