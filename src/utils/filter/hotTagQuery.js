import { buildWallpaperAssetKey } from '@/utils/wallpaper/identity'
import { encodeWallpaperShareToken } from '@/utils/wallpaper/share'

// 列表和专题使用同一套标签导航，不能把分类或 Bing 单图退化成关键词。
export function buildHotTagQuery(tagItem, series, categories = []) {
  const tag = tagItem?.tag || ''
  const query = { q: '', exact: '', image: '', category: 'all', subcategory: 'all', format: 'all', resolution: 'all' }
  const month = series === 'bing' && tag.match(/^(\d{4})[\s-]+(\d{2})$/)
  if (month)
    return { ...query, category: `${month[1]}-${month[2]}` }
  const category = categories.find(item => [item.value, item.label].includes(tag))
  if (category)
    return { ...query, category: category.value }
  const parent = categories.find(item => item.subcategories?.some(child => (child.name || child.value) === tag))
  if (parent)
    return { ...query, category: parent.value, subcategory: tag }
  if (series === 'bing' && tagItem.topWallpapers?.length === 1) {
    const assetKey = buildWallpaperAssetKey(tagItem.topWallpapers[0], 'bing')
    return { ...query, q: tag, exact: encodeWallpaperShareToken(assetKey) }
  }
  return { ...query, q: tag }
}
