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
