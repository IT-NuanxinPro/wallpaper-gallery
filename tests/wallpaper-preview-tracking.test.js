import { effectScope, nextTick, ref, watch } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isCurrentMediaEvent, usePreviewTracking } from '../src/composables/usePreviewTracking.js'
import { createWallpaperEventRecorder } from '../src/services/wallpaperEventService.js'

const mocks = vi.hoisted(() => ({ record: vi.fn(), analytics: vi.fn() }))
vi.mock('../src/services/statsService.js', () => ({ recordView: mocks.record }))
vi.mock('../src/utils/common/analytics.js', () => ({ trackWallpaperPreview: mocks.analytics }))
let scope
beforeEach(() => {
  vi.clearAllMocks()
  scope = effectScope()
})
afterEach(() => scope.stop())

describe('预览就绪与切图事件', () => {
  it('仅真实accepted后通知原资源统计已记录，skipped不触发刷新', async () => {
    const onRecorded = vi.fn()
    const wallpaper = ref({ path: '/wallpaper/desktop/a.jpg' })
    mocks.record.mockResolvedValueOnce({ status: 'accepted' }).mockResolvedValue({ status: 'skipped' })
    scope.run(() => usePreviewTracking({ wallpaper, series: ref('desktop'), isOpen: ref(true), ready: ref(true), onRecorded }))
    await Promise.resolve()
    expect(onRecorded).toHaveBeenCalledExactlyOnceWith('desktop:path:/wallpaper/desktop/a.jpg')
    wallpaper.value = { path: '/wallpaper/desktop/b.jpg' }
    await nextTick()
    await Promise.resolve()
    expect(onRecorded).toHaveBeenCalledOnce()
  })
  it('切视频后忽略上一资源排队中的canplay，中文路径与相对路径可正常识别', () => {
    expect(isCurrentMediaEvent({ target: { currentSrc: '/old.mp4', src: '/new.mp4' } }, '/new.mp4')).toBe(false)
    expect(isCurrentMediaEvent({ target: { currentSrc: 'http://localhost/%E9%A3%8E%E6%99%AF.mp4' } }, '/风景.mp4')).toBe(true)
  })

  it('未加载、加载失败和关闭均不计；下一张上一张与重开按资源窗口去重', async () => {
    const send = vi.fn().mockResolvedValue({ status: 'accepted' })
    const recorder = createWallpaperEventRecorder({ send, storage: null })
    mocks.record.mockImplementation(recorder.recordView)
    const a = { filename: 'same.jpg', path: '/wallpaper/desktop/a/same.jpg' }
    const b = { filename: 'same.jpg', path: '/wallpaper/desktop/b/same.jpg' }
    const wallpaper = ref(a)
    const isOpen = ref(true)
    const ready = ref(false)
    const failed = ref(false)
    scope.run(() => {
      watch(wallpaper, () => { ready.value = false; failed.value = false })
      usePreviewTracking({ wallpaper, series: ref('desktop'), isOpen, ready: () => ready.value && !failed.value })
    })
    await nextTick()
    expect(send).not.toHaveBeenCalled()
    ready.value = true
    failed.value = true
    await nextTick()
    expect(send).not.toHaveBeenCalled()
    failed.value = false
    await nextTick()
    expect(send).toHaveBeenCalledOnce()
    wallpaper.value = b
    await nextTick()
    expect(send).toHaveBeenCalledOnce()
    ready.value = true
    await nextTick()
    expect(send).toHaveBeenCalledTimes(2)
    wallpaper.value = a
    await nextTick()
    ready.value = true
    await nextTick()
    isOpen.value = false
    await nextTick()
    isOpen.value = true
    await nextTick()
    expect(send).toHaveBeenCalledTimes(2)
    await Promise.resolve()
    expect(mocks.analytics).toHaveBeenCalledTimes(2)
    expect(mocks.analytics).toHaveBeenNthCalledWith(1, a, 'desktop')
    expect(mocks.analytics).toHaveBeenNthCalledWith(2, b, 'desktop')
  })

  it('并发重开等待同一事件时仅首次接受发送分析，未配置服务时不发送图片分析事件', async () => {
    let finish
    const recorder = createWallpaperEventRecorder({ send: () => new Promise(resolve => { finish = resolve }), storage: null })
    mocks.record.mockImplementation(recorder.recordView)
    const isOpen = ref(true)
    const wallpaper = ref({ filename: 'a.jpg', path: '/wallpaper/desktop/a.jpg' })
    scope.run(() => usePreviewTracking({ wallpaper, series: ref('desktop'), isOpen, ready: ref(true) }))
    expect(mocks.analytics).not.toHaveBeenCalled()
    isOpen.value = false
    await nextTick()
    isOpen.value = true
    await nextTick()
    finish({ status: 'accepted' })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(mocks.analytics).toHaveBeenCalledExactlyOnceWith(wallpaper.value, 'desktop')
    mocks.record.mockResolvedValue({ status: 'skipped' })
    wallpaper.value = { filename: 'b.jpg', path: '/wallpaper/desktop/b.jpg' }
    await nextTick()
    expect(mocks.analytics).toHaveBeenCalledOnce()
  })

  it('委托子弹窗时不重复记录，失败后重新打开可再上报', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.record.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ status: 'accepted' })
    const enabled = ref(false)
    const isOpen = ref(true)
    scope.run(() => usePreviewTracking({
      wallpaper: ref({ path: '/wallpaper/desktop/a.jpg' }), series: ref('desktop'),
      isOpen, enabled, ready: ref(true),
    }))
    await nextTick()
    expect(mocks.record).not.toHaveBeenCalled()
    enabled.value = true
    await nextTick()
    await Promise.resolve()
    isOpen.value = false
    await nextTick()
    isOpen.value = true
    await nextTick()
    expect(mocks.record).toHaveBeenCalledTimes(2)
    vi.restoreAllMocks()
  })
})
