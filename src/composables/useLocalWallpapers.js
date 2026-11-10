import { computed, onBeforeUnmount, onMounted, readonly, ref } from 'vue'
import { createLocalWallpaperService } from '@/services/localWallpaperService'

const UPGRADE_MESSAGE = '请升级桌面客户端后管理本地壁纸。'
const READ_ERROR = '暂时无法读取本地壁纸，请重试。'
const ACTION_ERROR = '客户端操作未完成，请刷新列表后重试。'
const STORAGE_UPGRADE_MESSAGE = '请升级桌面客户端后更改保存位置。'

export function localFileManagerLabels(platform) {
  if (platform === 'macos')
    return { open: '在访达中打开', show: '在访达中显示', view: '在访达中查看' }
  if (platform === 'windows')
    return { open: '在文件资源管理器中打开', show: '在文件资源管理器中显示', view: '在文件资源管理器中查看' }
  return { open: '打开文件夹', show: '在文件夹中显示', view: '在文件夹中查看' }
}

export function deleteProtectionReason(entry, readOnly) {
  if (readOnly)
    return '本地记录需要修复，当前只可预览和定位图片。'
  if (entry.isCurrent)
    return '最近应用的壁纸受保护，切换到其他图片后再试。'
  if (entry.isPrevious)
    return '上一张壁纸受保护，保留用于恢复。'
  if (entry.inRotation)
    return '这张图片正在轮换队列中，停止轮换后再试。'
  if (entry.possiblyActive)
    return '这张图片可能仍被系统使用，客户端暂不允许删除。'
  return entry.deleteBlockedReason ? '客户端正在保护这张图片，暂时不能删除。' : ''
}

