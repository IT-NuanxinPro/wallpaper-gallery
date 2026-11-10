import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useWallpaperDownload } from '../src/composables/useWallpaperDownload.js'

const mocks = vi.hoisted(() => ({
  download: vi.fn(), record: vi.fn(), analytics: vi.fn(),
  info: vi.fn(), success: vi.fn(), error: vi.fn(),
}))
vi.mock('../src/utils/common/format.js', () => ({
  downloadFile: mocks.download,
  buildWallpaperDownloadFilename: wallpaper => wallpaper.filename,
}))
vi.mock('../src/services/statsService.js', () => ({ recordDownload: mocks.record }))
vi.mock('../src/utils/common/analytics.js', () => ({ trackWallpaperDownload: mocks.analytics }))
vi.mock('element-plus', () => ({ ElMessage: { info: mocks.info, success: mocks.success, error: mocks.error } }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.record.mockResolvedValue({ status: 'accepted' })
})
afterEach(() => vi.restoreAllMocks())

describe('下载操作的资源快照', () => {
  it('取消下载不产生统计与错误提示，并允许重试', async () => {
    let signal
    mocks.download.mockImplementation((_url, _filename, options) => new Promise((_resolve, reject) => {
      signal = options.signal
      signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })
    }))
    const state = useWallpaperDownload(ref({ filename: 'a.jpg', url: '/a.jpg' }), ref('desktop'))
    const pending = state.handleDownload()
    expect(state.cancelDownload).toBeTypeOf('function')
    state.cancelDownload()
    expect(signal.aborted).toBe(true)
    expect(await pending).toEqual({ status: 'cancelled' })
    expect(mocks.record).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
    expect(state.downloading.value).toBe(false)
  })
  it('下载A时切到B，仍只对A记录一次；重复点击不重复下载', async () => {
    let finish
    mocks.download.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const a = { filename: 'a.jpg', url: '/a.jpg' }
    const wallpaper = ref(a)
    const series = ref('desktop')
    const state = useWallpaperDownload(wallpaper, series)
    const pending = state.handleDownload()
    wallpaper.value = { filename: 'b.jpg', url: '/b.jpg' }
    series.value = 'mobile'
    await state.handleDownload()
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith('/a.jpg', 'a.jpg', { signal: expect.any(AbortSignal) })
    finish({ status: 'browser-started' })
    await pending
    expect(mocks.record).toHaveBeenCalledExactlyOnceWith(a, 'desktop')
    expect(mocks.analytics).toHaveBeenCalledExactlyOnceWith(a, 'desktop')
    expect(state.downloading.value).toBe(false)
    expect(mocks.success).toHaveBeenCalledWith('下载已发起')
  })

  it('备用打开链接不产生下载统计、成功提示或下载历史', async () => {
    mocks.download.mockResolvedValue({ status: 'opened-fallback' })
    const state = useWallpaperDownload(ref({ filename: 'a.jpg', url: '/a.jpg' }), ref('desktop'))
    await state.handleDownload()
    expect(mocks.record).not.toHaveBeenCalled()
    expect(mocks.analytics).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.info).toHaveBeenCalledWith('已打开原始链接，请在新页面保存文件')
  })

  it('下载失败不计数，错误结束后可以重试', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.download.mockRejectedValueOnce(new Error('blocked')).mockResolvedValue({ status: 'native-completed' })
    const state = useWallpaperDownload(ref({ filename: 'a.jpg', url: '/a.jpg' }), ref('desktop'))
    await state.handleDownload()
    expect(mocks.record).not.toHaveBeenCalled()
    expect(state.downloading.value).toBe(false)
    await state.handleDownload()
    expect(mocks.record).toHaveBeenCalledOnce()
    expect(mocks.success).toHaveBeenCalledWith('文件已保存至下载目录')
  })
})
