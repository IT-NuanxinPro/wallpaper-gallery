import { formatFileSize } from '../src/utils/common/fileSize.js'
import { DETAIL_STATS_METRICS } from '../src/utils/stats/detailMetrics.js'
import { getWallpaperDetailSeo, isValidWallpaperCatalogItem, normalizeWallpaperDimensions, serializeWallpaperStructuredData } from '../src/utils/wallpaper/detailRecords.js'
import { getWallpaperDisplayTitle } from '../src/utils/wallpaper/displayTitle.js'
import { getWallpaperCardAspectRatio } from '../src/utils/wallpaper/mediaPresentation.js'
import { renderDevicePreview } from './device-preview-markup.js'

export function escapeDetailHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char])
}

const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>'
const download = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/></svg>'
const statsPlaceholder = `<dl class="detail-stats" aria-label="壁纸统计" aria-busy="false">${DETAIL_STATS_METRICS.map(metric => `<div title="${metric.title}"><dt><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${metric.path}"/></svg><span>${metric.label}</span></dt><dd>—</dd></div>`).join('')}</dl>`
const videoLoading = `<div class="detail-static-video-loading" role="status" aria-live="polite"><span class="soft-loading" style="--loader-size:64px">
  <svg class="pl" viewBox="0 0 240 240" aria-hidden="true">
    <circle class="pl__ring pl__ring--a" cx="120" cy="120" r="105" fill="none" stroke-width="20" stroke-dasharray="0 660" stroke-dashoffset="-330" stroke-linecap="round"/>
    <circle class="pl__ring pl__ring--b" cx="120" cy="120" r="35" fill="none" stroke-width="20" stroke-dasharray="0 220" stroke-dashoffset="-110" stroke-linecap="round"/>
    <circle class="pl__ring pl__ring--c" cx="85" cy="120" r="70" fill="none" stroke-width="20" stroke-dasharray="0 440" stroke-dashoffset="-110" stroke-linecap="round"/>
    <circle class="pl__ring pl__ring--d" cx="155" cy="120" r="70" fill="none" stroke-width="20" stroke-dasharray="0 440" stroke-dashoffset="-110" stroke-linecap="round"/>
  </svg><span class="soft-loading__label">正在加载视频</span></span></div>
  <noscript><style>.detail-static-video-loading{display:none!important}</style><p class="detail-static-video-notice">这是视频海报。启用 JavaScript 后可播放，也可下载文件。</p></noscript>`

