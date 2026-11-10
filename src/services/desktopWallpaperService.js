import { buildWallpaperAssetKey } from '@/utils/wallpaper/identity'

export const DESKTOP_CLIENT_URL = 'https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/tag/desktop'
export const ROTATION_INTERVALS = [15, 30, 60, 360, 720, 1440]
const SITE_ORIGIN = 'https://wallpaper.061129.xyz'

function safeSegment(segment) {
  let value = segment
  for (let depth = 0; depth < 8; depth++) {
    if (!value || value === '.' || value === '..' || /[\\/:]/.test(value) || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
      return false
    if (!value.includes('%'))
      return true
    try {
      value = decodeURIComponent(value)
    }
    catch { return false }
  }
  return false
}

export function buildDesktopWallpaperItem(wallpaper) {
  const reject = reason => ({ item: null, reason })
  if (!wallpaper || wallpaper.mediaType === 'video')
    return reject('原生壁纸支持静态 JPG、JPEG、PNG，暂不支持视频。')
  const assetKey = buildWallpaperAssetKey(wallpaper)
  if (!/^(?:desktop|mobile|avatar):path:\/wallpaper\//.test(assetKey) || wallpaper.isBing)
    return reject('暂不支持 Bing 或缺少完整资源信息的壁纸。')
  const rawUrl = wallpaper.downloadUrl || wallpaper.url
  if (typeof rawUrl !== 'string' || rawUrl.length > 8192 || rawUrl.includes('\\') || [...rawUrl].some(char => char.charCodeAt(0) < 32))
    return reject('这张图片没有可用的原图地址。')
  // 在 URL 标准化之前检查原始路径，避免点段或嵌套编码被隐藏。
  const originalPath = rawUrl.startsWith('/images/') ? rawUrl : rawUrl.match(/^https:\/\/[^/]+(\/.*)$/)?.[1]
  if (!originalPath || !originalPath.slice(1).split('/').every(safeSegment))
    return reject('原图地址不属于可信壁纸仓库。')
  let url
  try {
    url = new URL(rawUrl, SITE_ORIGIN)
  }
  catch { return reject('原图地址无效。') }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash)
    return reject('原图地址必须为不含参数的可信 HTTPS 地址。')
  const prefixes = { 'wallpaper.061129.xyz': '/images/', 'cdn.jsdelivr.net': '/gh/IT-NuanxinPro/nuanXinProPic@', 'raw.githubusercontent.com': '/IT-NuanxinPro/nuanXinProPic/' }
  const prefix = prefixes[url.hostname]
  const tagged = prefix && url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : ''
  const matched = tagged.match(/^v\d{1,10}\.\d{1,10}\.\d{1,10}(\/wallpaper\/(desktop|mobile|avatar)\/.+)$/)
  if (!matched || assetKey !== `${matched[2]}:path:${matched[1]}`)
    return reject('原图地址与资源身份不一致，暂不能应用。')
  if (!/\.(?:jpe?g|png)$/i.test(matched[1]))
    return reject('原生壁纸仅支持 JPG、JPEG、PNG；WebP、GIF 等格式请先转换。')
  const title = String(wallpaper.displayTitle || wallpaper.title || wallpaper.filename || '壁纸').slice(0, 120)
  return { item: { assetKey, url: url.href, title }, reason: '' }
}

export function createDesktopWallpaperService() {
  const getInvoke = () => typeof window !== 'undefined' && typeof window.__TAURI__?.core?.invoke === 'function' ? window.__TAURI__.core.invoke : null
  return {
    isNative: () => typeof window !== 'undefined' && Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__),
    async invoke(command, payload) {
      const invoke = getInvoke()
      if (!invoke)
        throw new Error('NATIVE_NOT_READY')
      return payload === undefined ? invoke(command) : invoke(command, payload)
    },
  }
}
