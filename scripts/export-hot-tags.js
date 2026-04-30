#!/usr/bin/env node
// ========================================
// 热门标签导出脚本
// ========================================
// 基于静态热门统计 + 壁纸关键词聚合生成热门标签 JSON

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { decodeData } from '../src/utils/common/codec.js'
import stopwords from './config/hot-tags-stopwords.json' with { type: 'json' }

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SERIES_LIST = ['desktop', 'mobile', 'avatar', 'video', 'bing']
const OUTPUT_DIR = path.join(__dirname, '../public/data/stats')
const DATA_DIR = path.join(__dirname, '../public/data')
const LIMIT_PER_SERIES = 40
const LIMIT_ALL = 50
const IMAGE_SCORE_WEIGHTS = {
  view: 1,
  download: 3,
}
const DECAY_HALF_LIFE_DAYS = 90

const stopwordSet = new Set(stopwords.map(word => word.trim().toLowerCase()).filter(Boolean))

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
}

function readJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'))
}

function writeJsonFile(filename, data) {
  const filepath = path.join(OUTPUT_DIR, filename)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8')
  console.log(`导出完成: ${filename}`)
}

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

function loadDecodedBlob(filepath) {
  const raw = readJson(filepath)
  const encoded = raw.blob || raw.payload

  if (!encoded) {
    return raw.categories || raw.wallpapers || raw.items || raw
  }

  return JSON.parse(decodeData(encoded))
}

function loadSeriesWallpapers(series) {
  if (series === 'bing') {
    return loadBingWallpapers()
  }

  const indexPath = path.join(DATA_DIR, series, 'index.json')
  if (!fs.existsSync(indexPath)) {
    return []
  }
  const categories = loadDecodedBlob(indexPath)
  const wallpapers = []

  categories.forEach((category) => {
    const categoryPath = path.join(DATA_DIR, series, category.file)
    const decoded = loadDecodedBlob(categoryPath)
    const items = decoded.wallpapers || decoded.items || decoded || []
    wallpapers.push(...items)
  })

  return wallpapers
}

function loadBingWallpapers() {
  const indexPath = path.join(DATA_DIR, 'bing', 'index.json')
  const indexData = readJson(indexPath)
  const wallpapers = []

  ;(indexData.years || []).forEach((year) => {
    const yearPath = path.join(DATA_DIR, 'bing', year.file)
    const yearData = readJson(yearPath)

    ;(yearData.items || []).forEach((item) => {
      wallpapers.push({
        filename: normalizeImageId(`${item.date}.jpg`, 'bing'),
        category: item.date?.slice(0, 7) || '',
        tags: [item.title, item.date?.slice(0, 7)].filter(Boolean),
        keywords: Array.isArray(item.keywords) ? item.keywords : [],
        title: item.title || '',
        createdAt: item.date ? `${item.date}T00:00:00Z` : '',
      })
    })
  })

  return wallpapers
}

function loadSeriesStats(series) {
  const filepath = path.join(OUTPUT_DIR, `hot-${series}.json`)
  if (!fs.existsSync(filepath)) {
    console.warn(`缺少统计文件: hot-${series}.json`)
    return []
  }

  return readJson(filepath)
}

function normalizeTag(tag) {
  if (!tag || typeof tag !== 'string') {
    return ''
  }

  const normalized = tag
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .trim()

  return normalized
}

function isNoiseTag(tag) {
  if (!tag)
    return true

  const normalized = tag.toLowerCase()

  if (stopwordSet.has(normalized))
    return true

  if (normalized.length < 2 || normalized.length > 16)
    return true

  if (/^\d+$/.test(normalized))
    return true

  if (/^\d{4}(?:[-/]\d{1,2})?$/.test(normalized))
    return true

  return false
}

function extractWallpaperTags(wallpaper) {
  const candidates = [
    ...(Array.isArray(wallpaper.keywords) ? wallpaper.keywords : []),
    ...(Array.isArray(wallpaper.tags) ? wallpaper.tags : []),
    wallpaper.subcategory,
    wallpaper.category,
  ]

  const unique = new Set()

  candidates.forEach((candidate) => {
    const normalized = normalizeTag(candidate)
    if (!normalized || isNoiseTag(normalized))
      return
    unique.add(normalized)
  })

  return [...unique]
}

function getImageScore(stats) {
  return (stats.views || 0) * IMAGE_SCORE_WEIGHTS.view
    + (stats.downloads || 0) * IMAGE_SCORE_WEIGHTS.download
}

