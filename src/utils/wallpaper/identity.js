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

export function buildWallpaperAssetKey(filenameOrId, series) {
  const normalizedFilename = normalizeWallpaperFilename(filenameOrId, series)
  if (!normalizedFilename || !series) {
    return ''
  }
  return `${series}:${normalizedFilename}`
}

export function getWallpaperIdentity(wallpaper, series) {
  const filename = normalizeWallpaperFilename(wallpaper?.filename || wallpaper?.id, series)
  return {
    assetKey: buildWallpaperAssetKey(filename, series),
    filename,
    series,
  }
}

export function resolveWallpaperSeries(wallpaper, fallbackSeries = '') {
  const assetKeySeries = typeof wallpaper?._assetKey === 'string'
    ? wallpaper._assetKey.split(':')[0]
    : ''
  const pathSeries = [
    wallpaper?.path,
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
    assetKeySeries,
    pathSeries,
    wallpaper?.series,
    wallpaper?.isBing ? 'bing' : '',
    fallbackSeries,
  ]

  return candidates.find(series => ALL_SERIES.includes(series)) || ''
}
