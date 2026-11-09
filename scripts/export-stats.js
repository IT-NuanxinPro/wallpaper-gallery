#!/usr/bin/env node
// 全量统计导出：所有系列完整读取成功后，才替换静态快照目录。
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createStatsSnapshot, fetchStatsPages, parseStatsSnapshot } from '../src/utils/stats/snapshot.js'

const OUTPUT_DIR = fileURLToPath(new URL('../public/data/stats', import.meta.url))
const SERIES_LIST = ['desktop', 'mobile', 'avatar', 'video', 'bing']

export async function exportStats({
  supabaseUrl = process.env.VITE_SUPABASE_URL,
  supabaseKey = process.env.VITE_SUPABASE_ANON_KEY,
  outputDir = OUTPUT_DIR,
  fetchImpl = fetch,
  seriesList = SERIES_LIST,
} = {}) {
  if (!supabaseUrl || !supabaseKey)
    throw new Error('缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY')

  const exportedAt = new Date().toISOString()
  const snapshots = new Map()
  const summary = { schema: 2, exportedAt, series: {} }

  for (const series of seriesList) {
    const pageResult = await fetchStatsPages(async (params) => {
      const response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/get_stats_page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(30000),
      })
      if (!response.ok)
        throw new Error(`导出 ${series} 失败: HTTP ${response.status}`)
      return response.json()
    }, series)

    const { items, periodStartedAt, weekStart, monthStart } = pageResult
    const snapshot = createStatsSnapshot(pageResult, exportedAt)
    parseStatsSnapshot(snapshot, series)
    snapshots.set(`hot-${series}.json`, snapshot)
    const legacy = items.filter(item => !(series === 'bing'
      ? /^bing-\d{4}-\d{2}-\d{2}\.jpg$/i.test(item.image_id)
      : item.image_id.startsWith(`path:/wallpaper/${series}/`)))
    summary.series[series] = {
      count: items.length,
      totalViews: items.reduce((sum, item) => sum + item.views, 0),
      totalDownloads: items.reduce((sum, item) => sum + item.downloads, 0),
      periodStartedAt,
      weekStart,
      monthStart,
      legacyCount: legacy.length,
      legacyAmbiguousCount: legacy.filter(item => item.legacy_ambiguous).length,
      legacyViews: legacy.reduce((sum, item) => sum + item.views, 0),
      legacyDownloads: legacy.reduce((sum, item) => sum + item.downloads, 0),
    }
  }
  snapshots.set('summary.json', summary)

  fs.mkdirSync(path.dirname(outputDir), { recursive: true })
  const stagingDir = fs.mkdtempSync(path.join(path.dirname(outputDir), '.stats-export-'))
  const backupDir = `${stagingDir}-previous`
  let backedUp = false
  try {
    if (fs.existsSync(outputDir))
      fs.cpSync(outputDir, stagingDir, { recursive: true })
    for (const [filename, payload] of snapshots)
      fs.writeFileSync(path.join(stagingDir, filename), JSON.stringify(payload, null, 2), 'utf8')

    if (fs.existsSync(outputDir)) {
      fs.renameSync(outputDir, backupDir)
      backedUp = true
    }
    try {
      fs.renameSync(stagingDir, outputDir)
    }
    catch (error) {
      if (backedUp)
        fs.renameSync(backupDir, outputDir)
      throw error
    }
    if (backedUp)
      fs.rmSync(backupDir, { recursive: true })
  }
  finally {
    if (fs.existsSync(stagingDir))
      fs.rmSync(stagingDir, { recursive: true })
  }
  return summary
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  exportStats().then((summary) => {
    for (const [series, info] of Object.entries(summary.series))
      console.log(`${series}: ${info.count} 条，${info.totalViews} 浏览，${info.totalDownloads} 下载`)
  }).catch((error) => {
    console.error('统计导出失败:', error.message)
    process.exitCode = 1
  })
}
