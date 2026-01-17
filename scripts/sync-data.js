#!/usr/bin/env node
/**
 * 数据同步脚本
 *
 * 功能：从线上图床 CDN 同步最新的壁纸数据
 *
 * 用法：
 *   npm run sync    # 同步数据（强制覆盖）
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 配置
const CONFIG = {
  // 线上数据源（图床 CDN）
  ONLINE_DATA_BASE_URL: 'https://wallpaper.061129.xyz/data',

  // 输出目录
  OUTPUT_DIR: path.resolve(__dirname, '../public/data'),

  // 系列配置
  SERIES: {
    desktop: { name: '电脑壁纸' },
    mobile: { name: '手机壁纸' },
    avatar: { name: '头像' },
    bing: { name: '每日Bing' },
  },
}

/**
 * 下载单个文件
 */
async function downloadFile(url, destPath) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const data = await response.json()
  fs.writeFileSync(destPath, JSON.stringify(data, null, 2))
  return data
}

/**
 * 获取目录下的所有 JSON 文件
 */
async function listJsonFiles(baseUrl) {
  try {
    // 尝试获取 index.json 来获取文件列表
    const indexUrl = `${baseUrl}/index.json`
    const response = await fetch(indexUrl)
    if (!response.ok)
      return []

    const indexData = await response.json()

    // 如果有 blob 字段，需要解密获取分类列表
    if (indexData.blob) {
      try {
        const { decodeData } = await import('../src/utils/codec.js')
        const jsonStr = decodeData(indexData.blob)
        const categories = JSON.parse(jsonStr)
        return categories.map(cat => cat.file)
      }
      catch (e) {
        console.log(e)
        return []
      }
    }

    return []
  }
  catch (e) {
    console.log(e)
    return []
  }
}

/**
 * 从线上同步单个系列
 */
async function syncSeries(seriesId, seriesConfig) {
  console.log(`\n📥 同步 ${seriesConfig.name} (${seriesId})...`)

  const seriesDir = path.join(CONFIG.OUTPUT_DIR, seriesId)
  const baseUrl = `${CONFIG.ONLINE_DATA_BASE_URL}/${seriesId}`

  // 创建输出目录
  if (!fs.existsSync(seriesDir)) {
    fs.mkdirSync(seriesDir, { recursive: true })
  }

  try {
    let downloadedCount = 0
    let totalItems = 0

    // 1. 下载 index.json
    const indexPath = path.join(seriesDir, 'index.json')
    const indexData = await downloadFile(`${baseUrl}/index.json`, indexPath)
    totalItems = indexData.total || 0
    downloadedCount++
    console.log(`  ✅ index.json (${totalItems} 项)`)

    // 2. 获取分类文件列表
    const categoryFiles = await listJsonFiles(baseUrl)

    // 3. 下载所有分类文件
    for (const file of categoryFiles) {
      try {
        const filePath = path.join(seriesDir, file)
        await downloadFile(`${baseUrl}/${file}`, filePath)
        downloadedCount++
        console.log(`  ✅ ${file}`)
      }
      catch (e) {
        console.warn(`  ⚠️  ${file} 下载失败`, e)
      }
    }

    // 4. 下载传统单文件（向后兼容）
    try {
      const legacyPath = path.join(CONFIG.OUTPUT_DIR, `${seriesId}.json`)
      await downloadFile(`${CONFIG.ONLINE_DATA_BASE_URL}/${seriesId}.json`, legacyPath)
      downloadedCount++
      console.log(`  ✅ ${seriesId}.json (兼容格式)`)
    }
    catch (e) {
      // 兼容格式可选
      console.log(e)
    }

    console.log(`  🎉 完成 (${downloadedCount} 个文件)`)
    return { success: true, count: totalItems, files: downloadedCount }
  }
  catch (e) {
    console.error(`  ❌ 失败: ${e.message}`)
    return { success: false, error: e.message }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(60))
  console.log('� 数据同步工具')
  console.log('='.repeat(60))
  console.log(`\n来源: ${CONFIG.ONLINE_DATA_BASE_URL}`)
  console.log(`输出: ${CONFIG.OUTPUT_DIR}`)

  // 确保输出目录存在
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true })
  }

  // 同步所有系列
  const results = []
  for (const [seriesId, seriesConfig] of Object.entries(CONFIG.SERIES)) {
    const result = await syncSeries(seriesId, seriesConfig)
    results.push({ seriesId, ...result })
  }

  // 汇总结果
  console.log(`\n${'='.repeat(60)}`)
  console.log('📊 同步汇总')
  console.log('='.repeat(60))

  let totalCount = 0
  let totalFiles = 0
  let successCount = 0

  results.forEach((result) => {
    const status = result.success ? '✅' : '❌'
    const count = result.count || 0
    const files = result.files || 0
    const info = result.error ? ` (${result.error})` : ''

    console.log(`${status} ${result.seriesId}: ${count} 项, ${files} 个文件${info}`)

    if (result.success)
      successCount++
    totalCount += count
    totalFiles += files
  })

  console.log('-'.repeat(60))
  console.log(`总计: ${totalCount} 项, ${totalFiles} 个文件`)
  console.log(`成功: ${successCount}/${Object.keys(CONFIG.SERIES).length} 个系列`)

  console.log('\n✨ 完成!\n')
}

main().catch((error) => {
  console.error('\n❌ 错误:', error.message)
  process.exit(1)
})
