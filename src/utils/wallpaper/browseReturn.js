import { WALLPAPER_COLLECTIONS } from '../../content/collections.js'

const STORAGE_KEY = 'wallpaper-gallery-browse-return'
const listPaths = new Set(['/', '/desktop', '/mobile', '/avatar', '/video', '/bing', '/library', '/collections', ...WALLPAPER_COLLECTIONS.map(collection => `/collections/${collection.slug}`)])

export function isBrowseReturnPath(path) {
  if (typeof path !== 'string' || !path || path.length > 4096)
    return false
  try {
    const decoded = decodeURIComponent(path)
    if (decoded.includes('//') || decoded.includes('\\') || [...decoded].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
      return false
    return listPaths.has(path.split(/[?#]/, 1)[0])
  }
  catch { return false }
}

export function rememberBrowseReturn(path) {
  if (!isBrowseReturnPath(path))
    return
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, path)
  }
  catch { /* 存储不可用时仍可正常进入详情。 */ }
}

export function getBrowseReturn() {
  try {
    const path = globalThis.sessionStorage?.getItem(STORAGE_KEY)
    return isBrowseReturnPath(path) ? path : ''
  }
  catch { return '' }
}
