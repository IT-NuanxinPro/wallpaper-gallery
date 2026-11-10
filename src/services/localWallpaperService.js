import { ROTATION_INTERVALS } from '@/services/desktopWallpaperService'

const CACHE_ID = /^[a-f0-9]{64}\.(?:png|jpe?g)$/
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const MAX_THUMBNAIL_BYTES = 256 * 1024
const isCount = value => Number.isSafeInteger(value) && value >= 0
const isTime = value => value === null || (isCount(value) && value <= 8640000000000000)

function requireCacheId(cacheId) {
  if (typeof cacheId !== 'string' || !CACHE_ID.test(cacheId))
    throw new Error('INVALID_CACHE_ID')
  return cacheId
}

export function readCacheSnapshot(value) {
  if (!value || typeof value.storagePath !== 'string' || !value.storagePath || !isCount(value.totalBytes) || !isCount(value.totalCount) || typeof value.readOnly !== 'boolean' || !(value.warning === null || typeof value.warning === 'string') || !Array.isArray(value.entries) || value.totalCount !== value.entries.length)
    throw new Error('INVALID_CACHE_SNAPSHOT')
  const status = value.status
  if (!status || typeof status.supported !== 'boolean' || typeof status.enabled !== 'boolean' || !ROTATION_INTERVALS.includes(status.intervalMinutes) || !isCount(status.cacheCount))
    throw new Error('INVALID_CACHE_STATUS')
  const ids = new Set()
  for (const entry of value.entries) {
    requireCacheId(entry?.cacheId)
    if (ids.has(entry.cacheId) || typeof entry.title !== 'string' || typeof entry.titleKnown !== 'boolean' || !isCount(entry.bytes) || !isTime(entry.modifiedAt) || !isTime(entry.lastAppliedAt) || !['isCurrent', 'isPrevious', 'inRotation', 'possiblyActive', 'canApply'].every(key => typeof entry[key] === 'boolean') || !(entry.deleteBlockedReason === null || typeof entry.deleteBlockedReason === 'string'))
      throw new Error('INVALID_CACHE_ENTRY')
    ids.add(entry.cacheId)
  }
  return value
}

export function thumbnailBlob(value) {
  let bytes
  if (value instanceof ArrayBuffer)
    bytes = new Uint8Array(value)
  else if (ArrayBuffer.isView(value))
    bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  else if (Array.isArray(value) && value.length <= MAX_THUMBNAIL_BYTES && value.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255))
    bytes = new Uint8Array(value)
  if (!bytes || bytes.byteLength > MAX_THUMBNAIL_BYTES || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte))
    throw new Error('INVALID_THUMBNAIL')
  return new Blob([bytes], { type: 'image/png' })
}

export function createLocalWallpaperService(options = {}) {
  const isNative = options.isNative || (() => typeof window !== 'undefined' && Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__))
  async function invoke(command, payload) {
    const call = options.invoke || (typeof window !== 'undefined' && (window.__TAURI__?.core?.invoke || window.__TAURI_INTERNALS__?.invoke))
    if (typeof call !== 'function')
      throw new Error('Unknown command bridge')
    return payload === undefined ? call(command) : call(command, payload)
  }
  return {
    isNative,
    capabilities: () => invoke('wallpaper_capabilities'),
    list: async () => readCacheSnapshot(await invoke('wallpaper_cache_list')),
    thumbnail: async cacheId => thumbnailBlob(await invoke('wallpaper_cache_thumbnail', { cacheId: requireCacheId(cacheId) })),
    apply: async cacheId => readCacheSnapshot(await invoke('wallpaper_cache_apply', { cacheId: requireCacheId(cacheId) })),
    reveal: cacheId => invoke('wallpaper_cache_reveal', { cacheId: cacheId === null ? null : requireCacheId(cacheId) }),
    remove: async cacheId => readCacheSnapshot(await invoke('wallpaper_cache_delete', { cacheId: requireCacheId(cacheId) })),
    async clearUnused() {
      const result = await invoke('wallpaper_cache_clear_unused')
      if (!isCount(result?.removedCount) || !isCount(result?.freedBytes))
        throw new Error('INVALID_CLEAR_RESULT')
      return { ...result, library: readCacheSnapshot(result.library) }
    },
    async chooseStorage() {
      const result = await invoke('wallpaper_storage_choose')
      if (typeof result?.cancelled !== 'boolean')
        throw new Error('INVALID_STORAGE_RESULT')
      return { cancelled: result.cancelled, library: readCacheSnapshot(result.library) }
    },
    stopRotation: intervalMinutes => invoke('wallpaper_configure_rotation', { config: { enabled: false, intervalMinutes, items: [] } }),
  }
}
