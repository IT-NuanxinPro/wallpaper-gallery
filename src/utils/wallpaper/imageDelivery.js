const DEFAULT_IMAGE_BASE_URL = '/images'
const IMAGE_DIRECTORY_PATTERN = /^\/(?:thumbnail|preview)\/(?:desktop|mobile|avatar)$/
const RASTER_EXTENSION_PATTERN = /\.(?:jpe?g|png|webp|avif|gif|bmp|ico)$/i
const CDN_TAG_PATTERN = /^v\d+\.\d+\.\d+(?:-[a-z\d]+(?:[.-][a-z\d]+)*)?(?:\+[a-z\d]+(?:[.-][a-z\d]+)*)?$/i

// 元数据混用原始和已编码路径；编码文件名中的 # 等字符，同时保留已有的百分号编码。
export function encodeImagePath(path) {
  return String(path || '')
    .split('/')
    .map(segment => encodeURIComponent(segment).replace(/%25([a-f\d]{2})/gi, '%$1'))
    .join('/')
}

function getImageBaseUrl() {
  const configured = String(import.meta.env.VITE_IMAGE_BASE_URL || DEFAULT_IMAGE_BASE_URL).trim()
  if (/[\\?#\s]/.test(configured))
    return DEFAULT_IMAGE_BASE_URL

  if (configured.replace(/\/+$/, '') === DEFAULT_IMAGE_BASE_URL)
    return DEFAULT_IMAGE_BASE_URL

  try {
    const url = new URL(configured)
    if (url.protocol === 'https:' && !url.username && !url.password
      && url.pathname.replace(/\/+$/, '') === DEFAULT_IMAGE_BASE_URL) {
      return `${url.origin}${DEFAULT_IMAGE_BASE_URL}`
    }
  }
  catch {}

  return DEFAULT_IMAGE_BASE_URL
}

function canProxyImage(path, includeOriginal = false) {
  const segments = path.split('/')
  const directory = segments.slice(0, 3).join('/')
  if ((!IMAGE_DIRECTORY_PATTERN.test(directory)
    && !(includeOriginal && /^\/wallpaper\/(?:desktop|mobile|avatar)$/.test(directory))) || segments.length < 4 || path.length > 4096) {
    return false
  }

  try {
    const fileSegments = segments.slice(3).map(segment => decodeURIComponent(segment))
    return RASTER_EXTENSION_PATTERN.test(fileSegments.at(-1)) && fileSegments.every(isSafeImageSegment)
  }
  catch {
    return false
  }
}

function isSafeImageSegment(segment) {
  let candidate = segment
  // 与图片入口的路径限制保持一致；这里只验证嵌套编码，不改变实际文件名。
  for (let depth = 0; depth < 8; depth++) {
    if (!candidate || candidate === '.' || candidate === '..' || /[\\/:]/.test(candidate)
      || [...candidate].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
      || /%(?:2f|5c|3a|0[\da-f]|1[\da-f]|7f)/i.test(candidate)) {
      return false
    }
    if (!/%[a-f\d]{2}/i.test(candidate))
      return true
    // 逐字节检查 ASCII 分隔符，避免无效 UTF-8 或字面百分号掩盖危险编码。
    candidate = candidate.replace(/%([a-f\d]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
  }
  return false
}

function isSupportedTag(cdnTag) {
  return cdnTag.length <= 100 && CDN_TAG_PATTERN.test(cdnTag)
}

function isSafeRepositoryPath(path) {
  if (!path.startsWith('/') || path.length > 4096)
    return false
  try {
    return path.slice(1).split('/').map(decodeURIComponent).every(isSafeImageSegment)
  }
  catch {
    return false
  }
}

function buildDirectImageUrl(path, cdnTag) {
  return `https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@${cdnTag}${path}`
}

export function buildImageDeliveryUrl(path, cdnTag) {
  const encodedPath = encodeImagePath(path)
  if (String(import.meta.env.VITE_IMAGE_PROXY_ENABLED).toLowerCase() !== 'false'
    && isSupportedTag(cdnTag) && canProxyImage(encodedPath)) {
    return `${getImageBaseUrl()}/${cdnTag}${encodedPath}`
  }
  return buildDirectImageUrl(encodedPath, cdnTag)
}

/** 将自有入口还原为同尺寸 jsDelivr 地址；其他来源保持不变。 */
export function resolveDirectImageUrl(url) {
  if (!url || /[?#]/.test(url))
    return url

  for (const base of new Set([getImageBaseUrl(), DEFAULT_IMAGE_BASE_URL])) {
    if (!url.startsWith(`${base}/`))
      continue
    const resource = url.slice(base.length + 1)
    const separator = resource.indexOf('/')
    const cdnTag = resource.slice(0, separator)
    const path = resource.slice(separator)
    if (separator > 0 && isSupportedTag(cdnTag) && canProxyImage(path, true))
      return buildDirectImageUrl(path, cdnTag)
  }
  return url
}

/** 原图仅将固定仓库的安全路径交给入口；直连回退始终保留版本和原始尺寸。 */
export function buildImageFetchUrls(url) {
  const direct = resolveDirectImageUrl(url)
  const match = direct?.match(/^https:\/\/(?:cdn\.jsdelivr\.net\/gh\/IT-NuanxinPro\/nuanXinProPic@|raw\.githubusercontent\.com\/IT-NuanxinPro\/nuanXinProPic\/)([^/]+)(\/[^?#]*)$/)
  if (!match || !isSupportedTag(match[1]) || !isSafeRepositoryPath(match[2]))
    return url ? [url] : []

  const [, tag, path] = match
  const gateway = String(import.meta.env.VITE_IMAGE_PROXY_ENABLED).toLowerCase() === 'false' || !canProxyImage(path, true)
    ? ''
    : `${getImageBaseUrl()}/${tag}${path}`
  const raw = `https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/${tag}${path}`
  return [...new Set([gateway, direct, buildDirectImageUrl(path, tag), raw].filter(Boolean))]
}
