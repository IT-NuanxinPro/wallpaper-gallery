// 这个模块会被前端和纯 Node 脚本同时引用，不能依赖 Vite 别名或 import.meta.env 配置。
const ALL_SERIES = ['desktop', 'video', 'bing', 'mobile', 'avatar']

const BING_FILENAME_PATTERN = /^bing-\d{4}-\d{2}-\d{2}\.jpg$/i
const BING_DATE_FILENAME_PATTERN = /^\d{4}-\d{2}-\d{2}\.jpg$/i

export function normalizeWallpaperFilename(filenameOrId, series) {
  if (!filenameOrId) {
    return ''
  }

  const normalized = String(filenameOrId).trim()
  if (!normalized) {
    return ''
  }

  if (series === 'bing') {
    if (BING_FILENAME_PATTERN.test(normalized)) {
      return normalized
    }

    if (BING_DATE_FILENAME_PATTERN.test(normalized)) {
      return `bing-${normalized}`
    }
  }

  return normalized
}

function decodePathSegment(segment) {
  // 仅修复裸百分号；已编码的百分号和斜线只解码一次。
  try {
    return decodeURIComponent(segment.replace(/%(?![\da-f]{2})/gi, '%25'))
  }
  catch {
    return segment.replace(/(?:%[\da-f]{2})+/gi, (encoded) => {
      try {
        return decodeURIComponent(encoded)
      }
      catch {
        return encoded
      }
    })
  }
}

export function normalizeWallpaperPath(sourcePath, series) {
  if (typeof sourcePath !== 'string' || !ALL_SERIES.includes(series) || series === 'bing') {
    return ''
  }

  const resourcePath = sourcePath.startsWith('/') ? sourcePath : `/${sourcePath}`
  if (!resourcePath.startsWith(`/wallpaper/${series}/`)) {
    return ''
  }

  const segments = resourcePath.slice(1).split('/').map(decodePathSegment)
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
    return ''
  }
  return `/${segments.map(segment => encodeURIComponent(segment)).join('/')}`
}

export function buildWallpaperAssetKey(wallpaperOrKey, series) {
  const wallpaper = wallpaperOrKey && typeof wallpaperOrKey === 'object' ? wallpaperOrKey : null
  const resolvedSeries = series || (wallpaper ? resolveWallpaperSeries(wallpaper) : String(wallpaperOrKey || '').split(':')[0])
  if (!ALL_SERIES.includes(resolvedSeries)) {
    return ''
  }

  if (wallpaper) {
    const resourcePath = normalizeWallpaperPath(wallpaper.path, resolvedSeries)
      || normalizeWallpaperPath(wallpaper.source_path, resolvedSeries)
    if (resourcePath) {
      return `${resolvedSeries}:path:${resourcePath}`
    }

    const cachedKey = wallpaper._assetKey
    if (typeof cachedKey === 'string' && cachedKey.startsWith(`${resolvedSeries}:`)
      && (resolvedSeries === 'bing'
        ? BING_FILENAME_PATTERN.test(cachedKey.slice(5))
        : cachedKey.startsWith(`${resolvedSeries}:path:`))
      && buildWallpaperAssetKey(cachedKey, resolvedSeries) === cachedKey) {
      return cachedKey
    }

    return buildWallpaperAssetKey(wallpaper.filename || wallpaper.id, resolvedSeries)
  }

  let value = String(wallpaperOrKey || '').trim()
  const keySeries = value.split(':')[0]
  if (ALL_SERIES.includes(keySeries) && value.includes(':')) {
    if (keySeries !== resolvedSeries) {
      return ''
    }
    value = value.slice(keySeries.length + 1)
  }

  if (value.startsWith('path:')) {
    const resourcePath = normalizeWallpaperPath(value.slice(5), resolvedSeries)
    return resourcePath ? `${resolvedSeries}:path:${resourcePath}` : ''
  }

  const filename = normalizeWallpaperFilename(value, resolvedSeries)
  return filename ? `${resolvedSeries}:${filename}` : ''
}

export function getWallpaperIdentity(wallpaper, series) {
  const assetKey = buildWallpaperAssetKey(wallpaper, series)
  const resolvedSeries = assetKey.split(':')[0] || series || ''
  const imageId = assetKey ? assetKey.slice(resolvedSeries.length + 1) : ''
  const filename = normalizeWallpaperFilename(
    typeof wallpaper === 'object' && wallpaper
      ? wallpaper.filename || (imageId.startsWith('path:') ? decodePathSegment(imageId.split('/').at(-1)) : wallpaper.id)
      : (imageId.startsWith('path:') ? decodePathSegment(imageId.split('/').at(-1)) : imageId),
    resolvedSeries,
  )
  return {
    assetKey,
    imageId,
    filename,
    series: resolvedSeries,
  }
}

export function resolveWallpaperSeries(wallpaper, fallbackSeries = '') {
  const assetKeySeries = typeof wallpaper?._assetKey === 'string'
    ? wallpaper._assetKey.split(':')[0]
    : ''
  const pathSeries = [
    wallpaper?.path,
    wallpaper?.source_path,
    wallpaper?.thumbnailPath,
    wallpaper?.previewPath,
    wallpaper?.url,
    wallpaper?.thumbnailUrl,
    wallpaper?.previewUrl,
    wallpaper?.downloadUrl,
  ]
    .map((value) => {
      const normalized = String(value || '').toLowerCase()
      if (!normalized) {
        return ''
      }

      if (normalized.includes('/wallpaper/mobile/') || normalized.includes('/thumbnail/mobile/') || normalized.includes('/data/mobile/')) {
        return 'mobile'
      }

      if (normalized.includes('/wallpaper/video/') || normalized.includes('/thumbnail/video/') || normalized.includes('/preview/video/') || normalized.includes('/data/video/')) {
        return 'video'
      }

      if (normalized.includes('/wallpaper/avatar/') || normalized.includes('/thumbnail/avatar/') || normalized.includes('/data/avatar/')) {
        return 'avatar'
      }

      if (normalized.includes('/wallpaper/desktop/') || normalized.includes('/thumbnail/desktop/') || normalized.includes('/data/desktop/')) {
        return 'desktop'
      }

      if (normalized.includes('/data/bing/') || normalized.includes('bing.com')) {
        return 'bing'
      }

      return ''
    })
    .find(series => ALL_SERIES.includes(series))

  const candidates = [
    wallpaper?._series,
    pathSeries,
    wallpaper?.series,
    assetKeySeries,
    wallpaper?.isBing ? 'bing' : '',
    fallbackSeries,
  ]

  return candidates.find(series => ALL_SERIES.includes(series)) || ''
}
