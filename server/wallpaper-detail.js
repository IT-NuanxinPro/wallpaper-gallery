import { getWallpaperDetailSeo, isValidWallpaperDetailRecord } from '../src/utils/wallpaper/detailRecords.js'
import { decodeWallpaperShareToken, getWallpaperDetailBucketPath } from '../src/utils/wallpaper/share.js'

export function escapeDetailHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char])
}

function errorResponse(status, message, method = 'GET') {
  return new Response(method === 'HEAD' ? null : `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>${escapeDetailHtml(message)} - Wallpaper Gallery</title></head><body><h1>${escapeDetailHtml(message)}</h1><a href="/desktop">返回壁纸列表</a></body></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': status >= 500 ? 'no-store' : 'public, max-age=60', 'X-Content-Type-Options': 'nosniff' },
  })
}

export function buildDetailHtmlFragments(record) {
  const seo = getWallpaperDetailSeo(record)
  const meta = [
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
  const article = `<article class="seo-noscript" data-wallpaper-detail><h1>${escapeDetailHtml(record.title)}</h1><img src="${escapeDetailHtml(record.thumbnailUrl)}" alt="${escapeDetailHtml(record.title)}" width="640"><p>${escapeDetailHtml(record.description)}</p><p>${escapeDetailHtml(record.category)} · ${escapeDetailHtml(dimensions)}</p>${record.author ? `<p>作者：${escapeDetailHtml(record.author)}</p>` : ''}${record.source ? `<p>来源：${escapeDetailHtml(record.source)}</p>` : ''}<p>授权：${escapeDetailHtml(record.license || '来源未提供授权信息，请自行确认使用权限。')}</p><a href="${escapeDetailHtml(record.downloadUrl)}" rel="noreferrer">下载原文件</a> · <a href="/${record._series}">返回壁纸列表</a></article>`
  return { title: seo.title, head: `${meta}<link rel="canonical" href="${escapeDetailHtml(seo.canonical)}">`, article }
}

export function transformWallpaperDetailHtml(response, record, { HTMLRewriter = globalThis.HTMLRewriter } = {}) {
  if (!HTMLRewriter)
    throw new Error('HTMLRewriter unavailable')
  const fragments = buildDetailHtmlFragments(record)
  return new HTMLRewriter()
    .on('title', { element(element) { element.setInnerContent(fragments.title) } })
    .on('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"]', { element(element) { element.remove() } })
    .on('head', { element(element) { element.append(fragments.head, { html: true }) } })
    .on('.seo-shell, noscript', { element(element) { element.remove() } })
    .on('body', { element(element) { element.append(fragments.article, { html: true }) } })
    .transform(response)
}

export async function handleWallpaperDetailRequest(request, { assets, transformHtml = transformWallpaperDetailHtml } = {}) {
  if (!['GET', 'HEAD'].includes(request.method))
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
  const url = new URL(request.url)
  const match = url.pathname.match(/^\/wallpaper\/([^/]+)\/?$/)
  const token = match?.[1] || ''
  if (!decodeWallpaperShareToken(token))
    return errorResponse(400, '分享链接无效', request.method)
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
    const shell = await assets.fetch(new Request(new URL('/index.html', url.origin)))
    if (!shell.ok)
      return errorResponse(503, '详情暂时无法加载', request.method)
    const headers = new Headers(shell.headers)
    headers.set('Content-Type', 'text/html; charset=UTF-8')
    headers.set('Cache-Control', 'public, max-age=60, s-maxage=300')
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.delete('Content-Length')
    headers.delete('ETag')
    const response = new Response(shell.body, { status: 200, headers })
    const transformed = await transformHtml(response, record)
    return request.method === 'HEAD' ? new Response(null, { status: transformed.status, headers: transformed.headers }) : transformed
  }
  catch {
    return errorResponse(503, '详情暂时无法加载', request.method)
  }
}
