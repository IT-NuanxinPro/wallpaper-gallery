#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildWallpaperDetailRecord, isValidWallpaperDetailRecord } from '../src/utils/wallpaper/detailRecords.js'
import { getWallpaperDetailBucketPath } from '../src/utils/wallpaper/share.js'
import { loadWallpaperMetadata } from './lib/wallpaperMetadata.js'
import { buildWallpaperSitemap } from './lib/wallpaperSitemap.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export async function generateWallpaperDetails({ dataDir = path.join(projectRoot, 'public/data'), outputDir = path.join(dataDir, 'details'), sitemapPath = path.join(dataDir, '..', 'sitemap.xml'), defaultCdnTag } = {}) {
  if (!defaultCdnTag) {
    const constants = await fs.readFile(path.join(projectRoot, 'src/utils/config/constants.js'), 'utf8')
    defaultCdnTag = constants.match(/export const CDN_VERSION = '([^']+)'/)?.[1]
  }
  const skippedItems = []
  const wallpapers = await loadWallpaperMetadata(dataDir, { onInvalidItem: wallpaper => skippedItems.push({ series: wallpaper._series, filename: wallpaper.filename, reason: 'invalid-share-identity' }) })
  const buckets = Array.from({ length: 64 }, () => ({}))
  const catalog = []
  const records = []
  for (const wallpaper of wallpapers) {
    const record = buildWallpaperDetailRecord(wallpaper, defaultCdnTag)
    if (!record) {
      skippedItems.push({ series: wallpaper._series, filename: wallpaper.filename, reason: wallpaper._series === 'bing' ? 'invalid-bing-urlbase' : 'invalid-share-identity-or-resource' })
      continue
    }
    const token = record.sharePath.slice('/wallpaper/'.length)
    if (!isValidWallpaperDetailRecord(record, token))
      throw new Error(`生成的详情记录校验失败：${record.assetKey}`)
    const bucket = Number.parseInt(getWallpaperDetailBucketPath(token).split('/').at(-1), 16)
    buckets[bucket][token] = record
    records.push(record)
    const { assetKey, series, title, category, subcategory, tags, thumbnailUrl, previewUrl, resolution, mediaType, sharePath, size } = record
    catalog.push({ assetKey, series, title, category, subcategory, tags, thumbnailUrl, previewUrl, resolution, mediaType, sharePath, size })
  }
  catalog.sort((a, b) => a.assetKey.localeCompare(b.assetKey))
  const sitemap = buildWallpaperSitemap(records)
  // 所有数据验证及序列化完成后再落盘；空桶也重写，防止已移除详情残留。
  const outputs = buckets.map((items, index) => [path.join(outputDir, `${index.toString(16).padStart(2, '0')}.json`), `${JSON.stringify({ schema: 1, items })}\n`])
  outputs.push([path.join(outputDir, 'index.json'), `${JSON.stringify({ schema: 1, items: catalog })}\n`])
  for (const series of ['desktop', 'mobile', 'avatar', 'video', 'bing'])
    outputs.push([path.join(outputDir, `index-${series}.json`), `${JSON.stringify({ schema: 1, items: catalog.filter(item => item.series === series) })}\n`])
  outputs.push([sitemapPath, sitemap.xml])
  await writeValidatedOutputs(outputs)
  return { total: catalog.length + skippedItems.length, generated: catalog.length, skipped: skippedItems.length, skippedItems, buckets: 64, sitemapUrls: sitemap.total }
}

async function writeValidatedOutputs(outputs) {
  const suffix = `.tmp-${randomUUID()}`
  const staged = outputs.map(([filename, contents]) => ({ filename, contents, temporary: `${filename}${suffix}` }))
  await Promise.all([...new Set(outputs.map(([filename]) => path.dirname(filename)))].map(directory => fs.mkdir(directory, { recursive: true })))
  try {
    const writes = await Promise.allSettled(staged.map(item => fs.writeFile(item.temporary, item.contents, { flag: 'wx' })))
    const failed = writes.find(result => result.status === 'rejected')
    if (failed)
      throw failed.reason
    // sitemap 最后替换，避免先暴露尚未生成的详情链接。
    for (const item of staged)
      await fs.rename(item.temporary, item.filename)
  }
  finally {
    await Promise.all(staged.map(item => fs.rm(item.temporary, { force: true })))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  generateWallpaperDetails()
    .then(result => console.log('单图详情生成完成：', result))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
