import fs from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { decodeData } from '../../src/utils/common/codec.js'
import { buildWallpaperAssetKey } from '../../src/utils/wallpaper/identity.js'

export const STANDARD_SERIES = ['desktop', 'mobile', 'avatar', 'video']

function json(dataDir, name) {
  const target = path.join(dataDir, name)
  if (!fs.existsSync(target))
    throw new Error(`部署快照缺少文件：${name}`)
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'))
  }
  catch {
    throw new Error(`部署快照JSON无效：${name}`)
  }
}

function reference(file) {
  if (typeof file !== 'string' || !/^[^/\\]+\.json$/.test(file) || [...file].some(character => character.charCodeAt(0) < 32) || file.startsWith('.') || ['index.json', 'latest.json'].includes(file))
    throw new Error('部署快照包含越界或无效分类引用路径')
  return file
}

function array(value, label) {
  const decoded = value?.blob || value?.payload ? JSON.parse(decodeData(value.blob || value.payload)) : value
  const items = Array.isArray(decoded) ? decoded : decoded?.wallpapers || decoded?.categories
  if (!Array.isArray(items))
    throw new Error(`部署快照数组无效：${label}`)
  return items
}

function count(value, expected, label) {
  if (!Number.isInteger(value) || value < 0 || value !== expected)
    throw new Error(`部署快照数量不一致：${label}`)
}

function identities(items, series, label) {
  const keys = items.map((item) => {
    if (!item || typeof item.path !== 'string' || !item.path.startsWith(`/wallpaper/${series}/`))
      throw new Error(`部署快照资产路径无效：${label}`)
    const key = buildWallpaperAssetKey(item, series)
    if (!key || !item.filename)
      throw new Error(`部署快照资产身份无效：${label}`)
    return key
  })
  if (new Set(keys).size !== keys.length)
    throw new Error(`部署快照包含重复资产身份：${label}`)
  return keys
}

function validateStandard(dataDir, series) {
  const index = json(dataDir, `${series}/index.json`)
  const categories = array(index, `${series}/index.json`)
  if (index.categoryCount != null)
    count(index.categoryCount, categories.length, `${series}分类数`)
  const seenFiles = new Set()
  const items = []
  for (const category of categories) {
    const file = reference(category?.file)
    if (seenFiles.has(file))
      throw new Error(`部署快照分类引用重复：${series}/${file}`)
    seenFiles.add(file)
    const categoryData = json(dataDir, `${series}/${file}`)
    const records = array(categoryData, `${series}/${file}`)
    count(category.count, records.length, `${series}/${file}索引`)
    count(categoryData.total, records.length, `${series}/${file}`)
    if (records.some(item => item.category !== category.name))
      throw new Error(`部署快照分类归属不一致：${series}/${file}`)
    items.push(...records)
  }
  count(index.total, items.length, `${series}总数`)
  const keys = identities(items, series, series)
  const legacy = json(dataDir, `${series}.json`)
  const legacyItems = array(legacy, `${series}.json`)
  count(legacy.total, legacyItems.length, `${series}.json`)
  const legacyKeys = identities(legacyItems, series, `${series}.json`)
  if (JSON.stringify([...keys].sort()) !== JSON.stringify([...legacyKeys].sort()))
    throw new Error(`部署快照分类与完整数据不一致：${series}`)
  const byIdentity = new Map(legacyItems.map((item, index) => [legacyKeys[index], item]))
  if (items.some((item, index) => !isDeepStrictEqual(item, byIdentity.get(keys[index]))))
    throw new Error(`部署快照分类记录与完整数据内容不一致：${series}`)
  const latest = json(dataDir, `${series}/latest.json`)
  const latestItems = array(latest, `${series}/latest.json`)
  count(latest.total, latestItems.length, `${series}/latest.json`)
  count(latestItems.length, Math.min(40, items.length), `${series}最新切片`)
  const keySet = new Set(keys)
  const latestKeys = identities(latestItems, series, `${series}/latest.json`)
  if (latestKeys.some(key => !keySet.has(key)))
    throw new Error(`部署快照最新切片包含未发布资产：${series}`)
  if (latestItems.some((item, index) => !isDeepStrictEqual(item, byIdentity.get(latestKeys[index]))))
    throw new Error(`部署快照最新记录与完整数据内容不一致：${series}`)
  return legacyItems
}

