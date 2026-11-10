import { computed, onBeforeUnmount, onMounted, readonly, ref } from 'vue'
import { compareVersions, fetchUpdateJson, isLegacyCapabilityError, parseVersion, validateDesktopRelease } from '@/utils/update/version'

// 当前版本与构建时间由 Vite 注入。
// eslint-disable-next-line no-undef
const CURRENT_VERSION = typeof __APP_VERSION__ === 'undefined' ? '0.0.0' : __APP_VERSION__
// eslint-disable-next-line no-undef
const BUILD_TIME = typeof __BUILD_TIME__ === 'undefined' ? '' : __BUILD_TIME__
const TEN_MINUTES = 10 * 60 * 1000
const FOREGROUND_THROTTLE = 60 * 1000

export function createVersionChecker({ currentVersion = CURRENT_VERSION, fetchImpl = (...args) => fetch(...args), getWindow = () => window, getDocument = () => document, getNavigator = () => navigator, getStorage = () => sessionStorage } = {}) {
  const webNotice = ref(null)
  const desktopNotice = ref(null)
  const isChecking = ref(false)
  const dismissed = ref(new Set())
  let references = 0
  let timer = null
  let lastCheck = -Infinity
  let retainedAt = 0
  let generation = 0
  let lifecycle = 0
  let controller = null
  let invokeTimer = null
  let cancelInvoke = null
  let nativeIdentity = null

  function isDismissed(notice) {
    const key = `${notice.kind}:${notice.latest}`
    if (dismissed.value.has(key))
      return true
    try {
      return getStorage().getItem(`dismissed_update:${key}`) === 'true'
    }
    catch { return false }
  }
  const newVersionInfo = computed(() => [desktopNotice.value, webNotice.value].find(notice => notice && !isDismissed(notice)) || null)
  const hasNewVersion = computed(() => Boolean(newVersionInfo.value))
  const visible = () => getDocument().visibilityState !== 'hidden'
  const isNative = () => Boolean(getWindow().__TAURI__ || getWindow().__TAURI_INTERNALS__)

  async function identifyNative() {
    if (nativeIdentity)
      return nativeIdentity
    const invoke = getWindow().__TAURI__?.core?.invoke
    if (typeof invoke !== 'function')
      return null
    try {
      const value = await Promise.race([
        invoke('wallpaper_capabilities'),
        new Promise((resolve, reject) => {
          cancelInvoke = () => reject(new Error('UPDATE_INVOKE_TIMEOUT'))
          invokeTimer = setTimeout(cancelInvoke, 8000)
        }),
      ])
      if (parseVersion(value?.appVersion))
        nativeIdentity = { version: value.appVersion, legacy: false }
    }
    catch (error) {
      if (isLegacyCapabilityError(error))
        nativeIdentity = { version: '', legacy: true }
    }
    finally {
      clearTimeout(invokeTimer)
      invokeTimer = null
      cancelInvoke = null
    }
    return nativeIdentity
  }

  async function checkForUpdates() {
    if (isChecking.value || !visible())
      return
    isChecking.value = true
    lastCheck = Date.now()
    const request = ++generation
    controller = new AbortController()
    const signal = controller.signal
    const native = isNative()
    try {
      const [web, desktop] = await Promise.allSettled([
        fetchUpdateJson(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { fetchImpl, signal }),
        native
          ? Promise.all([
              fetchUpdateJson('/api/desktop-release', { fetchImpl, signal }),
              identifyNative(),
            ])
          : Promise.resolve(null),
      ])
      if (request !== generation || signal.aborted)
        return
      if (web.status === 'fulfilled' && parseVersion(web.value?.version)) {
        webNotice.value = compareVersions(web.value.version, currentVersion) === 1
          ? { kind: 'web', current: currentVersion, latest: web.value.version, buildTime: web.value.buildTime }
          : null
      }
      if (desktop.status === 'fulfilled' && desktop.value) {
        const [manifest, identity] = desktop.value
        const release = validateDesktopRelease(manifest, getNavigator().userAgent)
        const older = release && identity && (identity.legacy ? compareVersions(release.latest, '5.2.0') >= 0 : compareVersions(release.latest, identity.version) === 1)
        desktopNotice.value = older ? { kind: 'desktop', ...release, current: identity.version, legacy: identity.legacy } : null
      }
    }
    finally {
      if (request === generation) {
        controller = null
        isChecking.value = false
      }
    }
  }

  function schedule(delay = TEN_MINUTES) {
    clearTimeout(timer)
    timer = null
    if (references && visible()) {
      const activeLifecycle = lifecycle
      timer = setTimeout(async () => {
        timer = null
        await checkForUpdates()
        if (activeLifecycle === lifecycle)
          schedule()
      }, delay)
    }
  }
  function foreground() {
    if (!visible()) {
      clearTimeout(timer)
      timer = null
      return
    }
    if (lastCheck === -Infinity && Date.now() - retainedAt < 5000) {
      schedule(5000 - (Date.now() - retainedAt))
      return
    }
    if (Date.now() - lastCheck >= FOREGROUND_THROTTLE)
      void checkForUpdates()
    schedule()
  }
  function retain() {
    references += 1
    if (references !== 1)
      return
    lifecycle += 1
    retainedAt = Date.now()
    getWindow().addEventListener('focus', foreground)
    getWindow().addEventListener('pageshow', foreground)
    getDocument().addEventListener('visibilitychange', foreground)
    schedule(5000)
  }
  function release() {
    references = Math.max(0, references - 1)
    if (references)
      return
    lifecycle += 1
    generation += 1
    clearTimeout(timer)
    timer = null
    controller?.abort()
    controller = null
    cancelInvoke?.()
    clearTimeout(invokeTimer)
    isChecking.value = false
    getWindow().removeEventListener('focus', foreground)
    getWindow().removeEventListener('pageshow', foreground)
    getDocument().removeEventListener('visibilitychange', foreground)
  }
  function dismissUpdate() {
    const notice = newVersionInfo.value
    if (!notice)
      return
    const key = `${notice.kind}:${notice.latest}`
    dismissed.value = new Set([...dismissed.value, key])
    try {
      getStorage().setItem(`dismissed_update:${key}`, 'true')
    }
    catch { /* 存储受限时仍在当前页面记住忽略。 */ }
  }
  function forceRefresh() {
    const url = new URL(getWindow().location.href)
    url.searchParams.set('_t', Date.now())
    getWindow().location.href = url.href
  }
  return { hasNewVersion, newVersionInfo, isChecking: readonly(isChecking), currentVersion, buildTime: BUILD_TIME, checkForUpdates, forceRefresh, dismissUpdate, retain, release }
}

const checker = createVersionChecker()
export function useVersionCheck() {
  onMounted(checker.retain)
  onBeforeUnmount(checker.release)
  return checker
}
export { BUILD_TIME, CURRENT_VERSION }
