import { PUBLIC_SITE_PATHS } from '../../src/utils/seo/routes.js'
import { isValidWallpaperDetailRecord } from '../../src/utils/wallpaper/detailRecords.js'
import { WALLPAPER_SITE_ORIGIN } from '../../src/utils/wallpaper/share.js'

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&apos;' })[char])
}

export function getWallpaperLastmod(record) {
  for (const value of [record.date, record.createdAt]) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value))
      continue
    const day = value.slice(0, 10)
    const parsedDay = new Date(`${day}T00:00:00Z`)
    if (!Number.isNaN(parsedDay.getTime()) && parsedDay.toISOString().slice(0, 10) === day && !Number.isNaN(Date.parse(value)))
      return day
  }
  return ''
}

export function buildWallpaperSitemap(records, { publicPaths = PUBLIC_SITE_PATHS } = {}) {
  const entries = new Map()
  for (const pathname of publicPaths) {
    if (typeof pathname !== 'string' || !/^\/(?:[a-z\d-]+(?:\/[a-z\d-]+)*)?$/.test(pathname))
      throw new Error(`公开页面路径无效：${pathname}`)
    entries.set(pathname, `<url><loc>${WALLPAPER_SITE_ORIGIN}${pathname}</loc></url>`)
  }
  for (const record of records) {
    const token = record?.sharePath?.slice('/wallpaper/'.length)
    if (!isValidWallpaperDetailRecord(record, token))
      throw new Error(`站点地图详情记录无效：${record?.assetKey || '缺少身份'}`)
    if (entries.has(record.sharePath))
      continue
    const lastmod = getWallpaperLastmod(record)
    // 视频保留详情索引；海报仍走既有视频图源，不伪造自有图片入口。
    const preview = record.series === 'video' ? '' : new URL(record.previewUrl || record.thumbnailUrl, WALLPAPER_SITE_ORIGIN).href
    if (preview && !preview.startsWith(`${WALLPAPER_SITE_ORIGIN}/images/`) && !(record.series === 'bing' && preview.startsWith('https://www.bing.com/th?')))
      throw new Error(`站点地图图片来源无效：${record.assetKey}`)
    entries.set(record.sharePath, `<url><loc>${escapeXml(`${WALLPAPER_SITE_ORIGIN}${record.sharePath}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}${preview ? `<image:image><image:loc>${escapeXml(preview)}</image:loc></image:image>` : ''}</url>`)
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${[...entries.values()].join('\n')}\n</urlset>\n`
  if (entries.size > 50000 || new TextEncoder().encode(xml).length > 50 * 1024 * 1024)
    throw new Error('站点地图超出单文件协议限制，请调整生成策略')
  return { xml, total: entries.size, details: new Set(records.map(record => record.sharePath)).size }
}