export function buildDetailPresentation(record, related = []) {
  const seo = getWallpaperDetailSeo(record)
  const name = escapeDetailHtml(seo.name)
  const listPath = `/${record._series}`
  const dimensions = normalizeWallpaperDimensions(record.resolution)
  const hasDimensions = Boolean(dimensions.width && dimensions.height)
  const previewDimensions = normalizeWallpaperDimensions(record.previewResolution || record.resolution)
  const width = previewDimensions.width || 800
  const height = previewDimensions.height || 500
  const previewSource = record.mediaType === 'video' ? record.thumbnailUrl : record.previewUrl || record.thumbnailUrl
  const isPhone = (record._series || record.series) === 'mobile'
  const isAvatar = (record._series || record.series) === 'avatar'
  const image = `<img src="${escapeDetailHtml(previewSource)}" alt="${name}${record.mediaType === 'video' ? '视频海报' : ''}" width="${width}" height="${height}" fetchpriority="high" decoding="async">`
  const rawMedia = `<div class="detail-static-stage" style="aspect-ratio:${isAvatar ? '1 / 1' : `${width} / ${height}`}">${image}${record.mediaType === 'video' ? videoLoading : ''}</div>`
  const media = isAvatar ? rawMedia : renderDevicePreview(record, rawMedia)
  const fileFormat = record.format || record.filename?.split('.').pop()?.toUpperCase()
  const facts = [
    ['原文件尺寸', hasDimensions ? `${dimensions.width} × ${dimensions.height}` : '尺寸信息未提供'],
    ['文件格式', fileFormat],
    ['文件大小', record.size ? formatFileSize(record.size) : ''],
  ].filter(([, value]) => value).map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeDetailHtml(value)}</dd></div>`).join('')
  const attribution = [['作者', record.author], ['来源', record.source], ['授权', record.license]]
    .filter(([, value]) => value)
    .map(([label, value]) => `<dt>${label}</dt><dd>${escapeDetailHtml(value)}</dd>`)
    .join('')
  const category = [seo.seriesName, record.category, record.subcategory].filter(Boolean).map(escapeDetailHtml).join(' · ')
  const recommendations = related.filter(item => item.series === record.series && item.assetKey !== record.assetKey && isValidWallpaperCatalogItem(item))
  const relatedHtml = recommendations.map((item) => {
    const size = normalizeWallpaperDimensions(item.resolution)
    const title = escapeDetailHtml(getWallpaperDisplayTitle(item))
    return `<a href="${escapeDetailHtml(item.sharePath)}"><img src="${escapeDetailHtml(item.thumbnailUrl)}" alt="${title}" style="aspect-ratio:${getWallpaperCardAspectRatio(item).replace('/', ' / ')}" width="${size.width || 800}" height="${size.height || 500}" loading="lazy" decoding="async"></a>`
  }).join('')
  const tags = record.tags?.length ? `<div class="detail-tags" aria-label="壁纸标签">${record.tags.map(tag => `<span>${escapeDetailHtml(tag)}</span>`).join('')}</div>` : ''
  const data = serializeWallpaperStructuredData({ schema: 1, record, related: recommendations })
  return `<div data-wallpaper-detail>
    <header class="detail-static-header"><div class="detail-static-header-inner">
      <a class="detail-static-brand" href="/"><span class="detail-static-logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></span><span>Wallpaper Gallery<small>精选高清壁纸</small></span></a>
      <nav aria-label="壁纸分类">${[['desktop', '电脑壁纸'], ['mobile', '手机壁纸'], ['avatar', '头像'], ['bing', '每日 Bing'], ['video', '动态壁纸']].map(([id, label]) => `<a href="/${id}"${id === record._series ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
      <a class="detail-static-all" href="/">浏览壁纸</a>
    </div></header>
    <article class="wallpaper-detail">
      <div class="detail-topbar">
        <nav class="detail-breadcrumbs" aria-label="面包屑"><a href="/">首页</a><span aria-hidden="true">/</span><a href="${listPath}">${seo.seriesName}</a><span aria-hidden="true">/</span><span aria-current="page">${name}</span></nav>
        <a class="detail-back detail-static-button" href="${listPath}">${arrow}返回列表</a>
      </div>
      <div class="detail-layout">
        <section class="detail-media${record.mediaType === 'video' ? ' is-video' : ''}${isPhone ? ' is-phone' : ''}${isAvatar ? ' is-avatar' : ' has-device-preview'}" aria-label="${name}">
          ${media}
        </section>
        <section class="detail-info">
          <p class="detail-category">${category}</p><h1>${name}</h1>
          <p class="detail-description">${escapeDetailHtml(record.description || seo.description)}</p>
          ${statsPlaceholder}
          <dl class="detail-facts">${facts}</dl>${tags}
          <div class="detail-actions"><a class="detail-static-button is-primary" href="${escapeDetailHtml(record.downloadUrl)}" rel="noreferrer">${download}下载文件</a><button class="detail-static-button" type="button" disabled>复制分享链接</button>${record._series === 'desktop' && record.mediaType !== 'video' ? '<button class="detail-static-button" type="button" disabled>裁剪壁纸</button>' : ''}</div>
          <div class="detail-static-social"><button type="button" disabled>收藏</button><button type="button" disabled>喜欢</button></div>
          <div class="detail-extensions"><p class="detail-static-client">使用桌面客户端，可直接设置壁纸。 <a href="https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/tag/desktop" target="_blank" rel="noopener noreferrer">下载客户端</a></p></div>
          ${attribution ? `<dl class="detail-attribution">${attribution}</dl>` : ''}
        </section>
      </div>
      ${relatedHtml ? `<section class="detail-related"><div class="detail-related-heading"><h2>继续发现</h2><p>更多同系列壁纸</p></div><div class="detail-related-grid">${relatedHtml}</div></section>` : ''}
    </article>
    <script type="application/json" id="wallpaper-detail-data">${data}</script>
  </div>`
}
