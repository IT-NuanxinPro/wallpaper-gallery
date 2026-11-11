import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useWallpaperDownload } from '../src/composables/useWallpaperDownload.js'

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), enabled: vi.fn(), download: vi.fn(), record: vi.fn(), analytics: vi.fn(),
  info: vi.fn(), success: vi.fn(), error: vi.fn(),
}))
vi.mock('../src/services/downloadProtectionService.js', () => ({ authorizeWallpaperDownload: mocks.authorize, downloadProtectionEnabled: mocks.enabled }))
vi.mock('../src/utils/common/format.js', () => ({
  downloadFile: mocks.download,
  buildWallpaperDownloadFilename: wallpaper => wallpaper.filename,
}))
vi.mock('../src/services/statsService.js', () => ({ recordDownload: mocks.record }))
vi.mock('../src/utils/common/analytics.js', () => ({ trackWallpaperDownload: mocks.analytics }))
vi.mock('element-plus', () => ({ ElMessage: { info: mocks.info, success: mocks.success, error: mocks.error } }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.enabled.mockReturnValue(false)
  mocks.authorize.mockResolvedValue('https://wallpaper.061129.xyz/api/download-file?ticket=test.signature')
  mocks.record.mockResolvedValue({ status: 'accepted' })
})
afterEach(() => vi.restoreAllMocks())

describe('下载操作的资源快照', () => {
  it('下载统计accepted后按原资源通知刷新，skipped不通知', async () => {
    mocks.download.mockResolvedValue({ status: 'browser-started' })
    const onRecorded = vi.fn()
    const state = useWallpaperDownload(ref({ filename: 'a.jpg', path: '/wallpaper/desktop/a.jpg', url: '/a.jpg' }), ref('desktop'), { onRecorded })
    await state.handleDownload()
    await Promise.resolve()
    expect(onRecorded).toHaveBeenCalledExactlyOnceWith('desktop:path:/wallpaper/desktop/a.jpg')
    mocks.record.mockResolvedValue({ status: 'skipped' })
    await state.handleDownload()
    await Promise.resolve()
    expect(onRecorded).toHaveBeenCalledOnce()
  })
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
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith('/a.jpg', 'a.jpg', { signal: expect.any(AbortSignal), onProgress: expect.any(Function) })
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


it('下载保护拒绝时不启动文件下载、直连回退或统计', async () => {
  mocks.enabled.mockReturnValue(true)
  mocks.authorize.mockRejectedValue(new Error('下载较频繁，请等待 60 秒后重试'))
  const state = useWallpaperDownload(ref({filename:'a.jpg',url:'/a.jpg'}),ref('desktop'))
  expect(await state.handleDownload()).toEqual({status:'blocked'})
  expect(mocks.download).not.toHaveBeenCalled()
  expect(mocks.record).not.toHaveBeenCalled()
  expect(mocks.error).toHaveBeenCalledWith('下载较频繁，请等待 60 秒后重试')
  expect(state.downloading.value).toBe(false)
})

it('验证期间取消后即使授权迟到通过也不触发下载', async () => {
  mocks.enabled.mockReturnValue(true)
  let finish
  mocks.authorize.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
  const state=useWallpaperDownload(ref({filename:'a.jpg',url:'/a.jpg'}),ref('desktop'))
  const pending=state.handleDownload()
  state.cancelDownload()
  finish()
  expect(await pending).toEqual({status:'cancelled'})
  expect(mocks.download).not.toHaveBeenCalled()
  expect(mocks.record).not.toHaveBeenCalled()
})


it('通过保护后仅下载服务端签发的入口URL，不把公开原地址交给下载器', async () => {
 mocks.enabled.mockReturnValue(true)
 mocks.download.mockResolvedValue({status:'native-completed'})
 const state=useWallpaperDownload(ref({filename:'a.jpg',url:'https://example.com/raw.jpg'}),ref('desktop'))
 await state.handleDownload()
 expect(mocks.download).toHaveBeenCalledWith('https://wallpaper.061129.xyz/api/download-file?ticket=test.signature','a.jpg',{signal:expect.any(AbortSignal),onProgress:expect.any(Function)})
})


it('下载过程报告真实进度和状态，迟到回调不能污染下一次下载', async () => {
 let report,finish
 mocks.download.mockImplementation((_url,_filename,options)=>{report=options.onProgress;return new Promise(resolve=>{finish=resolve})})
 const state=useWallpaperDownload(ref({filename:'a.jpg',url:'/a.jpg'}),ref('desktop'))
 const first=state.handleDownload()
 expect(state.downloadLabel.value).toBe('连接文件')
 report({phase:'receiving',loaded:512,total:1024})
 expect(state.downloadPercent.value).toBe(50)
 expect(state.downloadLabel.value).toBe('下载 50%')
 report({phase:'receiving',loaded:1048576,total:null})
 expect(state.downloadLabel.value).toBe('已接收 1.0 MB')
 report({phase:'native',loaded:0,total:null})
 expect(state.canCancelDownload.value).toBe(false)
 state.cancelDownload()
 finish({status:'cancelled'})
 await first
 const stale=report
 const second=state.handleDownload()
 stale({phase:'receiving',loaded:999,total:1000})
 expect(state.downloadLabel.value).toBe('连接文件')
 finish({status:'browser-started'})
 await second
 expect(state.downloading.value).toBe(false)
})
