import { computed, onBeforeUnmount, onMounted, readonly, ref, toValue, watch } from 'vue'
import { buildDesktopWallpaperItem, createDesktopWallpaperService, ROTATION_INTERVALS } from '@/services/desktopWallpaperService'

const STATUS_READ_ERROR = '暂时无法读取客户端轮换状态，请重试。'

function nativeError(error) {
  return /command.*not found|unknown command|not allowed|not permitted|permission.*denied/i.test(String(error))
    ? '请升级桌面客户端后使用原生壁纸功能。'
    : '客户端操作未完成，请检查网络和系统权限后重试。'
}

export function createDesktopWallpaperState(service) {
  const phase = ref('idle')
  const capabilities = ref(null)
  const status = ref(null)
  const busy = ref(false)
  const error = ref('')
  const message = ref('')
  let probe = null
  let statusVersion = 0
  let probeVersion = 0

  async function initialize(force = false) {
    if (probe)
      return probe
    if (!force && phase.value !== 'idle')
      return
    if (!service.isNative()) {
      phase.value = 'browser'
      return
    }
    const version = ++probeVersion
    phase.value = 'checking'
    error.value = ''
    probe = (async () => {
      try {
        const value = await service.invoke('wallpaper_capabilities')
        if (version !== probeVersion)
          return
        if (value?.version !== 1 || typeof value.supported !== 'boolean' || !Array.isArray(value.supportedFormats))
          throw new Error('Unknown command version')
        capabilities.value = value
        phase.value = value.supported ? 'ready' : 'unsupported'
        if (!value.supported)
          error.value = typeof value.reason === 'string' ? value.reason.split('\n')[0].slice(0, 160) : '当前系统暂不支持原生壁纸。'
      }
      catch (reason) {
        error.value = nativeError(reason)
        phase.value = error.value.includes('升级') ? 'upgrade' : 'error'
      }
      finally { probe = null }
    })()
    return probe
  }

  function readStatus(value) {
    if (!value || typeof value.supported !== 'boolean' || typeof value.enabled !== 'boolean' || !ROTATION_INTERVALS.includes(value.intervalMinutes) || !Number.isInteger(value.cacheCount) || value.cacheCount < 0)
      throw new Error('INVALID_STATUS')
    status.value = value
  }
  async function refreshStatus() {
    if (phase.value !== 'ready' || busy.value)
      return false
    const version = ++statusVersion
    try {
      const value = await service.invoke('wallpaper_rotation_status')
      if (version === statusVersion && !busy.value) {
        readStatus(value)
        if (error.value === STATUS_READ_ERROR)
          error.value = ''
      }
      return true
    }
    catch {
      if (version === statusVersion)
        error.value = STATUS_READ_ERROR
      return false
    }
  }
  async function operate(command, payload, success) {
    if (phase.value !== 'ready' || busy.value)
      return false
    busy.value = true
    statusVersion += 1
    message.value = ''
    error.value = ''
    try {
      readStatus(await service.invoke(command, payload))
      message.value = success
      return true
    }
    catch (reason) {
      error.value = nativeError(reason)
      return false
    }
    finally { busy.value = false }
  }
  function eligibility(wallpaper) {
    const result = buildDesktopWallpaperItem(wallpaper)
    if (result.item && capabilities.value && !capabilities.value.supportedFormats.includes(result.item.url.split('.').at(-1).toLowerCase()))
      return { item: null, reason: '当前客户端尚不支持此图片格式，请升级。' }
    return result
  }
  function apply(wallpaper) {
    const result = eligibility(wallpaper)
    if (!result.item) {
      error.value = result.reason
      return Promise.resolve(false)
    }
    return operate('wallpaper_apply', { item: result.item }, '已设置为桌面壁纸。')
  }
  function restore() {
    if (!status.value?.previous)
      return Promise.resolve(false)
    return operate('wallpaper_restore', undefined, '已恢复上次应用的壁纸。')
  }
  function configure({ enabled, intervalMinutes, items = [] }) {
    const unique = new Map()
    if (enabled) {
      for (const wallpaper of items) {
        const result = eligibility(wallpaper)
        if (!result.item) {
          error.value = result.reason
          return Promise.resolve(false)
        }
        unique.set(result.item.assetKey, result.item)
      }
      if (!ROTATION_INTERVALS.includes(intervalMinutes) || !unique.size || unique.size > 50) {
        error.value = '请选择 1 至 50 张可用壁纸和有效轮换间隔。'
        return Promise.resolve(false)
      }
    }
    return operate('wallpaper_configure_rotation', { config: { enabled, intervalMinutes: ROTATION_INTERVALS.includes(intervalMinutes) ? intervalMinutes : 60, items: [...unique.values()] } }, enabled ? '已开启，客户端运行时按计划更换。' : '已停止自动轮换。')
  }
  return { phase: readonly(phase), capabilities: readonly(capabilities), status: readonly(status), busy: readonly(busy), error: readonly(error), message: readonly(message), initialize, refreshStatus, eligibility, apply, restore, configure }
}

const sharedState = createDesktopWallpaperState(createDesktopWallpaperService())

export function useDesktopWallpaper({ visible = true, poll = false, state = sharedState } = {}) {
  const foreground = ref(typeof document === 'undefined' || document.visibilityState !== 'hidden')
  const active = computed(() => Boolean(toValue(visible)) && foreground.value && state.phase.value === 'ready')
  let timer = null
  let generation = 0
  let mounted = false
  function clearPoll() {
    generation += 1
    clearTimeout(timer)
    timer = null
  }
  async function tick(version) {
    await state.refreshStatus()
    if (mounted && version === generation && active.value && poll)
      timer = setTimeout(() => tick(version), 10000)
  }
  function visibilityChanged() {
    foreground.value = document.visibilityState !== 'hidden'
  }
  watch(active, (enabled) => {
    clearPoll()
    if (enabled && mounted)
      void tick(generation)
  })
  onMounted(() => {
    mounted = true
    void state.initialize()
    document.addEventListener('visibilitychange', visibilityChanged)
    if (active.value)
      void tick(generation)
  })
  onBeforeUnmount(() => {
    mounted = false
    clearPoll()
    document.removeEventListener('visibilitychange', visibilityChanged)
  })
  return state
}
