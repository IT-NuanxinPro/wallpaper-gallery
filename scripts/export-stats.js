#!/usr/bin/env node
// ========================================
// 静态统计导出脚本
// ========================================
// 从 Supabase 导出热门统计数据到静态 JSON 文件
// 用于 GitHub Actions 定时任务

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从环境变量获取配置
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

// 导出配置
const SERIES_LIST = ['desktop', 'mobile', 'avatar', 'video', 'bing']
const OUTPUT_DIR = path.join(__dirname, '../public/data/stats')
const LIMIT_PER_SERIES = 500 // 每个系列导出前 500 条

function normalizeImageId(imageId, series) {
  if (!imageId)
    return ''

  if (series === 'bing') {
    if (/^bing-\d{4}-\d{2}-\d{2}\.jpg$/i.test(imageId)) {
      return imageId
    }

    if (/^\d{4}-\d{2}-\d{2}\.jpg$/i.test(imageId)) {
      return `bing-${imageId}`
    }
  }

  return imageId
}

/**
 * 检查 Supabase 配置
 */
function checkConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('错误: 缺少 Supabase 配置')
    console.error('请设置环境变量: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY')
    process.exit(1)
  }
}

/**
 * 调用 Supabase RPC 获取热门数据
 */
async function fetchHotStats(series, limit = LIMIT_PER_SERIES) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_hot_stats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      series_filter: series,
      limit_count: limit,
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }

  return response.json()
}

/**
 * 格式化导出数据
 */
function formatExportData(rawData) {
  return rawData
}

function mergeExportData(rawData, series) {
  const merged = new Map()

  rawData.forEach((item) => {
    const imageId = normalizeImageId(item.image_id, series)
    if (!imageId)
      return

    const prev = merged.get(imageId) || { image_id: imageId, views: 0, downloads: 0, likes: 0, collects: 0 }
    prev.views += item.total_views || 0
    prev.downloads += item.total_downloads || 0
    prev.likes += item.total_likes || 0
    prev.collects += item.total_collects || 0
    merged.set(imageId, prev)
  })

  return Array.from(merged.values())
    .sort((a, b) => {
      if (b.views !== a.views)
        return b.views - a.views
      if (b.downloads !== a.downloads)
        return b.downloads - a.downloads
      return a.image_id.localeCompare(b.image_id, 'zh-CN')
    })
}

/**
 * 确保输出目录存在
 */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    console.log(`创建目录: ${OUTPUT_DIR}`)
  }
}

/**
 * 格式化时间为 YYYY-MM-DD HH:mm:ss
 */
function formatDateTime(date = new Date()) {
  const pad = value => String(value).padStart(2, '0')

  return `${[
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-')} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * 写入 JSON 文件
 */
function writeJsonFile(filename, data) {
  const filepath = path.join(OUTPUT_DIR, filename)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8')

  if (Array.isArray(data)) {
    console.log(`导出完成: ${filename} (${data.length} 条)`)
    return
  }

  console.log(`导出完成: ${filename}`)
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================')
  console.log('开始导出热门统计数据')
  console.log('========================================')

  checkConfig()
  ensureOutputDir()

  const summary = {
    exportedAt: formatDateTime(),
    series: {},
  }

  for (const series of SERIES_LIST) {
    try {
      console.log(`\n正在导出: ${series}...`)

      const rawData = await fetchHotStats(series)
      const formattedData = mergeExportData(formatExportData(rawData), series)

      // 写入单独的系列文件
      writeJsonFile(`hot-${series}.json`, formattedData)

      // 记录摘要
      summary.series[series] = {
        count: formattedData.length,
        totalViews: formattedData.reduce((sum, item) => sum + item.views, 0),
        totalDownloads: formattedData.reduce((sum, item) => sum + item.downloads, 0),
      }
    }
    catch (error) {
      console.error(`导出 ${series} 失败:`, error.message)
      summary.series[series] = { error: error.message }
    }
  }

  // 写入摘要文件
  writeJsonFile('summary.json', summary)

  console.log('\n========================================')
  console.log('导出完成!')
  console.log('========================================')
  console.log('\n摘要:')
  Object.entries(summary.series).forEach(([series, info]) => {
    if (info.error) {
      console.log(`  ${series}: 错误 - ${info.error}`)
    }
    else {
      console.log(`  ${series}: ${info.count} 条, ${info.totalViews} 浏览, ${info.totalDownloads} 下载`)
    }
  })
}

// 运行
main().catch((error) => {
  console.error('导出失败:', error)
  process.exit(1)
})