export function formatLocalBytes(bytes) {
  if (bytes < 1024)
    return `${bytes} B`
  const unit = bytes < 1024 * 1024 ? 'KB' : bytes < 1024 * 1024 * 1024 ? 'MB' : 'GB'
  const divisor = { KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 }[unit]
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(bytes / divisor)} ${unit}`
}

export function formatLocalDate(value) {
  return value === null ? '日期未知' : new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

export function createLocalWallpaperState(service, options = {}) {
  const phase = ref('idle')
  const library = ref(null)
  const capabilities = ref(null)
  const loading = ref(false)
  const operation = ref(null)
  const confirming = ref(false)
  const error = ref('')
  const thumbnails = ref({})
  const busy = computed(() => Boolean(operation.value) || confirming.value)
  const canChangeLocation = computed(() => capabilities.value?.storageManagementVersion === 1)
  const fileManagerLabels = computed(() => localFileManagerLabels(capabilities.value?.platform))
  const createObjectURL = options.createObjectURL || (blob => URL.createObjectURL(blob))
  const revokeObjectURL = options.revokeObjectURL || (url => URL.revokeObjectURL(url))
  let disposed = false
  let requestVersion = 0
  let thumbnailVersion = 0
  let activeThumbnails = 0
  let thumbnailQueue = []
  let probe = null

  function releaseThumbnails() {
    thumbnailVersion += 1
    thumbnailQueue = []
    for (const item of Object.values(thumbnails.value)) {
      if (item.url)
        revokeObjectURL(item.url)
    }
    thumbnails.value = {}
  }
  function pumpThumbnails() {
    if (disposed)
      return
    while (activeThumbnails < 2 && thumbnailQueue.length) {
      const { cacheId, version } = thumbnailQueue.shift()
      activeThumbnails += 1
      service.thumbnail(cacheId).then((blob) => {
        if (disposed || version !== thumbnailVersion)
          return
        thumbnails.value[cacheId] = { url: createObjectURL(blob), loading: false, error: false }
      }).catch(() => {
        if (!disposed && version === thumbnailVersion)
          thumbnails.value[cacheId] = { url: '', loading: false, error: true }
      }).finally(() => {
        activeThumbnails -= 1
        pumpThumbnails()
      })
    }
  }
  function replaceLibrary(value) {
    releaseThumbnails()
    library.value = value
    for (const entry of value.entries) {
      thumbnails.value[entry.cacheId] = { url: '', loading: true, error: false }
      thumbnailQueue.push({ cacheId: entry.cacheId, version: thumbnailVersion })
    }
    pumpThumbnails()
  }
  function reportError(reason, message) {
    if (/command.*not found|unknown command|not allowed|not permitted|permission.*denied/i.test(String(reason))) {
      phase.value = 'upgrade'
      error.value = UPGRADE_MESSAGE
      releaseThumbnails()
    }
    else {
      error.value = message
    }
  }
  async function refresh() {
    if (disposed || phase.value !== 'ready' || operation.value)
      return false
    const version = ++requestVersion
    loading.value = true
    error.value = ''
    try {
      const value = await service.list()
      if (disposed || version !== requestVersion)
        return false
      replaceLibrary(value)
      return true
    }
    catch (reason) {
      if (!disposed && version === requestVersion) {
        reportError(reason, READ_ERROR)
        if (!library.value && phase.value === 'ready')
          phase.value = 'error'
      }
      return false
    }
    finally {
      if (!disposed && version === requestVersion)
        loading.value = false
    }
  }
  async function initialize(force = false) {
    if (disposed || probe || (!force && phase.value !== 'idle'))
      return probe
    if (!service.isNative()) {
      phase.value = 'browser'
      return
    }
    const version = ++requestVersion
    phase.value = 'checking'
    error.value = ''
    probe = (async () => {
      try {
        const value = await service.capabilities()
        if (disposed || version !== requestVersion)
          return
        if (value?.version !== 1 || value.cacheManagementVersion !== 1 || typeof value.supported !== 'boolean') {
          phase.value = 'upgrade'
          error.value = UPGRADE_MESSAGE
          return
        }
        if (!value.supported) {
          phase.value = 'unsupported'
          error.value = '当前系统暂不支持本地壁纸管理。'
          return
        }
        capabilities.value = value
        phase.value = 'ready'
        await refresh()
      }
      catch (reason) {
        if (!disposed && version === requestVersion) {
          phase.value = 'error'
          reportError(reason, READ_ERROR)
        }
      }
      finally { probe = null }
    })()
    return probe
  }
  function canMutate() {
    return !disposed && phase.value === 'ready' && library.value && !library.value.readOnly && !busy.value && !loading.value
  }
  const findEntry = cacheId => library.value?.entries.find(entry => entry.cacheId === cacheId)
  async function operate(kind, cacheId, action, updatesLibrary = true) {
    if (disposed || phase.value !== 'ready' || busy.value || loading.value)
      return false
    const version = ++requestVersion
    operation.value = { kind, cacheId }
    error.value = ''
    try {
      const result = await action()
      if (disposed || version !== requestVersion)
        return false
      if (kind === 'storage' && result.cancelled)
        return result
      if (updatesLibrary)
        replaceLibrary(kind === 'clear' || kind === 'storage' ? result.library : result)
      return kind === 'clear' || kind === 'storage' ? result : true
    }
    catch (reason) {
      if (!disposed && version === requestVersion) {
        if (kind === 'storage') {
          const unavailable = /command.*not found|unknown command/i.test(String(reason))
          if (unavailable)
            capabilities.value = { ...capabilities.value, storageManagementVersion: null }
          error.value = unavailable ? STORAGE_UPGRADE_MESSAGE : '保存位置未更改，请重新选择。'
        }
        else {
          reportError(reason, ACTION_ERROR)
        }
      }
      return false
    }
    finally {
      if (!disposed && version === requestVersion)
        operation.value = null
    }
  }
  async function afterConfirmation(confirm, action) {
    if (!canMutate())
      return false
    error.value = ''
    confirming.value = true
    let accepted = false
    try {
      accepted = await confirm() === true
    }
    catch { /* 取消确认不发起原生操作。 */ }
    finally { confirming.value = false }
    return accepted && !disposed ? action() : false
  }
  function apply(cacheId) {
    if (!canMutate() || !findEntry(cacheId)?.canApply)
      return Promise.resolve(false)
    return operate('apply', cacheId, () => service.apply(cacheId))
  }
  function remove(cacheId, confirm) {
    const eligible = () => canMutate() && findEntry(cacheId) && !deleteProtectionReason(findEntry(cacheId), library.value.readOnly)
    if (!eligible())
      return Promise.resolve(false)
    return afterConfirmation(confirm, () => eligible() ? operate('delete', cacheId, () => service.remove(cacheId)) : false)
  }
  function clearUnused(confirm) {
    return afterConfirmation(confirm, () => canMutate() ? operate('clear', null, () => service.clearUnused()) : false)
  }
  function reveal(cacheId = null) {
    if (cacheId !== null && !findEntry(cacheId))
      return Promise.resolve(false)
    return operate('reveal', cacheId, () => service.reveal(cacheId), false)
  }
  function stopRotation() {
    if (!canMutate() || !library.value.status.enabled)
      return Promise.resolve(false)
    return operate('stop', null, async () => {
      await service.stopRotation(library.value.status.intervalMinutes)
      return service.list()
    })
  }
  function changeLocation() {
    if (!canMutate() || !canChangeLocation.value)
      return Promise.resolve(false)
    return operate('storage', null, () => service.chooseStorage())
  }
  function retryThumbnail(cacheId) {
    if (disposed || !findEntry(cacheId) || thumbnails.value[cacheId]?.loading)
      return
    const previous = thumbnails.value[cacheId]
    if (previous?.url)
      revokeObjectURL(previous.url)
    thumbnails.value[cacheId] = { url: '', loading: true, error: false }
    thumbnailQueue.push({ cacheId, version: thumbnailVersion })
    pumpThumbnails()
  }
  function thumbnailFailed(cacheId) {
    const item = thumbnails.value[cacheId]
    if (!item)
      return
    if (item.url)
      revokeObjectURL(item.url)
    thumbnails.value[cacheId] = { url: '', loading: false, error: true }
  }
  function dispose() {
    disposed = true
    requestVersion += 1
    releaseThumbnails()
  }
  return { phase: readonly(phase), library: readonly(library), loading: readonly(loading), operation: readonly(operation), busy, canChangeLocation, fileManagerLabels, error: readonly(error), thumbnails: readonly(thumbnails), initialize, refresh, apply, remove, clearUnused, reveal, stopRotation, changeLocation, retryThumbnail, thumbnailFailed, dispose }
}

export function useLocalWallpapers() {
  const state = createLocalWallpaperState(createLocalWallpaperService())
  onMounted(() => state.initialize())
  onBeforeUnmount(state.dispose)
  return state
}
