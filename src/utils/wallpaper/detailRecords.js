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
  const series = record.series || record._series
  const seriesName = { desktop: '电脑壁纸', mobile: '手机壁纸', avatar: '头像图片', bing: '必应壁纸', video: '动态壁纸' }[series] || '壁纸'
  const dimensions = normalizeWallpaperDimensions(record.resolution)
  const is4k = Math.max(dimensions.width || 0, dimensions.height || 0) >= 3840 && Math.min(dimensions.width || 0, dimensions.height || 0) >= 2160
  const clean = value => text(value, 300).replace(/\.(?:avif|bmp|gif|ico|jpe?g|png|webp|mp4|webm|mov)\s*$/i, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim()
  const name = clean(record.displayTitle || record.title || record.filename) || seriesName
  // 文件名里的宣传词不能作为尺寸证据；只有元数据尺寸达到标准才标注 4K。
  const seoName = (is4k ? name : name.replace(/4k/gi, '').replace(/\s+/g, ' ').trim()) || seriesName
  const subject = [...new Set([record.category, record.subcategory].filter(Boolean))].join(' · ')
  const title = `${seoName} - ${is4k ? '4K ' : ''}${subject ? `${subject} ` : ''}${seriesName}预览与下载 | Wallpaper Gallery`
  const sourceDescription = typeof record.description === 'string' ? record.description.replace(/\s+/g, ' ').trim() : ''
  const description = text(sourceDescription || `${seoName}，${subject ? `${subject}主题的` : ''}${seriesName}${dimensions.width && dimensions.height ? `，原文件尺寸 ${dimensions.width} × ${dimensions.height}` : ''}，在 Wallpaper Gallery 查看${series === 'video' ? '视频海报' : '图片'}预览与原文件下载。`, 240)
  const preview = series === 'video' ? record.thumbnailUrl : record.previewUrl || record.thumbnailUrl
  const image = new URL(preview, WALLPAPER_SITE_ORIGIN).href
  const canonical = `${WALLPAPER_SITE_ORIGIN}${record.sharePath}`
  const imageData = {
    '@type': 'ImageObject',
    '@id': `${canonical}#image`,
    'name': series === 'video' ? `${seoName}视频海报` : seoName,
    'contentUrl': image,
    'thumbnailUrl': image,
    'caption': seoName,
    ...(record.author ? { creditText: record.author } : {}),
    ...(record.copyright ? { copyrightNotice: record.copyright } : {}),
  }
  return {
    name,
    title,
    description,
    image,
    canonical,
    seriesName,
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', '@id': `${canonical}#webpage`, 'url': canonical, 'name': title, 'description': description, 'inLanguage': 'zh-CN', 'primaryImageOfPage': { '@id': `${canonical}#image` }, 'breadcrumb': { '@id': `${canonical}#breadcrumb` } },
        imageData,
        {
          '@type': 'BreadcrumbList',
          '@id': `${canonical}#breadcrumb`,
          'itemListElement': [
            { '@type': 'ListItem', 'position': 1, 'name': '首页', 'item': `${WALLPAPER_SITE_ORIGIN}/` },
            { '@type': 'ListItem', 'position': 2, 'name': seriesName, 'item': `${WALLPAPER_SITE_ORIGIN}/${series}` },
            { '@type': 'ListItem', 'position': 3, 'name': seoName, 'item': canonical },
          ],
        },
      ],
    },
  }
}

export function serializeWallpaperStructuredData(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
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
