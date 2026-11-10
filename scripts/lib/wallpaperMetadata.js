import fs from 'node:fs/promises'
import path from 'node:path'
import { decodeData } from '../../src/utils/common/codec.js'
import { buildWallpaperAssetKey } from '../../src/utils/wallpaper/identity.js'

export const WALLPAPER_SERIES = ['desktop', 'mobile', 'avatar', 'video', 'bing']

async function readDecoded(file) {
  const raw = JSON.parse(await fs.readFile(file, 'utf8'))
  return raw.blob || raw.payload ? JSON.parse(decodeData(raw.blob || raw.payload)) : raw
}

function safeDataFile(root, filename) {
  const file = path.resolve(root, filename)
  if (!file.startsWith(`${path.resolve(root)}${path.sep}`))
    throw new Error('元数据文件路径越界')
  return file
}

async function exists(file) {
  try {
    await fs.access(file)
    return true
  }
  catch { return false }
}

export async function loadWallpaperMetadata(dataDir, { onInvalidItem } = {}) {
  const wallpapers = new Map()
  for (const series of WALLPAPER_SERIES) {
    const directory = path.join(dataDir, series)
    const indexFile = path.join(directory, 'index.json')
    let batches = []
    if (await exists(indexFile)) {
      const index = await readDecoded(indexFile)
      const files = series === 'bing' ? index.years : Array.isArray(index) ? index : index.categories
      if (!Array.isArray(files))
        throw new Error(`${series} 元数据索引无效`)
      batches = await Promise.all(files.map(entry => readDecoded(safeDataFile(directory, entry.file))))
    }
    else if (await exists(path.join(dataDir, `${series}.json`))) {
      batches = [await readDecoded(path.join(dataDir, `${series}.json`))]
    }
    for (const batch of batches) {
      const items = Array.isArray(batch) ? batch : batch.wallpapers || batch.items
      if (!Array.isArray(items))
        throw new Error(`${series} 壁纸记录无效`)
      for (const source of items) {
        const wallpaper = series === 'bing'
          ? { ...source, _series: series, filename: `bing-${source.date}.jpg`, displayTitle: source.title, category: source.date?.slice(0, 7), tags: [source.title, source.date?.slice(0, 7)].filter(Boolean) }
          : { ...source, _series: series }
        const key = buildWallpaperAssetKey(wallpaper, series)
        if (key)
          wallpapers.set(key, wallpaper)
        else
          onInvalidItem?.(wallpaper)
      }
    }
  }
  return [...wallpapers.values()]
}
