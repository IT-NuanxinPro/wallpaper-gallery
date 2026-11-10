export function normalizeWallpaperQuery(value) {
  return typeof value === 'string' ? value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ') : ''
}

function getSearchTexts(wallpaper = {}) {
  return [wallpaper.filename, wallpaper.category, wallpaper.subcategory, wallpaper.displayTitle, wallpaper.title, wallpaper.description, wallpaper.copyright, wallpaper.date, ...(Array.isArray(wallpaper.tags) ? wallpaper.tags : []), ...(Array.isArray(wallpaper.keywords) ? wallpaper.keywords : [])].map(normalizeWallpaperQuery).filter(Boolean)
}

export function matchesWallpaperQuery(wallpaper, query) {
  const terms = normalizeWallpaperQuery(query).split(' ').filter(Boolean)
  const texts = getSearchTexts(wallpaper)
  return terms.every(term => texts.some(text => text.includes(term)))
}
