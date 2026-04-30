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
import { fileURLToPath, pathToFileURL } from 'node:url'
import { decodeData } from '../src/utils/common/codec.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 配置
const CONFIG = {
  // 线上数据源（使用 GitHub Raw，避免 jsDelivr @main 缓存延迟）
  ONLINE_DATA_BASE_URL: 'https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/main/data',

  // Bing 系列特殊路径（使用 /bing/meta 而不是 /data/bing）
  BING_DATA_BASE_URL: 'https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/main/bing/meta',

  // 输出目录
  OUTPUT_DIR: path.resolve(__dirname, '../public/data'),

  // 系列配置
  SERIES: {
    desktop: { name: '电脑壁纸', isBing: false },
    mobile: { name: '手机壁纸', isBing: false },
    avatar: { name: '头像', isBing: false },
    video: { name: '动态壁纸', isBing: false },
    bing: { name: '每日Bing', isBing: true },
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

export function extractCategoryFilesFromIndexData(indexData) {
  if (!indexData || typeof indexData !== 'object') {
    return []
  }

  const encoded = indexData.blob || indexData.payload
  if (encoded) {
    const decoded = JSON.parse(decodeData(encoded))
    if (!Array.isArray(decoded)) {
      return []
    }
    return decoded.map(category => category?.file).filter(Boolean)
  }

  if (Array.isArray(indexData.categories)) {
    return indexData.categories.map(category => category?.file).filter(Boolean)
  }

  return []
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

    try {
      return extractCategoryFilesFromIndexData(indexData)
    }
    catch (error) {
      console.warn('  ⚠️  解析分类索引失败:', error)
      return []
    }
  }
  catch (error) {
    console.warn('  ⚠️  获取分类文件列表失败:', error)
    return []
  }
}

/**
 * 从线上同步单个系列
 */
async function syncSeries(seriesId, seriesConfig) {
  console.log(`\n📥 同步 ${seriesConfig.name} (${seriesId})...`)

  const seriesDir = path.join(CONFIG.OUTPUT_DIR, seriesId)

  // Bing 系列使用特殊路径
  const baseUrl = seriesConfig.isBing
    ? CONFIG.BING_DATA_BASE_URL
    : `${CONFIG.ONLINE_DATA_BASE_URL}/${seriesId}`

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

    // 2. 如果是 Bing 系列，下载年度数据文件
    if (seriesConfig.isBing) {
      // 从 index.json 获取年份列表
      const years = indexData.years || []
      const currentYear = new Date().getFullYear()

      for (const yearInfo of years) {
        try {
          const filePath = path.join(seriesDir, yearInfo.file)

          // 只下载会变化的文件：latest.json、今年的年份文件
          const isLatest = yearInfo.file === 'latest.json'
          const isCurrentYear = yearInfo.year === currentYear
          const shouldDownload = isLatest || isCurrentYear

          if (!shouldDownload) {
            // 历史年份数据不会变化，检查是否存在
            if (fs.existsSync(filePath)) {
              console.log(`  ⏭️  ${yearInfo.file} (${yearInfo.year} 年) - 历史数据，跳过`)
              continue
            }
            else {
              console.log(`  📥 ${yearInfo.file} (${yearInfo.year} 年) - 首次下载`)
            }
          }

          await downloadFile(`${baseUrl}/${yearInfo.file}`, filePath)
          downloadedCount++
          console.log(`  ✅ ${yearInfo.file} (${yearInfo.year} 年)`)
        }
        catch (e) {
          console.warn(`  ⚠️  ${yearInfo.file} 下载失败`, e)
        }
      }
    }
    else {
      // 3.1 下载全局最新切片（首屏稳定加载用）
      try {
        const latestPath = path.join(seriesDir, 'latest.json')
        await downloadFile(`${baseUrl}/latest.json`, latestPath)
        downloadedCount++
        console.log('  ✅ latest.json')
      }
      catch (e) {
        console.warn('  ⚠️  latest.json 下载失败', e)
      }

      // 3. 普通系列：获取分类文件列表
      const categoryFiles = await listJsonFiles(baseUrl)

      // 4. 下载所有分类文件
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

      // 5. 下载传统单文件（向后兼容）
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
  console.log('📦 数据同步工具')
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('\n❌ 错误:', error.message)
    process.exit(1)
  })
}