function getTimeDecayMultiplier(createdAt) {
  if (!createdAt)
    return 0.5

  const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  if (ageDays < 0)
    return 1

  return DECAY_HALF_LIFE_DAYS / (DECAY_HALF_LIFE_DAYS + ageDays)
}

function buildHotTagsForSeries(series) {
  const wallpapers = loadSeriesWallpapers(series)
  const wallpaperMap = new Map(
    wallpapers.map(wallpaper => [normalizeImageId(wallpaper.filename, series), wallpaper]),
  )
  const stats = loadSeriesStats(series)
  const tagMap = new Map()

  stats.forEach((stat) => {
    const imageId = normalizeImageId(stat.image_id, series)
    const wallpaper = wallpaperMap.get(imageId)
    if (!wallpaper)
      return

    const tags = extractWallpaperTags(wallpaper)
    if (tags.length === 0)
      return

    const views = stat.views || stat.total_views || 0
    const downloads = stat.downloads || stat.total_downloads || 0
    const rawScore = getImageScore({ views, downloads })
    const decay = getTimeDecayMultiplier(wallpaper.createdAt)
    const imageScore = Math.round(rawScore * decay)

    tags.forEach((tag) => {
      const current = tagMap.get(tag) || {
        tag,
        score: 0,
        views: 0,
        downloads: 0,
        wallpaperCount: 0,
        series: new Set(),
        topWallpapers: [],
      }

      current.score += imageScore
      current.views += views
      current.downloads += downloads
      current.wallpaperCount += 1
      current.series.add(series)

      current.topWallpapers.push({
        filename: imageId,
        thumbnailPath: wallpaper.thumbnailPath || '',
        cdnTag: wallpaper.cdnTag || '',
        score: imageScore,
      })

      tagMap.set(tag, current)
    })
  })

  return Array.from(tagMap.values())
    .map((tag) => {
      tag.topWallpapers = tag.topWallpapers
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
      tag.series = [...tag.series]
      return tag
    })
    .sort((a, b) => {
      if (b.score !== a.score)
        return b.score - a.score
      if (b.downloads !== a.downloads)
        return b.downloads - a.downloads
      if (b.views !== a.views)
        return b.views - a.views
      return a.tag.localeCompare(b.tag, 'zh-CN')
    })
}

function mergeAllSeries(seriesResults) {
  const merged = new Map()

  seriesResults.forEach(({ series, tags }) => {
    tags.forEach((tag) => {
      const current = merged.get(tag.tag) || {
        tag: tag.tag,
        score: 0,
        views: 0,
        downloads: 0,
        wallpaperCount: 0,
        series: new Set(),
        topWallpapers: [],
      }

      current.score += tag.score
      current.views += tag.views
      current.downloads += tag.downloads
      current.wallpaperCount += tag.wallpaperCount
      current.series.add(series)
      current.topWallpapers.push(
        ...tag.topWallpapers.map(wp => ({
          filename: wp.filename,
          thumbnailPath: wp.thumbnailPath || '',
          cdnTag: wp.cdnTag || '',
          score: wp.score,
        })),
      )

      merged.set(tag.tag, current)
    })
  })

  return Array.from(merged.values())
    .map((tag) => {
      tag.series = [...tag.series]
      tag.topWallpapers = tag.topWallpapers
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(item => item.filename)
      return tag
    })
    .sort((a, b) => b.score - a.score)
}

function formatPayload(series, tags, limit) {
  return {
    generatedAt: new Date().toISOString(),
    series,
    total: tags.length,
    tags: tags.slice(0, limit).map(tag => ({
      ...tag,
      topWallpapers: tag.topWallpapers.map((wp) => {
        if (typeof wp === 'string')
          return wp
        return wp.thumbnailPath
          ? { thumbnail: wp.thumbnailPath, cdnTag: wp.cdnTag || '' }
          : wp.filename
      }),
    })),
  }
}

async function main() {
  console.log('========================================')
  console.log('开始导出热门标签')
  console.log('========================================')

  ensureOutputDir()

  const seriesResults = SERIES_LIST.map((series) => {
    const tags = buildHotTagsForSeries(series)
    const payload = formatPayload(series, tags, LIMIT_PER_SERIES)
    writeJsonFile(`hot-tags-${series}.json`, payload)
    console.log(`  ${series}: ${payload.tags.length} 个标签`)
    return { series, tags }
  })

  const allTags = mergeAllSeries(seriesResults)
  writeJsonFile('hot-tags-all.json', formatPayload('all', allTags, LIMIT_ALL))

  console.log('========================================')
  console.log('热门标签导出完成')
  console.log('========================================')
}

main().catch((error) => {
  console.error('导出热门标签失败:', error)
  process.exit(1)
})
