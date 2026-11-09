import { isSupabaseConfigured } from '@/lib/supabase/client'
import { getWallpaperIdentity } from '@/utils/wallpaper/identity'
import { getUserActivityAccessToken } from './userActivityService'

const SESSION_KEY = 'wallpaper-event-session'
const VIEW_KEY = 'wallpaper-view-events'
const VIEW_WINDOW_MS = 10 * 60 * 1000
const UUID_PATTERN = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i
let memorySessionId

function createEventId() {
  if (globalThis.crypto?.randomUUID)
    return globalThis.crypto.randomUUID()
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, character =>
    (Number(character) ^ Math.floor(Math.random() * 256) & 15 >> Number(character) / 4).toString(16))
}

function getSessionStorage() {
  try {
    return globalThis.sessionStorage || null
  }
  catch {
    return null
  }
}

function readStorage(storage, key) {
  try {
    return storage?.getItem(key)
  }
  catch {
    return null
  }
}

function writeStorage(storage, key, value) {
  try {
    storage?.setItem(key, value)
  }
  catch {
    // 隐私模式或存储已满时仍保留当前页面内的去重状态。
  }
}

export function getWallpaperSessionId(storage = getSessionStorage()) {
  const existing = readStorage(storage, SESSION_KEY)
  if (UUID_PATTERN.test(existing || ''))
    return existing
  memorySessionId ||= createEventId()
  writeStorage(storage, SESSION_KEY, memorySessionId)
  return memorySessionId
}

async function sendWallpaperEvent(params) {
  if (!isSupabaseConfigured())
    return { status: 'skipped' }

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const accessToken = await getUserActivityAccessToken()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/record_wallpaper_event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${accessToken || anonKey}`,
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    })
    if (!response.ok)
      throw Object.assign(new Error(`Wallpaper event failed: ${response.status}`), { status: response.status })

    const data = await response.json()
    const result = Array.isArray(data) ? data[0] : data
    const status = typeof result === 'string' ? result : result?.status
    if (!['accepted', 'duplicate'].includes(status))
      throw new Error('Unexpected wallpaper event response')
    return { status }
  }
  finally {
    clearTimeout(timeout)
  }
}

function isRetryable(error) {
  return error?.status === 429 || error?.status >= 500 || error?.name === 'AbortError' || (error instanceof TypeError && !error.status)
}

export function createWallpaperEventRecorder({
  send = sendWallpaperEvent,
  storage = getSessionStorage(),
  now = Date.now,
  uuid = createEventId,
  wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
} = {}) {
  const inFlightViews = new Map()
  const views = new Map()
  const sessionId = getWallpaperSessionId(storage)
  try {
    const saved = JSON.parse(readStorage(storage, VIEW_KEY) || '{}')
    if (saved.sessionId === sessionId) {
      for (const [assetKey, entry] of Object.entries(saved.views || {})) {
        if (UUID_PATTERN.test(entry?.eventId || '') && now() - entry.createdAt < VIEW_WINDOW_MS)
          views.set(assetKey, entry)
      }
    }
  }
  catch {
    // 损坏的缓存不影响统计请求。
  }

  function persistViews() {
    for (const [key, entry] of views) {
      if (now() - entry.createdAt >= VIEW_WINDOW_MS)
        views.delete(key)
    }
    writeStorage(storage, VIEW_KEY, JSON.stringify({ sessionId, views: Object.fromEntries(views) }))
  }

  async function sendWithRetry(assetKey, type, eventId) {
    const params = { p_event_id: eventId, p_asset_key: assetKey, p_event_type: type, p_session_id: sessionId }
    for (let attempt = 0; ; attempt++) {
      try {
        return await send(params)
      }
      catch (error) {
        if (attempt >= 2 || !isRetryable(error))
          throw error
        await wait(300 * 2 ** attempt)
      }
    }
  }

  function recordView(wallpaper, series) {
    const { assetKey } = getWallpaperIdentity(wallpaper, series)
    if (!assetKey)
      return Promise.resolve({ status: 'skipped' })
    if (inFlightViews.has(assetKey))
      return inFlightViews.get(assetKey).then(result => result.status === 'accepted' ? { status: 'duplicate' } : result)
    const previous = views.get(assetKey)
    if (previous?.accepted && now() - previous.createdAt < VIEW_WINDOW_MS)
      return Promise.resolve({ status: 'duplicate' })
    const entry = previous && now() - previous.createdAt < VIEW_WINDOW_MS
      ? previous
      : { eventId: uuid(), createdAt: now(), accepted: false }
    views.set(assetKey, entry)
    persistViews()
    const request = sendWithRetry(assetKey, 'view', entry.eventId).then((result) => {
      if (['accepted', 'duplicate'].includes(result.status)) {
        entry.accepted = true
        entry.createdAt = now()
        persistViews()
      }
      return result
    }).finally(() => inFlightViews.delete(assetKey))
    inFlightViews.set(assetKey, request)
    return request
  }

  function recordDownload(wallpaper, series) {
    const { assetKey } = getWallpaperIdentity(wallpaper, series)
    return assetKey ? sendWithRetry(assetKey, 'download', uuid()) : Promise.resolve({ status: 'skipped' })
  }

  return { recordView, recordDownload }
}

const recorder = createWallpaperEventRecorder()
export const recordWallpaperView = recorder.recordView
export const recordWallpaperDownload = recorder.recordDownload
