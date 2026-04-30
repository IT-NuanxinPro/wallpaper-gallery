#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { decodeData } from '../src/utils/common/codec.js'
import { buildWallpaperAssetKey, normalizeWallpaperFilename } from '../src/utils/wallpaper/identity.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DATA_DIR = path.resolve(__dirname, '../public/data')

const STATIC_SERIES = ['desktop', 'mobile', 'avatar', 'video']
const BING_CDN_BASE = 'https://cn.bing.com'
const GITHUB_CDN_BASE = 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic'
const VIDEO_CDN_BASE = 'https://img.061129.xyz'
const UPSERT_BATCH_SIZE = 200
const SELECT_BATCH_SIZE = 1000

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function stripFileExtension(filename) {
  return String(filename || '').replace(/\.[^.]+$/, '')
}

function buildCdnAssetUrl(assetPath, cdnTag) {
  if (!assetPath) {
    return null
  }

  const version = cdnTag || 'main'
  return `${GITHUB_CDN_BASE}@${version}${assetPath}`
}

function buildVideoAssetUrl(assetPath) {
  if (!assetPath) {
    return null
  }

  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath
  }

  const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`
  return `${VIDEO_CDN_BASE}${normalizedPath}`
}

function buildBingAssetUrl(urlbase, suffix) {
  if (!urlbase) {
    return null
  }

  return `${BING_CDN_BASE}${urlbase}_${suffix}.jpg`
}

function chunk(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function getStandardCategoryFiles(series) {
  const indexPath = path.join(DATA_DIR, series, 'index.json')
  if (!fs.existsSync(indexPath)) {
    return []
  }
  const indexData = readJson(indexPath)
  const encoded = indexData.blob || indexData.payload

  if (!encoded) {
    return Array.isArray(indexData.categories)
      ? indexData.categories.map(category => category?.file).filter(Boolean)
      : []
  }

  const decoded = JSON.parse(decodeData(encoded))
  return Array.isArray(decoded)
    ? decoded.map(category => category?.file).filter(Boolean)
    : []
}

function getBingYearFiles() {
  const indexPath = path.join(DATA_DIR, 'bing', 'index.json')
  const indexData = readJson(indexPath)
  return Array.isArray(indexData.years)
    ? indexData.years.map(item => item?.file).filter(Boolean)
    : []
}

export function mapStandardWallpaperAsset(series, wallpaper) {
  const filename = normalizeWallpaperFilename(wallpaper?.filename || wallpaper?.id, series)
  const assetKey = buildWallpaperAssetKey(filename, series)
  const buildAssetUrl = series === 'video' ? buildVideoAssetUrl : buildCdnAssetUrl
  const rawUrl = buildAssetUrl(wallpaper?.path, wallpaper?.cdnTag)
  const previewUrl = buildAssetUrl(wallpaper?.previewPath, wallpaper?.cdnTag)
  const thumbnailUrl = buildAssetUrl(wallpaper?.thumbnailPath, wallpaper?.cdnTag)

  return {
    asset_key: assetKey,
    category: wallpaper?.category || null,
    cdn_tag: wallpaper?.cdnTag || null,
    file_size: wallpaper?.size || null,
    filename,
    format: wallpaper?.format || null,
    height: wallpaper?.resolution?.height || null,
    metadata: {
      created_at: wallpaper?.createdAt || null,
      description: wallpaper?.description || null,
      display_title: wallpaper?.displayTitle || null,
      keywords: Array.isArray(wallpaper?.keywords) ? wallpaper.keywords : [],
      media_type: wallpaper?.mediaType || 'image',
      resolution: wallpaper?.resolution || null,
      sha: wallpaper?.sha || null,
      source_id: wallpaper?.id || null,
      topic: wallpaper?.topic || wallpaper?.subcategory || null,
      tags: Array.isArray(wallpaper?.tags) ? wallpaper.tags : [],
      usage: wallpaper?.usage || null,
      urls: {
        preview: previewUrl,
        raw: rawUrl,
        thumbnail: thumbnailUrl,
      },
    },
    duration_seconds: wallpaper?.duration || null,
    preview_path: wallpaper?.previewPath || null,
    raw_url: rawUrl,
    removed_at: null,
    series,
    source_path: wallpaper?.path || null,
    source_updated_at: wallpaper?.createdAt || null,
    status: 'active',
    subcategory: wallpaper?.subcategory || null,
    thumbnail_path: wallpaper?.thumbnailPath || null,
    title: wallpaper?.displayTitle || stripFileExtension(filename),
    width: wallpaper?.resolution?.width || null,
  }
}

export function mapBingWallpaperAsset(item) {
  const filename = normalizeWallpaperFilename(`${item?.date}.jpg`, 'bing')
  const assetKey = buildWallpaperAssetKey(filename, 'bing')
  const rawUrl = buildBingAssetUrl(item?.urlbase, 'UHD')
  const previewUrl = buildBingAssetUrl(item?.urlbase, '1920x1080')
  const thumbnailUrl = buildBingAssetUrl(item?.urlbase, '400x240')

  return {
    asset_key: assetKey,
    category: item?.date?.slice(0, 7) || null,
    cdn_tag: null,
    file_size: null,
    filename,
    format: 'JPG',
    height: 2160,
    metadata: {
      bing: {
        copyright: item?.copyright || null,
        copyrightlink: item?.copyrightlink || null,
        hsh: item?.hsh || null,
        quiz: item?.quiz || null,
        urlbase: item?.urlbase || null,
      },
      created_at: item?.date ? `${item.date}T00:00:00Z` : null,
      urls: {
        preview: previewUrl,
        raw: rawUrl,
        thumbnail: thumbnailUrl,
      },
    },
    preview_path: previewUrl,
    raw_url: rawUrl,
    removed_at: null,
    series: 'bing',
    source_path: rawUrl,
    source_updated_at: item?.date ? `${item.date}T00:00:00Z` : null,
    status: 'active',
    subcategory: null,
    thumbnail_path: thumbnailUrl,
    title: item?.title || stripFileExtension(filename),
    width: 3840,
  }
}

export function collectWallpaperAssets() {
  const assets = new Map()

  STATIC_SERIES.forEach((series) => {
    const categoryFiles = getStandardCategoryFiles(series)

    categoryFiles.forEach((file) => {
      const categoryPath = path.join(DATA_DIR, series, file)
      const categoryData = readJson(categoryPath)
      const decoded = categoryData.blob || categoryData.payload
        ? JSON.parse(decodeData(categoryData.blob || categoryData.payload))
        : categoryData
      const wallpapers = Array.isArray(decoded?.wallpapers)
        ? decoded.wallpapers
        : (Array.isArray(decoded) ? decoded : [])

      wallpapers.forEach((wallpaper) => {
        const record = mapStandardWallpaperAsset(series, wallpaper)
        assets.set(record.asset_key, record)
      })
    })
  })

  getBingYearFiles().forEach((file) => {
    const yearPath = path.join(DATA_DIR, 'bing', file)
    const yearData = readJson(yearPath)
    const items = Array.isArray(yearData.items) ? yearData.items : []

    items.forEach((item) => {
      const record = mapBingWallpaperAsset(item)
      assets.set(record.asset_key, record)
    })
  })

  return Array.from(assets.values())
}

async function fetchExistingAssetKeys(supabase) {
  const keys = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('wallpaper_assets')
      .select('asset_key')
      .range(from, from + SELECT_BATCH_SIZE - 1)

    if (error) {
      throw error
    }

    if (!data?.length) {
      break
    }

    data.forEach(item => keys.push(item.asset_key))

    if (data.length < SELECT_BATCH_SIZE) {
      break
    }

    from += SELECT_BATCH_SIZE
  }

  return keys
}

async function upsertWallpaperAssets(supabase, assets) {
  for (const batch of chunk(assets, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase
      .from('wallpaper_assets')
      .upsert(batch, { onConflict: 'asset_key' })

    if (error) {
      throw error
    }
  }
}

async function markRemovedAssets(supabase, assetKeys) {
  if (!assetKeys.length) {
    return
  }

  const removedAt = new Date().toISOString()
  for (const batch of chunk(assetKeys, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase
      .from('wallpaper_assets')
      .update({
        removed_at: removedAt,
        status: 'removed',
      })
      .in('asset_key', batch)

    if (error) {
      throw error
    }
  }
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('缺少 VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，无法同步 wallpaper_assets。')
  }

  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`数据目录不存在: ${DATA_DIR}`)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const assets = collectWallpaperAssets()
  if (!assets.length) {
    throw new Error('没有从 public/data 中解析出任何壁纸资产。')
  }

  console.log(`📦 解析完成，共 ${assets.length} 条壁纸资产，开始同步到 Supabase...`)

  const existingKeys = await fetchExistingAssetKeys(supabase)
  const currentKeySet = new Set(assets.map(item => item.asset_key))
  const removedKeys = existingKeys.filter(assetKey => !currentKeySet.has(assetKey))

  await upsertWallpaperAssets(supabase, assets)
  await markRemovedAssets(supabase, removedKeys)

  console.log(`✅ wallpaper_assets 同步完成：active=${assets.length} removed=${removedKeys.length}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('\n❌ 同步 wallpaper_assets 失败:', error.message)
    process.exit(1)
  })
}
