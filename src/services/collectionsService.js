import { WALLPAPER_COLLECTIONS } from '../content/collections.js'
import { isValidWallpaperDetailRecord } from '../utils/wallpaper/detailRecords.js'
import { encodeWallpaperShareToken } from '../utils/wallpaper/share.js'

export async function loadCollectionWallpapers({ signal, fetchImpl = fetch } = {}) {
  const keys = [...new Set(WALLPAPER_COLLECTIONS.flatMap(collection => collection.items))]
  const unavailable = () => ({ records: [], missingKeys: [], failedKeys: keys })
  const checkCancelled = () => {
    if (signal?.aborted)
      throw new DOMException('Aborted', 'AbortError')
  }
  checkCancelled()
  let payload
  try {
    const response = await fetchImpl('/data/collections.json', { signal })
    checkCancelled()
    if (!response.ok)
      return unavailable()
    payload = await response.json()
    checkCancelled()
  }
  catch (error) {
    checkCancelled()
    if (error.name === 'AbortError')
      throw error
    return unavailable()
  }
  if (payload?.schema !== 1 || !payload.items || Array.isArray(payload.items) || typeof payload.items !== 'object')
    return unavailable()
  const result = { records: [], missingKeys: [], failedKeys: [] }
  for (const key of keys) {
    if (!Object.hasOwn(payload.items, key)) {
      result.missingKeys.push(key)
      continue
    }
    const record = payload.items[key]
    if (!isValidWallpaperDetailRecord(record, encodeWallpaperShareToken(key)))
      result.failedKeys.push(key)
    else
      result.records.push(record)
  }
  return result
}
