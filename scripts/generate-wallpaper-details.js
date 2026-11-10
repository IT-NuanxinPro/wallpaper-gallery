#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { WALLPAPER_COLLECTIONS } from '../src/content/collections.js'
import { buildWallpaperDetailRecord } from '../src/utils/wallpaper/detailRecords.js'
import { getWallpaperDetailBucketPath } from '../src/utils/wallpaper/share.js'
import { loadWallpaperMetadata } from './lib/wallpaperMetadata.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export async function generateWallpaperDetails({ dataDir = path.join(projectRoot, 'public/data'), outputDir = path.join(dataDir, 'details'), defaultCdnTag } = {}) {
  if (!defaultCdnTag) {
    const constants = await fs.readFile(path.join(projectRoot, 'src/utils/config/constants.js'), 'utf8')
    defaultCdnTag = constants.match(/export const CDN_VERSION = '([^']+)'/)?.[1]
  }
  const wallpapers = await loadWallpaperMetadata(dataDir)
  const buckets = Array.from({ length: 64 }, () => ({}))
  const catalog = []
  const skippedItems = []
  const curatedKeys = new Set(WALLPAPER_COLLECTIONS.flatMap(collection => collection.items))
  const curatedRecords = {}
  for (const wallpaper of wallpapers) {
    const record = buildWallpaperDetailRecord(wallpaper, defaultCdnTag)
    if (!record) {
      skippedItems.push({ series: wallpaper._series, filename: wallpaper.filename, reason: wallpaper._series === 'bing' ? 'invalid-bing-urlbase' : 'invalid-share-identity-or-resource' })
      continue
    }
    const token = record.sharePath.slice('/wallpaper/'.length)
    const bucket = Number.parseInt(getWallpaperDetailBucketPath(token).split('/').at(-1), 16)
    buckets[bucket][token] = record
    if (curatedKeys.has(record.assetKey))
      curatedRecords[record.assetKey] = record
    const { assetKey, series, title, category, subcategory, tags, thumbnailUrl, previewUrl, resolution, mediaType, sharePath, size } = record
    catalog.push({ assetKey, series, title, category, subcategory, tags, thumbnailUrl, previewUrl, resolution, mediaType, sharePath, size })
  }
  await fs.mkdir(outputDir, { recursive: true })
  // 每轮重写空桶，防止已移除图片从旧分桶继续公开。
  await Promise.all(buckets.map((items, index) => fs.writeFile(path.join(outputDir, `${index.toString(16).padStart(2, '0')}.json`), `${JSON.stringify({ schema: 1, items })}\n`)))
  catalog.sort((a, b) => a.assetKey.localeCompare(b.assetKey))
  await fs.writeFile(path.join(outputDir, 'index.json'), `${JSON.stringify({ schema: 1, items: catalog })}\n`)
  for (const series of ['desktop', 'mobile', 'avatar', 'video', 'bing'])
    await fs.writeFile(path.join(outputDir, `index-${series}.json`), `${JSON.stringify({ schema: 1, items: catalog.filter(item => item.series === series) })}\n`)
  await fs.writeFile(path.join(dataDir, 'collections.json'), `${JSON.stringify({ schema: 1, items: curatedRecords })}\n`)
  return { total: wallpapers.length, generated: catalog.length, skipped: skippedItems.length, skippedItems, buckets: 64 }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  generateWallpaperDetails()
    .then(result => console.log('单图详情生成完成：', result))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
