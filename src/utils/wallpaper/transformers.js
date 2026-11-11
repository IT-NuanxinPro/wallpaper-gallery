import { buildBingPreviewUrl, buildBingThumbnailUrl, buildBingUHDUrl, buildImageUrl } from '@/utils/common/format'
import { SERIES_CONFIG } from '@/utils/config/constants'
import { BING_PREVIEW_RESOLUTION, BING_UHD_RESOLUTION } from '@/utils/wallpaper/bingResolution'
import { buildWallpaperAssetKey, getWallpaperIdentity, resolveWallpaperSeries } from '@/utils/wallpaper/identity'

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
  const isVideo = wallpaper?.mediaType === 'video' || wallpaper?.usage || wallpaper?.series === 'video'
  const videoBaseUrl = SERIES_CONFIG.video?.resourceBaseUrl || ''

  if (isVideo) {
    const buildVideoUrl = (resourcePath) => {
      if (!resourcePath)
        return ''
      if (/^https?:\/\//i.test(resourcePath))
        return resourcePath
      if (!videoBaseUrl)
        return resourcePath
      const normalizedPath = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`
      return `${videoBaseUrl}${normalizedPath}`
    }

    return {
      ...wallpaper,
      _assetKey: buildWallpaperAssetKey(wallpaper, 'video'),
      mediaType: 'video',
      _series: 'video',
      url: buildVideoUrl(wallpaper.path || wallpaper.url),
      playbackUrl: buildVideoUrl(wallpaper.playbackPath || wallpaper.playbackUrl || wallpaper.previewPath || wallpaper.previewUrl || wallpaper.path || wallpaper.url),
      thumbnailUrl: buildVideoUrl(wallpaper.thumbnailPath || wallpaper.thumbnailUrl),
      previewUrl: buildVideoUrl(wallpaper.previewPath || wallpaper.previewUrl),
      downloadUrl: buildVideoUrl(wallpaper.path || wallpaper.downloadUrl || wallpaper.url),
    }
  }

  return {
    ...wallpaper,
    _assetKey: buildWallpaperAssetKey(wallpaper, resolveWallpaperSeries(wallpaper)),
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
    _assetKey: buildWallpaperAssetKey(`${bingItem.date}.jpg`, 'bing'),
    _series: 'bing',
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
    resolution: { ...BING_UHD_RESOLUTION },
    previewResolution: { ...BING_PREVIEW_RESOLUTION },
    isBing: true,
    tags: [bingItem.title, bingItem.date.substring(0, 7)],
  }
}

export function restoreWallpaperFromAssetKey(assetKey) {
  const { assetKey: normalizedKey, imageId, filename, series } = getWallpaperIdentity(assetKey)
  const wallpaper = {
    id: normalizedKey || assetKey,
    filename,
    _assetKey: normalizedKey || assetKey,
    _series: series,
    url: '',
    thumbnailUrl: '',
    previewUrl: '',
    category: '',
    subcategory: '',
  }

  if (series === 'bing') {
    return {
      ...wallpaper,
      isBing: true,
      date: filename.match(/bing-(\d{4}-\d{2}-\d{2})/)?.[1] || '',
      title: filename,
    }
  }

  // 规范键包含真实原图路径；旧文件名缺少分类信息时保留空占位。
  return imageId.startsWith('path:')
    ? transformWallpaperUrls({ ...wallpaper, path: imageId.slice(5), series })
    : wallpaper
}
