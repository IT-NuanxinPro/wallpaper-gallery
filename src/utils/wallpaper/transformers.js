import { buildBingPreviewUrl, buildBingThumbnailUrl, buildBingUHDUrl, buildImageUrl } from '@/utils/common/format'

export function formatWallpaperStatistics(items) {
  const jpgCount = items.filter(w => w.format === 'JPG' || w.format === 'JPEG').length
  const pngCount = items.filter(w => w.format === 'PNG').length
  const totalSize = items.reduce((sum, w) => sum + (w.size || 0), 0)

  return {
    total: items.length,
    jpg: jpgCount,
    png: pngCount,
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
  }
}

export function formatBytes(totalSize) {
  if (totalSize <= 0) {
    return '0 B'
  }

  try {
    const units = ['B', 'KB', 'MB', 'GB']
    const k = 1024
    const i = Math.floor(Math.log(totalSize) / Math.log(k))
    return `${Number.parseFloat((totalSize / k ** i).toFixed(2))} ${units[i]}`
  }
  catch {
    return `${totalSize} B`
  }
}

export function transformWallpaperUrls(wallpaper) {
  const cdnTag = wallpaper.cdnTag

  return {
    ...wallpaper,
    url: wallpaper.path ? buildImageUrl(wallpaper.path, cdnTag) : (wallpaper.url || ''),
    thumbnailUrl: wallpaper.thumbnailPath ? buildImageUrl(wallpaper.thumbnailPath, cdnTag) : (wallpaper.thumbnailUrl || ''),
    previewUrl: wallpaper.previewPath ? buildImageUrl(wallpaper.previewPath, cdnTag) : (wallpaper.previewUrl || null),
    downloadUrl: wallpaper.path ? buildImageUrl(wallpaper.path, cdnTag) : (wallpaper.downloadUrl || ''),
  }
}

export function transformBingWallpaper(bingItem) {
  const uhdUrl = buildBingUHDUrl(bingItem.urlbase)

  return {
    id: `bing-${bingItem.date}`,
    filename: `bing-${bingItem.date}.jpg`,
    category: bingItem.date.substring(0, 7),
    displayTitle: bingItem.title,
    url: uhdUrl,
    downloadUrl: uhdUrl,
    thumbnailUrl: buildBingThumbnailUrl(bingItem.urlbase),
    previewUrl: buildBingPreviewUrl(bingItem.urlbase),
    date: bingItem.date,
    title: bingItem.title,
    copyright: bingItem.copyright,
    copyrightlink: bingItem.copyrightlink,
    quiz: bingItem.quiz,
    urlbase: bingItem.urlbase,
    hsh: bingItem.hsh,
    size: 0,
    format: 'JPG',
    createdAt: `${bingItem.date}T00:00:00Z`,
    resolution: {
      width: 3840,
      height: 2160,
      label: '4K UHD',
      type: 'success',
    },
    isBing: true,
    tags: [bingItem.title, bingItem.date.substring(0, 7)],
  }
}