function validateBing(dataDir) {
  const index = json(dataDir, 'bing/index.json')
  if (!Array.isArray(index.years))
    throw new Error('部署快照缺少Bing年份索引')
  const files = new Set()
  const items = []
  for (const year of index.years) {
    const file = reference(year?.file)
    if (files.has(file))
      throw new Error('部署快照Bing年份文件重复')
    files.add(file)
    const data = json(dataDir, `bing/${file}`)
    if (!Array.isArray(data.items))
      throw new Error(`部署快照Bing年度数据无效：${file}`)
    count(data.total, data.items.length, `bing/${file}`)
    count(year.count, data.items.length, `bing/${file}索引`)
    items.push(...data.items)
  }
  count(index.total, items.length, 'bing总数')
  if (items.some(item => !/^\d{4}-\d{2}-\d{2}$/.test(item?.date || '') || typeof item.urlbase !== 'string' || !item.urlbase))
    throw new Error('部署快照Bing资产缺少日期或资源路径')
  // 既有年度数据包含同日期多来源记录，保留这些记录与总数，不重新去重。
  const latest = json(dataDir, 'bing/latest.json')
  if (!Array.isArray(latest.items))
    throw new Error('部署快照Bing最新数据无效')
  count(latest.total, latest.items.length, 'bing/latest.json')
  const signatures = new Set(items.map(item => `${item.date}|${item.urlbase}`))
  if (latest.items.length > items.length || latest.items.some(item => !signatures.has(`${item.date}|${item.urlbase}`)))
    throw new Error('部署快照Bing最新数据不在完整年度数据内')
  return items
}

function validatePublication(publicationId, metadata, videos) {
  if (!/^[A-Z0-9-]{1,100}$/i.test(publicationId))
    throw new Error('publication发布标识无效')
  const expected = Object.entries(metadata?.images || {}).filter(([, item]) => item.publicationId === publicationId)
  if (!expected.length)
    throw new Error('部署快照不包含要求的publication发布记录')
  const expectedCount = expected[0][1].publicationJobCount
  if (expectedCount !== expected.length || expected.some(([, item]) => item.publicationJobCount !== expectedCount))
    throw new Error('publication发布记录不完整')
  const byPath = new Map(videos.map(item => [decodeURIComponent(item.path).replace(/^\//, ''), item]))
  for (const [key, source] of expected) {
    const item = byPath.get(key)
    if (!item || !source.jobId || item.jobId !== source.jobId || item.publicationId !== publicationId || item.publicationJobCount !== expectedCount || item.sha256 !== source.sha256)
      throw new Error('publication发布资产与冻结元数据不一致')
    for (const field of ['previewPath', 'thumbnailPath', 'filename', 'size', 'duration', 'resolution', 'category', 'subcategory', 'usage', 'topic']) {
      if (source[field] !== undefined && !isDeepStrictEqual(item[field], source[field]))
        throw new Error(`publication发布审核字段与冻结元数据不一致：${field}`)
    }
    for (const field of ['displayTitle', 'description', 'keywords']) {
      if (source.ai?.[field] !== undefined && !isDeepStrictEqual(item[field], source.ai[field]))
        throw new Error(`publication发布AI审核字段与冻结元数据不一致：${field}`)
    }
  }
}

export function validateDeploymentSnapshot(dataDir, { publicationId, videoMetadata } = {}) {
  const series = Object.fromEntries(STANDARD_SERIES.map(name => [name, validateStandard(dataDir, name)]))
  series.bing = validateBing(dataDir)
  if (publicationId)
    validatePublication(publicationId, videoMetadata, series.video)
  return { totals: Object.fromEntries(Object.entries(series).map(([name, items]) => [name, items.length])), series }
}
