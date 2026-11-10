import { buildWallpaperAssetKey } from './identity.js'
import { encodeImagePath } from './imageDelivery.js'
import { buildWallpaperSharePath, decodeWallpaperShareToken, WALLPAPER_SITE_ORIGIN } from './share.js'

const CDN_TAG_PATTERN = /^v\d+\.\d+\.\d+(?:-[a-z\d]+(?:[.-][a-z\d]+)*)?(?:\+[a-z\d]+(?:[.-][a-z\d]+)*)?$/i
const BING_PATH_PATTERN = /^\/th\?id=OHR\.[\w-]+$/

export function normalizeWallpaperDimensions(record) {
  const valid = value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 200000 ? value : null
  return { width: valid(record?.width), height: valid(record?.height) }
}

function text(value, limit = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function validResourcePath(value, directory, series) {
  if (typeof value !== 'string' || !value.startsWith(`/${directory}/${series}/`))
    return ''
  const encoded = encodeImagePath(value)
  try {
    if (encoded.split('/').slice(1).some(segment => ['..', '.', ''].includes(decodeURIComponent(segment)) || (/[\\/]/.test(decodeURIComponent(segment)) || [...decodeURIComponent(segment)].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))))
      return ''
    return encoded
  }
  catch { return '' }
}

export function buildWallpaperDetailRecord(wallpaper, defaultCdnTag) {
  const sharePath = buildWallpaperSharePath(wallpaper)
  if (!sharePath)
    return null
  const assetKey = buildWallpaperAssetKey(wallpaper)
  const series = assetKey.split(':')[0]
  const resolution = normalizeWallpaperDimensions(wallpaper.resolution)
  const base = {
    assetKey,
    _assetKey: assetKey,
    _series: series,
    series,
    sharePath,
    filename: text(wallpaper.filename, 512),
    title: text(wallpaper.displayTitle || wallpaper.title || wallpaper.filename, 300),
    displayTitle: text(wallpaper.displayTitle || wallpaper.title || wallpaper.filename, 300),
    description: text(wallpaper.description || wallpaper.copyright),
    category: text(wallpaper.category, 100),
    subcategory: text(wallpaper.subcategory, 100),
    tags: [...new Set([...(Array.isArray(wallpaper.tags) ? wallpaper.tags : []), ...(Array.isArray(wallpaper.keywords) ? wallpaper.keywords : [])].filter(value => typeof value === 'string').map(value => text(value, 100)))].slice(0, 30),
    author: text(wallpaper.author || wallpaper.creator, 300),
    source: text(wallpaper.source || wallpaper.copyright, 1000),
    copyright: text(wallpaper.copyright),
    license: text(wallpaper.license, 300),
    date: text(wallpaper.date || wallpaper.createdAt, 100),
    createdAt: text(wallpaper.createdAt || wallpaper.date, 100),
    size: Number.isFinite(wallpaper.size) && wallpaper.size > 0 ? wallpaper.size : 0,
    format: text(wallpaper.format, 15),
    resolution: resolution.width && resolution.height ? { width: resolution.width, height: resolution.height } : null,
    mediaType: series === 'video' ? 'video' : 'image',
    usage: text(wallpaper.usage, 30),
  }
  if (series === 'bing') {
    if (!BING_PATH_PATTERN.test(wallpaper.urlbase || ''))
      return null
    const url = `https://www.bing.com${wallpaper.urlbase}_UHD.jpg`
    return { ...base, isBing: true, urlbase: wallpaper.urlbase, url, downloadUrl: url, thumbnailUrl: `https://www.bing.com${wallpaper.urlbase}_400x240.jpg`, previewUrl: `https://www.bing.com${wallpaper.urlbase}_1920x1080.jpg`, format: 'JPG' }
  }
  const tag = CDN_TAG_PATTERN.test(wallpaper.cdnTag || '') ? wallpaper.cdnTag : defaultCdnTag
  if (!CDN_TAG_PATTERN.test(tag || '') || tag.length > 100)
    return null
  const path = assetKey.slice(assetKey.indexOf(':path:') + 6)
  const thumbnailPath = validResourcePath(wallpaper.thumbnailPath, 'thumbnail', series)
    || path.replace(/^\/wallpaper\//, '/thumbnail/').replace(/\.[^/.]+$/, '.webp')
  const previewPath = validResourcePath(wallpaper.previewPath, 'preview', series)
  const origin = series === 'video' ? 'https://img.061129.xyz' : `https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@${tag}`
  const thumbnailUrl = series === 'video' ? `${origin}${thumbnailPath}` : `/images/${tag}${thumbnailPath}`
  const previewUrl = series === 'video'
    ? previewPath ? `${origin}${previewPath}` : `${origin}${path}`
    : previewPath && /\.(?:jpe?g|png|webp|avif|gif|bmp|ico)$/i.test(previewPath) ? `/images/${tag}${previewPath}` : thumbnailUrl
  return { ...base, path, thumbnailPath, previewPath, cdnTag: tag, url: `${origin}${path}`, downloadUrl: `${origin}${path}`, thumbnailUrl, previewUrl }
}

export function isTrustedWallpaperDetailUrl(value) {
  try {
    const url = new URL(value, WALLPAPER_SITE_ORIGIN)
    if (url.protocol !== 'https:' || url.username || url.password || url.hash)
      return false
    if (url.hostname === 'www.bing.com')
      return /^\/th$/.test(url.pathname) && /^OHR\.[\w-]+_(?:UHD|400x240|1920x1080)\.jpg$/.test(url.searchParams.get('id') || '') && [...url.searchParams.keys()].length === 1
    if (url.search)
      return false
    if (url.origin === WALLPAPER_SITE_ORIGIN) {
      const [, directory, tag, imageDirectory, series, ...segments] = url.pathname.split('/')
      return directory === 'images' && tag?.length <= 100 && CDN_TAG_PATTERN.test(tag)
        && ['thumbnail', 'preview'].includes(imageDirectory) && ['desktop', 'mobile', 'avatar'].includes(series)
        && segments.length > 0 && segments.every((segment) => {
        const decoded = decodeURIComponent(segment)
        return Boolean(decoded) && !['.', '..'].includes(decoded) && !/[\\/]/.test(decoded)
          && !/%(?:2f|5c|2e)/i.test(decoded) && [...decoded].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
      }) && /\.(?:jpe?g|png|webp|avif|gif|bmp|ico)$/i.test(url.pathname)
    }
    return (url.hostname === 'img.061129.xyz' && /^\/(?:wallpaper|preview|thumbnail)\/video\//.test(url.pathname))
      || (url.hostname === 'cdn.jsdelivr.net' && /^\/gh\/IT-NuanxinPro\/nuanXinProPic@[^/]+\/(?:wallpaper|preview|thumbnail)\/(?:desktop|mobile|avatar)\//.test(url.pathname) && CDN_TAG_PATTERN.test(url.pathname.split('/')[3]?.split('@')[1] || ''))
  }
  catch { return false }
}

export function isValidWallpaperDetailRecord(record, token) {
  const key = decodeWallpaperShareToken(token)
  return Boolean(key && record && record.assetKey === key && record._assetKey === key
    && record.sharePath === `/wallpaper/${token}` && record._series === key.split(':')[0]
    && record.series === record._series && record.downloadUrl === record.url
    && [record.url, record.downloadUrl, record.thumbnailUrl, record.previewUrl].every(isTrustedWallpaperDetailUrl))
}

export function getWallpaperDetailSeo(record) {
  return {
    title: `${record.title || record.filename} - Wallpaper Gallery`,
    description: text(record.description || `${record.title || record.filename}，${record.category || '精选壁纸'}高清预览与下载。`, 240),
    image: new URL(record.thumbnailUrl, WALLPAPER_SITE_ORIGIN).href,
    canonical: `${WALLPAPER_SITE_ORIGIN}${record.sharePath}`,
  }
}

export function isValidWallpaperCatalogItem(item) {
  const token = typeof item?.sharePath === 'string' ? item.sharePath.slice('/wallpaper/'.length) : ''
  return item?.sharePath === `/wallpaper/${token}` && decodeWallpaperShareToken(token) === item.assetKey
    && item.series === item.assetKey.split(':')[0] && isTrustedWallpaperDetailUrl(item.thumbnailUrl)
}

export function getRelatedWallpapers(current, catalog, limit = 6) {
  const currentKey = current.assetKey || current._assetKey
  const currentRatio = current.resolution?.width / current.resolution?.height
  const tags = new Set(current.tags || [])
  const seen = new Set([currentKey])
  return catalog.filter((item) => {
    if (!item.assetKey || seen.has(item.assetKey) || item.series !== current.series)
      return false
    seen.add(item.assetKey)
    const ratio = item.resolution?.width / item.resolution?.height
    return !currentRatio || !ratio || Math.abs(Math.log(ratio / currentRatio)) < 0.35
  }).map(item => ({ item, score: (item.category === current.category ? 2 : 0) + (item.tags || []).filter(tag => tags.has(tag)).length * 3 })).sort((a, b) => b.score - a.score || a.item.assetKey.localeCompare(b.item.assetKey)).slice(0, limit).map(entry => entry.item)
}
