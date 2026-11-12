import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'

const STORAGE_KEY = 'wallpaper:online-visitor'
const IDLE_EXPIRY = 24 * 60 * 60 * 1000
const HEARTBEAT = 30000
const MAX_RETRY = 300000
const UUID = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i

// 随机标识只用于在线去重；24小时未使用后轮换，不包含登录或设备资料。
async function getVisitorId({ getStorage, createId, getNavigator, signal }) {
  const readOrCreate = () => {
    const storage = getStorage()
    let record
    try {
      record = JSON.parse(storage.getItem(STORAGE_KEY))
    }
    catch { /* 损坏的本地记录重新生成。 */ }
    const now = Date.now()
    const id = UUID.test(record?.id) && record.expires > now && record.expires <= now + IDLE_EXPIRY
      ? record.id
      : createId()
    if (!UUID.test(id))
      return null
    storage.setItem(STORAGE_KEY, JSON.stringify({ id, expires: now + IDLE_EXPIRY }))
    return JSON.parse(storage.getItem(STORAGE_KEY))?.id || null
  }
  try {
    const locks = getNavigator().locks
    // 首次同时打开多个标签时也只创建一个标识；旧WebView使用同步存储降级。
    return locks?.request
      ? await locks.request(STORAGE_KEY, { signal }, readOrCreate)
      : readOrCreate()
  }
  catch {
    // 禁用存储时不单独给每个标签计数，避免虚增。
    return null
  }
}

export function createOnlinePresence({
  fetchImpl = (...args) => fetch(...args),
  getWindow = () => window,
  getDocument = () => document,
  getNavigator = () => navigator,
  getStorage = () => localStorage,
  createId = () => crypto.randomUUID(),
} = {}) {
  const count = ref(null)
  let references = 0
  let timer = null
  let pending = null
  let generation = 0
  let failures = 0
  let notBefore = 0
  let lastSuccess = -Infinity
  let pageHidden = false
  const active = () => references > 0 && !pageHidden && getDocument().visibilityState === 'visible' && getNavigator().onLine !== false

  function schedule(delay) {
    clearTimeout(timer)
    timer = null
    if (active())
      timer = setTimeout(heartbeat, Math.max(0, delay))
  }

  async function heartbeat() {
    timer = null
    if (!active() || pending)
      return
    const request = ++generation
    const controller = new AbortController()
    pending = controller
    const { signal } = controller
    notBefore = Date.now() + 5000
    let delay = HEARTBEAT
    let cancel
    const cancelled = new Promise((_, reject) => {
      cancel = () => reject(new Error('PRESENCE_CANCELLED'))
      signal.addEventListener('abort', cancel, { once: true })
    })
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const result = await Promise.race([
        cancelled,
        (async () => {
          const visitorId = await getVisitorId({ getStorage, createId, getNavigator, signal })
          if (!visitorId || signal.aborted)
            throw new Error('PRESENCE_UNAVAILABLE')
          const response = await fetchImpl('/api/online-presence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitorId }),
            credentials: 'omit',
            cache: 'no-store',
            signal,
          })
          if (!response.ok) {
            const error = new Error('PRESENCE_UNAVAILABLE')
            const retry = Number(response.headers?.get('Retry-After'))
            error.retryAfter = Number.isFinite(retry) && retry > 0 ? Math.min(MAX_RETRY, retry * 1000) : 0
            throw error
          }
          const data = await response.json()
          if (!Number.isSafeInteger(data?.online) || data.online < 0 || data.online > 20000 || data.ttlSeconds !== 90 || data.heartbeatSeconds !== 30)
            throw new Error('PRESENCE_INVALID_RESPONSE')
          return data.online
        })(),
      ])
      if (request !== generation || signal.aborted || !active())
        return
      failures = 0
      lastSuccess = Date.now()
      count.value = result
    }
    catch (error) {
      if (request !== generation)
        return
      count.value = null
      failures = Math.min(failures + 1, 5)
      delay = Math.max(Math.min(MAX_RETRY, HEARTBEAT * 2 ** (failures - 1)), error.retryAfter || 0)
      notBefore = Date.now() + delay
    }
    finally {
      clearTimeout(timeout)
      signal.removeEventListener('abort', cancel)
      if (request === generation) {
        pending = null
        schedule(delay)
      }
    }
  }

  function pause() {
    generation += 1
    clearTimeout(timer)
    timer = null
    pending?.abort()
    pending = null
    count.value = null
  }
  function foreground() {
    if (!active()) {
      pause()
      return
    }
    if (!pending)
      schedule(Math.max(0, notBefore - Date.now()))
  }
  function pagehide() {
    pageHidden = true
    pause()
  }
  function pageshow() {
    pageHidden = false
    foreground()
  }
  function focused() {
    // 窗口焦点切换不改变原定的心跳时间；休眠后可补一次新数据。
    if (count.value === null || Date.now() - lastSuccess >= HEARTBEAT)
      foreground()
  }
  function retain() {
    references += 1
    if (references !== 1)
      return
    pageHidden = false
    getWindow().addEventListener('focus', focused)
    getWindow().addEventListener('online', foreground)
    getWindow().addEventListener('offline', foreground)
    getWindow().addEventListener('pagehide', pagehide)
    getWindow().addEventListener('pageshow', pageshow)
    getDocument().addEventListener('visibilitychange', foreground)
    // 不争抢首屏图片和数据请求。
    schedule(1500)
  }
  function release() {
    if (!references)
      return
    references -= 1
    if (references)
      return
    pause()
    getWindow().removeEventListener('focus', focused)
    getWindow().removeEventListener('online', foreground)
    getWindow().removeEventListener('offline', foreground)
    getWindow().removeEventListener('pagehide', pagehide)
    getWindow().removeEventListener('pageshow', pageshow)
    getDocument().removeEventListener('visibilitychange', foreground)
  }
  return { count: readonly(count), retain, release }
}

export const onlinePresence = createOnlinePresence()

export function useOnlinePresence() {
  onMounted(onlinePresence.retain)
  onBeforeUnmount(onlinePresence.release)
  return onlinePresence
}
