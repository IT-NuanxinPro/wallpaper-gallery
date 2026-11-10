import { getRelatedWallpapers } from './detailRecords.js'

export function resolveWallpaperCollection(collection, catalog) {
  const byKey = new Map(catalog.map(item => [item.assetKey || item._assetKey, item]))
  const keys = [...new Set(collection.items)]
  const items = keys.map(key => byKey.get(key)).filter(Boolean)
  const missingKeys = keys.filter(key => !byKey.has(key))
  const pairs = collection.pairs.filter(pair => keys.includes(pair.desktopKey) && keys.includes(pair.mobileKey))
    .map(pair => ({ desktop: byKey.get(pair.desktopKey), mobile: byKey.get(pair.mobileKey) }))
    .filter(pair => pair.desktop?.series === 'desktop' && pair.mobile?.series === 'mobile')
  return { ...collection, items, missingKeys, pairs, cover: byKey.get(collection.coverKey) || items[0] || null }
}

export function getCollectionRelatedWallpapers(collection, catalog) {
  if (!collection?.cover)
    return []
  const included = new Set(collection.items.map(item => item.assetKey))
  const candidates = catalog.filter(item => !included.has(item.assetKey))
  return getRelatedWallpapers(collection.cover, candidates, 3)
}
