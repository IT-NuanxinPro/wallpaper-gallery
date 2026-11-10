import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadFile } from '../src/utils/common/format.js'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', { open: vi.fn() })
  vi.stubGlobal('navigator', { language: 'zh-CN' })
  vi.stubGlobal('document', {
    createElement: vi.fn(() => ({ click: vi.fn() })),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
  })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('下载底层结果', () => {
  it.each([
    ['desktop/a.svg', 'image/svg+xml'],
    ['desktop/a.tiff', 'image/tiff'],
    ['video/a.mp4', 'video/mp4'],
  ])('非网关媒体 %s 在CDN失败后仍通过同版本Raw保存', async (path, type) => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('offline', { status: 503 }))
      .mockResolvedValueOnce(new Response('media', { headers: { 'Content-Type': type } }))
    vi.stubGlobal('fetch', fetch)
    await expect(downloadFile(`https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.63/wallpaper/${path}`, 'media')).resolves.toEqual({ status: 'browser-started' })
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.63/wallpaper/${path}`,
      `https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v1.2.63/wallpaper/${path}`,
    ])
    expect(window.open).not.toHaveBeenCalled()
  })

  it('调用方取消不打开备用窗口，也不发起下载', async () => {
    const controller = new AbortController()
    controller.abort()
    vi.stubGlobal('fetch', vi.fn())
    await expect(downloadFile('https://example.com/a.jpg', 'a.jpg', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(window.open).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('原图网关失败后使用同版本CDN，保存成功保留browser-started结果', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('offline', { status: 502 }))
      .mockResolvedValueOnce(new Response('original', { headers: { 'Content-Type': 'image/png' } }))
    vi.stubGlobal('fetch', fetch)
    await expect(downloadFile('https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.63/wallpaper/desktop/a.png', 'a.png')).resolves.toEqual({ status: 'browser-started' })
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/images/v1.2.63/wallpaper/desktop/a.png',
      'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.63/wallpaper/desktop/a.png',
    ])
  })

  it('浏览器点击保存后返回已发起，延迟回收blob地址', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['image']) }))
    await expect(downloadFile('https://example.com/a.jpg', 'a.jpg')).resolves.toEqual({ status: 'browser-started' })
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })

  it('原生桥确认完成后返回原生完成', async () => {
    window.__TAURI__ = { core: { invoke: vi.fn().mockResolvedValue('/Downloads/a.jpg') } }
    await expect(downloadFile('https://example.com/a.jpg', 'a.jpg')).resolves.toEqual({ status: 'native-completed' })
  })

  it('HTTP成功但响应为空或HTML/JSON/文本错误页时只允许备用打开，不发起blob下载', async () => {
    for (const [content, type] of [['', 'image/png'], ['<html>error</html>', 'text/html'], ['{}', 'application/json'], ['error', 'text/plain']]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob([content], { type }) }))
      window.open.mockReturnValueOnce({})
      await expect(downloadFile('https://example.com/a.jpg', 'a.jpg')).resolves.toEqual({ status: 'opened-fallback' })
    }
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('原图允许SVG、其他图片、视频、二进制流和未声明MIME类型', async () => {
    for (const type of ['image/svg+xml', 'image/webp', 'video/mp4', 'application/octet-stream', '']) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['media'], { type }) }))
      await expect(downloadFile('https://example.com/media', 'media')).resolves.toEqual({ status: 'browser-started' })
    }
    expect(window.open).not.toHaveBeenCalled()
  })

  it('下载失败但打开链接成功仅返回fallback，弹窗被拦截则抛出失败', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    window.open.mockReturnValueOnce({}).mockReturnValueOnce(null)
    await expect(downloadFile('https://example.com/a.jpg', 'a.jpg')).resolves.toEqual({ status: 'opened-fallback' })
    await expect(downloadFile('https://example.com/a.jpg', 'a.jpg')).rejects.toThrow('offline')
  })
})
