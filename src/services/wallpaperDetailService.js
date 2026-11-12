import { buildWallpaperDetailRecord, isValidWallpaperCatalogItem, isValidWallpaperDetailRecord } from '../utils/wallpaper/detailRecords.js'
import { decodeWallpaperShareToken, getWallpaperDetailBucketPath } from '../utils/wallpaper/share.js'

const detailCache = new Map()
const DETAIL_CACHE_TTL = 5 * 60 * 1000
const DETAIL_CACHE_LIMIT = 32

// 站内跳转直接交接已有元数据；公开链接仍走独立详情记录与服务端页面。
export function primeWallpaperDetail(wallpaper, { series, cdnTag } = {}) {
  if (!wallpaper)
    return null
  const record = wallpaper.sharePath
    ? wallpaper
    : buildWallpaperDetailRecord({ ...wallpaper, _series: wallpaper._series || series }, cdnTag)
  const token = record?.sharePath?.split('/').at(-1)
  if (!isValidWallpaperDetailRecord(record, token))
    return null
  detailCache.delete(token)
  detailCache.set(token, { record, expires: Date.now() + DETAIL_CACHE_TTL })
  if (detailCache.size > DETAIL_CACHE_LIMIT)
    detailCache.delete(detailCache.keys().next().value)
  return record
}

export function readReadyWallpaperDetail(token) {
  const initial = readInitialWallpaperDetail(token)
  if (initial)
    return initial.record
  const cached = detailCache.get(token)
  if (!cached)
    return null
  if (cached.expires <= Date.now()) {
    detailCache.delete(token)
    return null
  }
  return cached.record
}

export function detailRequestError(status, message) {
  return Object.assign(new Error(message), { status })
}

export function readInitialWallpaperDetail(token, document = globalThis.document) {
  try {
    const content = document?.getElementById('wallpaper-detail-data')?.textContent
    if (!content || content.length > 256 * 1024)
      return null
    const payload = JSON.parse(content)
    if (payload?.schema !== 1 || !isValidWallpaperDetailRecord(payload.record, token))
      return null
    return {
      record: payload.record,
      related: Array.isArray(payload.related) ? payload.related.filter(item => item.series === payload.record.series && isValidWallpaperCatalogItem(item)) : [],
    }
  }
  catch { return null }
}

export async function loadWallpaperDetail(token, { signal, fetchImpl = fetch } = {}) {
  if (!decodeWallpaperShareToken(token))
    throw detailRequestError(404, '分享链接无效')
  if (signal?.aborted)
    throw new DOMException('Aborted', 'AbortError')
  const ready = readReadyWallpaperDetail(token)
  if (ready)
    return ready
  const response = await fetchImpl(getWallpaperDetailBucketPath(token), { signal })
  if (!response.ok)
    throw detailRequestError(response.status === 404 ? 404 : 503, '详情数据暂时无法加载')
  const payload = await response.json()
  if (payload?.schema !== 1 || !payload.items || typeof payload.items !== 'object')
    throw detailRequestError(503, '详情数据格式无效')
  const record = Object.hasOwn(payload.items, token) ? payload.items[token] : null
  if (!record)
    throw detailRequestError(404, '这张壁纸已移除或不存在')
  if (!isValidWallpaperDetailRecord(record, token))
    throw detailRequestError(503, '详情记录无效')
  if (signal?.aborted)
    throw new DOMException('Aborted', 'AbortError')
  return record
}

const catalogCache = new Map()

export async function loadWallpaperCatalog({ series, signal, fetchImpl = fetch } = {}) {
  if (!['desktop', 'mobile', 'avatar', 'video', 'bing'].includes(series))
    throw detailRequestError(400, '推荐目录系列无效')
  if (catalogCache.has(series))
    return catalogCache.get(series)
  const response = await fetchImpl(`/data/details/index-${series}.json`, { signal })
  if (!response.ok)
    throw detailRequestError(503, '相关推荐暂不可用')
  const payload = await response.json()
  if (payload?.schema !== 1 || !Array.isArray(payload.items))
    throw detailRequestError(503, '推荐目录格式无效')
  const items = payload.items.filter(item => item.series === series && isValidWallpaperCatalogItem(item))
  catalogCache.set(series, items)
  return items
}

// 即使旧 fetch 无视取消，也不允许旧路由请求覆盖当前详情。
export function createWallpaperDetailLoader({ load = loadWallpaperDetail, onState } = {}) {
  let controller
  let revision = 0
  return {
    async load(token) {
      controller?.abort()
      controller = new AbortController()
      const requestRevision = ++revision
      const ready = readReadyWallpaperDetail(token)
      if (ready) {
        onState({ loading: false, record: ready, error: null })
        return
      }
      onState({ loading: true, record: null, error: null })
      try {
        const record = await load(token, { signal: controller.signal })
        if (requestRevision === revision) {
          primeWallpaperDetail(record)
          onState({ loading: false, record, error: null })
        }
      }
      catch (error) {
        if (requestRevision === revision && error.name !== 'AbortError')
          onState({ loading: false, record: null, error })
      }
    },
    cancel() {
      revision++
      controller?.abort()
    },
  }
}
