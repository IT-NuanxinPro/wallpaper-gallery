import { buildSameSizeImageFallbackUrls } from '../common/format.js'

/** 推荐图只推进同尺寸候选，不修改目录记录，也不回退大原图。 */
export function advanceRelatedImageFallback(event, source) {
  const image = event?.target
  const current = image?.getAttribute('src')
  if (!current || !source)
    return false
  const base = image.ownerDocument?.baseURI || 'https://wallpaper.061129.xyz/'
  const currentUrl = new URL(current, base).href
  // 新候选刚写入时，迟到的旧图错误不能再次跳过候选。
  if (image.currentSrc && new URL(image.currentSrc, base).href !== currentUrl)
    return false
  const candidates = buildSameSizeImageFallbackUrls(source)
  const index = candidates.findIndex(candidate => new URL(candidate, base).href === currentUrl)
  if (index < 0 || index + 1 >= candidates.length)
    return false
  image.setAttribute('src', candidates[index + 1])
  return true
}
