import { buildWallpaperAssetKey } from './identity.js'

export const WALLPAPER_SITE_ORIGIN = 'https://wallpaper.061129.xyz'
export const MAX_SHARE_TOKEN_LENGTH = 4096

function isCanonicalShareKey(key) {
  if (typeof key !== 'string' || buildWallpaperAssetKey(key) !== key)
    return false
  if (/^bing:bing-\d{4}-\d{2}-\d{2}\.jpg$/.test(key))
    return true
  if (!/^(?:desktop|mobile|avatar|video):path:\/wallpaper\//.test(key))
    return false
  const segments = key.slice(key.indexOf(':path:') + 6).split('/').slice(1)
  return segments.every((segment) => {
    let decoded = segment
    for (let depth = 0; depth < 8; depth++) {
      try {
        decoded = decodeURIComponent(decoded)
      }
      catch { return !/%[a-f\d]{2}/i.test(decoded) }
      if (!decoded || decoded === '.' || decoded === '..' || (/[\\/]/.test(decoded) || [...decoded].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)))
        return false
      if (!/%[a-f\d]{2}/i.test(decoded))
        return true
    }
    return false
  })
}

export function encodeWallpaperShareToken(key) {
  if (!isCanonicalShareKey(key))
    return ''
  const bytes = new TextEncoder().encode(key)
  const token = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return token.length <= MAX_SHARE_TOKEN_LENGTH ? token : ''
}

export function decodeWallpaperShareToken(token) {
  if (typeof token !== 'string' || !token || token.length > MAX_SHARE_TOKEN_LENGTH || !/^[\w-]+$/.test(token))
    return ''
  try {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const key = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(base64), char => char.charCodeAt(0)))
    return encodeWallpaperShareToken(key) === token ? key : ''
  }
  catch { return '' }
}

export function buildWallpaperSharePath(wallpaper, series) {
  const token = encodeWallpaperShareToken(buildWallpaperAssetKey(wallpaper, series))
  return token ? `/wallpaper/${token}` : ''
}

export function buildWallpaperShareUrl(wallpaper, series, origin = globalThis.location?.origin || WALLPAPER_SITE_ORIGIN) {
  const path = buildWallpaperSharePath(wallpaper, series)
  if (!path)
    return ''
  try {
    const base = new URL(origin)
    return ['https:', 'http:'].includes(base.protocol) ? new URL(path, base.origin).href : ''
  }
  catch { return '' }
}

export function getWallpaperDetailBucketPath(token) {
  if (!decodeWallpaperShareToken(token))
    return ''
  let hash = 2166136261
  for (const character of token) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `/data/details/${(hash >>> 0 & 63).toString(16).padStart(2, '0')}.json`
}
