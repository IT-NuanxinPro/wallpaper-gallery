import { formatFileSize } from '../src/utils/common/fileSize.js'
import { getRelatedWallpapers, getWallpaperDetailSeo, isValidWallpaperCatalogItem, isValidWallpaperDetailRecord, serializeWallpaperStructuredData } from '../src/utils/wallpaper/detailRecords.js'
import { decodeWallpaperShareToken, getWallpaperDetailBucketPath } from '../src/utils/wallpaper/share.js'

export function escapeDetailHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char])
}

function errorResponse(status, message, method = 'GET') {
  return new Response(method === 'HEAD' ? null : `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>${escapeDetailHtml(message)} - Wallpaper Gallery</title></head><body><h1>${escapeDetailHtml(message)}</h1><a href="/desktop">返回壁纸列表</a></body></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': status >= 500 ? 'no-store' : 'public, max-age=60', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' },
  })
}

export function buildDetailHtmlFragments(record, { related = [] } = {}) {
  const seo = getWallpaperDetailSeo(record)
  const meta = [
    ['name', 'robots', 'index, follow, max-image-preview:large'],
    ['name', 'description', seo.description],
    ['property', 'og:type', 'article'],
    ['property', 'og:title', seo.title],
    ['property', 'og:description', seo.description],
    ['property', 'og:image', seo.image],
    ['property', 'og:url', seo.canonical],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', seo.title],
    ['name', 'twitter:description', seo.description],
    ['name', 'twitter:image', seo.image],
    ['name', 'twitter:url', seo.canonical],
  ].map(([attribute, key, value]) => `<meta ${attribute}="${key}" content="${escapeDetailHtml(value)}">`).join('')
  const dimensions = record.resolution ? `${record.resolution.width} × ${record.resolution.height}` : '尺寸未提供'
  const fileFormat = record.format || record.filename?.split('.').pop()?.toUpperCase()
  const facts = [['分类', [record.category, record.subcategory].filter(Boolean).join(' / ')], ['原文件尺寸', dimensions], ['文件格式', fileFormat], ['文件大小', record.size ? formatFileSize(record.size) : ''], ['作者', record.author], ['来源', record.source], ['版权说明', record.copyright], ['授权', record.license]].filter(([, value]) => value).map(([label, value]) => `<dt>${label}</dt><dd>${escapeDetailHtml(value)}</dd>`).join('')
  const tags = record.tags?.length ? `<div aria-label="壁纸标签">${record.tags.map(tag => `<span>${escapeDetailHtml(tag)}</span>`).join(' ')}</div>` : ''
  const recommendations = related.filter(item => item.series === record.series && item.assetKey !== record.assetKey && isValidWallpaperCatalogItem(item)).map(item => `<li><a href="${escapeDetailHtml(item.sharePath)}">${escapeDetailHtml(item.title || item.category || '查看壁纸')}</a></li>`).join('')
  const article = `<article class="seo-noscript" data-wallpaper-detail><nav aria-label="面包屑"><a href="/">首页</a> / <a href="/${record._series}">${seo.seriesName}</a> / <span>${escapeDetailHtml(seo.name)}</span></nav><h1>${escapeDetailHtml(seo.name)}</h1><img src="${escapeDetailHtml(seo.image)}" alt="${escapeDetailHtml(seo.name)}${record.mediaType === 'video' ? '视频海报' : ''}" width="640"><p>${escapeDetailHtml(record.description || seo.description)}</p><dl>${facts}</dl>${tags}<a href="${escapeDetailHtml(record.downloadUrl)}" rel="noreferrer">下载原文件</a> · <a href="/${record._series}">返回壁纸列表</a>${recommendations ? `<section aria-label="相关壁纸"><h2>相关壁纸</h2><ul>${recommendations}</ul></section>` : ''}</article>`
  return { title: seo.title, head: `${meta}<link rel="canonical" href="${escapeDetailHtml(seo.canonical)}"><script type="application/ld+json" data-wallpaper-seo>${serializeWallpaperStructuredData(seo.structuredData)}</script>`, article }
}

export function transformWallpaperDetailHtml(response, record, { HTMLRewriter = globalThis.HTMLRewriter, related = [] } = {}) {
  if (!HTMLRewriter)
    throw new Error('HTMLRewriter unavailable')
  const fragments = buildDetailHtmlFragments(record, { related })
  return new HTMLRewriter()
    .on('title', { element(element) { element.setInnerContent(fragments.title, { html: false }) } })
    .on('meta[name="description"], meta[name="keywords"], meta[name="robots"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], script[type="application/ld+json"]', { element(element) { element.remove() } })
    .on('head', { element(element) { element.append(fragments.head, { html: true }) } })
    .on('.seo-shell, noscript, [data-wallpaper-detail], [data-page-fallback]', { element(element) { element.remove() } })
    .on('body', { element(element) {
      element.setAttribute('data-wallpaper-fallback', '')
      element.append(fragments.article, { html: true })
    } })
    .transform(response)
}

async function loadRelatedWallpapers(record, assets, origin) {
  try {
    const response = await assets.fetch(new Request(new URL(`/data/details/index-${record.series}.json`, origin)))
    if (!response.ok)
      return []
    const catalog = await response.json()
    if (catalog?.schema !== 1 || !Array.isArray(catalog.items))
      return []
    return getRelatedWallpapers(record, catalog.items.filter(isValidWallpaperCatalogItem))
  }
  catch { return [] }
}

export async function handleWallpaperDetailRequest(request, { assets, transformHtml = transformWallpaperDetailHtml } = {}) {
  if (!['GET', 'HEAD'].includes(request.method))
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
  const url = new URL(request.url)
  const match = url.pathname.match(/^\/wallpaper\/([^/]+)\/?$/)
  const token = match?.[1] || ''
  if (!decodeWallpaperShareToken(token))
    return errorResponse(404, '分享链接无效', request.method)
  if (!assets?.fetch)
    return errorResponse(503, '详情暂时无法加载', request.method)
  try {
    const bucketResponse = await assets.fetch(new Request(new URL(getWallpaperDetailBucketPath(token), url.origin)))
    if (!bucketResponse.ok)
      return errorResponse(bucketResponse.status === 404 ? 404 : 503, '壁纸不存在或暂时无法加载', request.method)
    const bucket = await bucketResponse.json()
    if (bucket?.schema !== 1 || !bucket.items || typeof bucket.items !== 'object')
      return errorResponse(503, '详情暂时无法加载', request.method)
    const record = Object.hasOwn(bucket.items, token) ? bucket.items[token] : null
    if (!record)
      return errorResponse(404, '壁纸不存在', request.method)
    if (!isValidWallpaperDetailRecord(record, token))
      return errorResponse(503, '详情记录无效', request.method)
    if (url.pathname.endsWith('/'))
      return new Response(null, { status: 308, headers: { 'Location': getWallpaperDetailSeo(record).canonical, 'Cache-Control': 'public, max-age=3600' } })
    const [shell, related] = await Promise.all([
      assets.fetch(new Request(new URL('/detail-shell', url.origin))),
      loadRelatedWallpapers(record, assets, url.origin),
    ])
    if (!shell.ok)
      return errorResponse(503, '详情暂时无法加载', request.method)
    const headers = new Headers(shell.headers)
    headers.set('Content-Type', 'text/html; charset=UTF-8')
    headers.set('Cache-Control', 'public, max-age=60, s-maxage=300')
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('X-Robots-Tag', 'index, follow, max-image-preview:large')
    headers.delete('Content-Length')
    headers.delete('ETag')
    const response = new Response(shell.body, { status: 200, headers })
    const transformed = await transformHtml(response, record, { related })
    return request.method === 'HEAD' ? new Response(null, { status: transformed.status, headers: transformed.headers }) : transformed
  }
  catch {
    return errorResponse(503, '详情暂时无法加载', request.method)
  }
}
