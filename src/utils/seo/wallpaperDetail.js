import { getWallpaperDetailSeo } from '../wallpaper/detailRecords.js'

export function applyWallpaperDetailSeo(record) {
  document.head.querySelector('meta[name="robots"][data-detail-status]')?.remove()
  const seo = getWallpaperDetailSeo(record)
  document.title = seo.title
  const tags = [
    ['name', 'description', seo.description],
    ['property', 'og:type', 'article'],
    ['property', 'og:title', seo.title],
    ['property', 'og:description', seo.description],
    ['property', 'og:image', seo.image],
    ['property', 'og:url', seo.canonical],
    ['name', 'twitter:title', seo.title],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:description', seo.description],
    ['name', 'twitter:image', seo.image],
    ['name', 'twitter:url', seo.canonical],
  ]
  for (const [attribute, key, content] of tags) {
    let element = document.head.querySelector(`meta[${attribute}="${key}"]`)
    if (!element) {
      element = document.createElement('meta')
      document.head.appendChild(element)
    }
    element.setAttribute(attribute, key)
    element.setAttribute('content', content)
  }
  let canonical = document.head.querySelector('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    document.head.appendChild(canonical)
  }
  canonical.setAttribute('href', seo.canonical)
}
