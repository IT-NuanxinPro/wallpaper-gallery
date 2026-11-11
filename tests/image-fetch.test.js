import { afterEach, describe, expect, it, vi } from 'vitest'
import * as delivery from '../src/utils/wallpaper/imageDelivery.js'

const cdn = 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.63/wallpaper/desktop/a.png'
const gateway = '/images/v1.2.63/wallpaper/desktop/a.png'
const raw = 'https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v1.2.63/wallpaper/desktop/a.png'
const load = async (...args) => (await import('../src/utils/wallpaper/imageFetch.js')).fetchWallpaperImage(...args)

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('原图来源与完整响应体加载', () => {
  it('非光栅与视频仓库路径允许直连回退但不进入光栅网关', () => {
    const direct = 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.63/wallpaper/video/a.mp4'
    const fallback = 'https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v1.2.63/wallpaper/video/a.mp4'
    expect(delivery.buildImageFetchUrls(direct)).toEqual([direct, fallback])
    expect(delivery.buildImageFetchUrls(fallback)).toEqual([fallback, direct])
    for (const url of [direct.replace('/a.mp4', '/a%252fb.mp4'), direct.replace('/a.mp4', '/%252e%252e/a.mp4'), direct.replace('IT-NuanxinPro', 'other'), `${direct}?url=https://evil.example`])
      expect(delivery.buildImageFetchUrls(url)).toEqual([url])
  })

  it('可信仓库原图依次使用自有入口、同版本CDN和Raw，其他来源不变', () => {
    expect(delivery.buildImageFetchUrls(cdn)).toEqual([gateway, cdn, raw])
    expect(delivery.buildImageFetchUrls(raw)).toEqual([gateway, raw, cdn])
    for (const url of ['https://evil.example/a.png', `${cdn}?url=https://evil.example/a.png`, cdn.replace('/a.png', '/a%252fb.png'), cdn.replace('v1.2.63', 'main')])
      expect(delivery.buildImageFetchUrls(url)).toEqual([url])
  })

  it('显式关闭入口后仍保留同版本的直连回退', () => {
    vi.stubEnv('VITE_IMAGE_PROXY_ENABLED', 'false')
    expect(delivery.buildImageFetchUrls(cdn)).toEqual([cdn, raw])
  })

  it('入口失败或返回错误页时使用下一来源，最终返回图片Blob', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('offline', { status: 503 }))
      .mockResolvedValueOnce(new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } }))
      .mockResolvedValueOnce(new Response('image', { headers: { 'Content-Type': 'image/png' } }))
    vi.stubGlobal('fetch', fetch)
    const blob = await load(cdn)
    expect(blob.type).toBe('image/png')
    expect(await blob.text()).toBe('image')
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([gateway, cdn, raw])
  })

  it('头部已返回但响应体卡住时仍超时，取消流且不继续回退', async () => {
    vi.useFakeTimers()
    const cancel = vi.fn()
    const fetch = vi.fn(async () => new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'image/png' } }))
    vi.stubGlobal('fetch', fetch)
    const pending = load(cdn, { timeoutMs: 25 })
    const assertion = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(30)
    await assertion
    expect(cancel).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('等待连接时可由调用方取消，取消不触发其他来源', async () => {
    const controller = new AbortController()
    const fetch = vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))
    vi.stubGlobal('fetch', fetch)
    const pending = load(cdn, { signal: controller.signal })
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    controller.abort()
    await assertion
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('读取响应体时取消会释放流', async () => {
    const controller = new AbortController()
    const cancel = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'image/png' } })))
    const pending = load('https://cn.bing.com/a.jpg', { signal: controller.signal })
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    controller.abort()
    await assertion
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('调用方已取消但不配合的fetch稍后返回时也释放响应体', async () => {
    let finish
    const controller = new AbortController()
    const cancel = vi.fn()
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve })))
    const pending = load('https://cn.bing.com/a.jpg', { signal: controller.signal })
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    controller.abort()
    await assertion
    finish(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'image/png' } }))
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce())
  })

  it.each(['text/html', 'application/json', 'video/mp4', 'application/octet-stream'])('裁剪加载器拒绝非图片 %s', async (type) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not image', { headers: { 'Content-Type': type } })))
    await expect(load('https://cn.bing.com/a.jpg')).rejects.toThrow('图片')
  })

  it('声明超过上限时不读取正文', async () => {
    const cancel = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'image/png', 'Content-Length': '11' } })))
    await expect(load('https://cn.bing.com/a.jpg', { maxBytes: 10 })).rejects.toThrow('大小')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('未声明大小的流超过上限时立即取消，空图片也拒绝', async () => {
    const cancel = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(6)) }, cancel,
    }), { headers: { 'Content-Type': 'image/png' } })))
    await expect(load('https://cn.bing.com/a.jpg', { maxBytes: 10 })).rejects.toThrow('大小')
    expect(cancel).toHaveBeenCalledOnce()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { headers: { 'Content-Type': 'image/png' } })))
    await expect(load('https://cn.bing.com/a.jpg')).rejects.toThrow('空')
  })
})


it('已知长度按收到的字节报告进度，不用虚假计时百分比', async () => {
 let stream
 const onProgress=vi.fn()
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(new ReadableStream({start(c){stream=c}}),{headers:{'Content-Type':'image/png','Content-Length':'8'}})))
 const pending=load('https://example.com/image.png',{onProgress})
 await vi.waitFor(()=>expect(onProgress).toHaveBeenCalledWith({phase:'receiving',loaded:0,total:8}))
 stream.enqueue(new Uint8Array(3))
 await vi.waitFor(()=>expect(onProgress).toHaveBeenCalledWith({phase:'receiving',loaded:3,total:8}))
 stream.enqueue(new Uint8Array(5));stream.close()
 expect((await pending).size).toBe(8)
 expect(onProgress.mock.calls.at(-1)[0]).toEqual({phase:'receiving',loaded:8,total:8})
})

it('多来源首条响应头卡住时提前取消并切换，而不是耗尽整体30秒', async () => {
 vi.useFakeTimers()
 let firstSignal
 const fetch=vi.fn().mockImplementationOnce((_url,{signal})=>{firstSignal=signal;return new Promise(()=>{})}).mockResolvedValueOnce(new Response('ok',{headers:{'Content-Type':'image/png'}}))
 vi.stubGlobal('fetch',fetch)
 const progress=vi.fn()
 const pending=load(cdn,{sourceTimeoutMs:6000,onProgress:progress})
 await vi.advanceTimersByTimeAsync(6001)
 expect(firstSignal.aborted).toBe(true)
 expect(await (await pending).text()).toBe('ok')
 expect(fetch.mock.calls.map(c=>c[0])).toEqual([gateway,cdn])
 expect(progress).toHaveBeenCalledWith({phase:'switching',loaded:0,total:null})
 expect(vi.getTimerCount()).toBe(0)
})

it('受保护单入口不派生公开源，取消首条等待立即清理计时器', async () => {
 vi.useFakeTimers()
 const controller=new AbortController()
 vi.stubGlobal('fetch',vi.fn(()=>new Promise(()=>{})))
 const pending=load('https://wallpaper.061129.xyz/api/download-file?ticket=test.signature',{sourceTimeoutMs:6000,signal:controller.signal})
 const assertion=expect(pending).rejects.toMatchObject({name:'AbortError'})
 await vi.advanceTimersByTimeAsync(0)
 controller.abort()
 await assertion
 expect(fetch).toHaveBeenCalledOnce()
 expect(vi.getTimerCount()).toBe(0)
})
