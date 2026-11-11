import { createServer } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createImageMemoryCache, viteImageProxyPlugin } from '../build/vite-plugin-image-proxy.js'
import { handleImageRequest } from '../server/image-proxy.js'

const imagePath = '/images/v1.2.63/thumbnail/desktop/动漫/01_%23wallpaper%20美图.webp'
const upstreamUrl = 'https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v1.2.63/thumbnail/desktop/%E5%8A%A8%E6%BC%AB/01_%23wallpaper%20%E7%BE%8E%E5%9B%BE.webp'

function request(path = imagePath, options) {
  return new Request(`https://wallpaper.example${path}`, options)
}

function imageResponse(body = 'image-bytes', headers = {}) {
  return new Response(body, {
    headers: { 'Content-Type': 'image/webp', ETag: '"image-v1"', ...headers },
  })
}

function memoryCache() {
  const entries = new Map()
  return {
    match: vi.fn(async key => entries.get(key.url)?.clone()),
    put: vi.fn(async (key, value) => entries.set(key.url, value.clone())),
  }
}

afterEach(() => vi.useRealTimers())

describe('图片入口', () => {
  it('原图仅使用同仓库版本路径，允许超过预览上限但限制32MiB', async () => {
    const original = new Uint8Array(6 * 1024 * 1024)
    const fetch = vi.fn(async () => imageResponse(original, { 'Content-Length': String(original.byteLength) }))
    const response = await handleImageRequest(request('/images/v1.2.63/wallpaper/desktop/a.png'), { fetch })
    expect(response.status).toBe(200)
    expect((await response.arrayBuffer()).byteLength).toBe(original.byteLength)
    expect(fetch.mock.calls[0][0]).toBe('https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v1.2.63/wallpaper/desktop/a.png')
    const oversized = await handleImageRequest(request('/images/v1.2.63/wallpaper/mobile/a.png'), {
      fetch: async () => imageResponse('small', { 'Content-Length': String(32 * 1024 * 1024 + 1) }),
    })
    expect(oversized.status).toBe(502)
  })

  it('原图响应体超过32MiB时取消流，不写缓存', async () => {
    const cancel = vi.fn()
    const cache = memoryCache()
    const response = await handleImageRequest(request('/images/v1.2.63/wallpaper/avatar/a.png'), {
      cache,
      fetch: async () => imageResponse(new ReadableStream({
        pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)) }, cancel,
      })),
    })
    expect(response.status).toBe(200)
    await expect(response.arrayBuffer()).rejects.toThrow('Image too large')
    expect(cancel).toHaveBeenCalledOnce()
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('原图响应头立即返回，30秒总超时仍能中断后续停滞流', async () => {
    vi.useFakeTimers()
    const cancel = vi.fn()
    const response = await handleImageRequest(request('/images/v1.2.63/wallpaper/desktop/a.png'), {
      fetch: async () => imageResponse(new ReadableStream({ cancel })),
    })
    expect(response.status).toBe(200)
    const pending = response.arrayBuffer()
    const outcome = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(10_001)
    expect(cancel).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(20_000)
    await outcome
    expect(cancel).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('客户端取消原图请求时立即取消响应流且不缓存', async () => {
    const controller = new AbortController()
    const cancel = vi.fn()
    const cache = memoryCache()
    const response = await handleImageRequest(request('/images/v1.2.63/wallpaper/desktop/a.png', { signal: controller.signal }), {
      fetch: async () => imageResponse(new ReadableStream({ cancel })), cache,
    })
    const pending = response.arrayBuffer()
    const outcome = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await outcome
    expect(cancel).toHaveBeenCalledOnce()
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('原图首块先交给客户端，尾块未到达前不写缓存', async () => {
    const cache = memoryCache()
    const writes = []
    let upstream
    const response = await handleImageRequest(request('/images/v1.2.63/wallpaper/desktop/a.png'), {
      fetch: async () => imageResponse(new ReadableStream({ start(controller) { upstream = controller } }), { 'Content-Length': '11' }),
      cache, waitUntil: pending => writes.push(pending),
    })
    expect(response.status).toBe(200)
    const reader = response.body.getReader()
    upstream.enqueue(new TextEncoder().encode('first'))
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('first')
    expect(cache.put).not.toHaveBeenCalled()
    upstream.enqueue(new TextEncoder().encode('-final'))
    upstream.close()
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('-final')
    expect((await reader.read()).done).toBe(true)
    await Promise.all(writes)
    expect(cache.put).toHaveBeenCalledOnce()
    expect(await (await cache.match(request('/images/v1.2.63/wallpaper/desktop/a.png'))).text()).toBe('first-final')
  })

  it.each(['truncated', 'error', 'cancel'])('原图%s不会把已发送的前半段写入缓存', async (failure) => {
    const cache = memoryCache()
    const writes = []
    let upstream
    const cancel = vi.fn()
    const response = await handleImageRequest(request('/images/v1.2.63/wallpaper/desktop/a.png'), {
      fetch: async () => imageResponse(new ReadableStream({ start(controller) { upstream = controller }, cancel }), { 'Content-Length': '11' }),
      cache, waitUntil: pending => writes.push(pending),
    })
    const reader = response.body.getReader()
    upstream.enqueue(new TextEncoder().encode('first'))
    await reader.read()
    if (failure === 'cancel') {
      await reader.cancel()
      expect(cancel).toHaveBeenCalledOnce()
    }
    else {
      if (failure === 'truncated') upstream.close()
      else upstream.error(new Error('upstream broken'))
      await expect(reader.read()).rejects.toThrow()
    }
    await Promise.all(writes)
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('原图等待响应头超过30秒时仍返回504，迟到响应会取消', async () => {
    vi.useFakeTimers()
    let finish
    const cancel = vi.fn()
    const pending = handleImageRequest(request('/images/v1.2.63/wallpaper/desktop/a.png'), {
      fetch: () => new Promise(resolve => { finish = resolve }),
    })
    await vi.advanceTimersByTimeAsync(30_001)
    expect((await pending).status).toBe(504)
    finish(imageResponse(new ReadableStream({ cancel })))
    await vi.advanceTimersByTimeAsync(0)
    expect(cancel).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('原图不会为了后台缓存主动拉取整个文件，压缩上游不透传错误实体长度', async () => {
    let pulls = 0
    const cancel = vi.fn()
    const response = await handleImageRequest(request('/images/v1.2.63/wallpaper/desktop/a.png'), {
      cache: memoryCache(),
      fetch: async () => imageResponse(new ReadableStream({
        pull(controller) { pulls++; controller.enqueue(new Uint8Array(1024)) }, cancel,
      }, { highWaterMark: 0 }), { 'Content-Encoding': 'gzip', 'Content-Length': '1' }),
    })
    expect(pulls).toBe(0)
    expect(response.headers.has('Content-Length')).toBe(false)
    const reader = response.body.getReader()
    expect((await reader.read()).value.byteLength).toBe(1024)
    expect(pulls).toBe(1)
    await reader.cancel()
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('返回固定 Raw 上游图片实体，并保留编码文件名及安全响应头', async () => {
    const fetch = vi.fn(async () => imageResponse('image-bytes', {
      'Set-Cookie': 'secret=not-forwarded',
      Location: 'https://elsewhere.example/image.webp',
    }))
    const response = await handleImageRequest(request(), { fetch })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('image-bytes')
    expect(response.headers.get('Content-Type')).toBe('image/webp')
    expect(response.headers.get('ETag')).toBe('"image-v1"')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Cache-Control')).toContain('public')
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(response.headers.get('Location')).toBeNull()
    expect(fetch).toHaveBeenCalledWith(upstreamUrl, expect.objectContaining({
      method: 'GET',
      redirect: 'manual',
      signal: expect.any(AbortSignal),
    }))
  })

  it.each([
    '/images/main/thumbnail/desktop/a.webp',
    '/images/v1.2.63/wallpaper/video/a.webp',
    '/images/v1.2.63/thumbnail/video/a.webp',
    '/images/v1.2.63/thumbnail/desktop/a.svg',
    '/images/v1.2.63/thumbnail/desktop/a.html',
    '/images/v1.2.63/thumbnail/desktop/a.webp?url=https://evil.example/a.webp',
    '/images/v1.2.63/thumbnail/desktop/a%2Fb.webp',
    '/images/v1.2.63/thumbnail/desktop/a%5Cb.webp',
    '/images/v1.2.63/thumbnail/desktop/%252e%252e/a.webp',
    '/images/v1.2.63/thumbnail/desktop/a%252fb.webp',
    '/images/v1.2.63/thumbnail/desktop/100%25_%252fb.webp',
    '/images/v1.2.63/thumbnail/desktop/%25FF%25252fb.webp',
    '/images/v1.2.63/thumbnail/desktop/%00a.webp',
    '/images/v1.2.63/thumbnail/desktop/%ZZ.webp',
    '/images/v1.2.63/thumbnail/desktop/https://evil.example/a.webp',
    '/images/v1.2.63/thumbnail/desktop/../../../secrets.webp',
    '/images/v1.2.63/thumbnail/desktop//a.webp',
    '/another/v1.2.63/thumbnail/desktop/a.webp',
  ])('拒绝非法路径并且不访问上游：%s', async (path) => {
    const fetch = vi.fn(async () => imageResponse())
    const response = await handleImageRequest(request(path), { fetch })
    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('允许预发布tag与已编码文件名，不重复编码百分号', async () => {
    const fetch = vi.fn(async () => imageResponse())
    const response = await handleImageRequest(request('/images/v2.3.4-rc.1/preview/mobile/100%25_%2523%20%E5%9B%BE.webp'), { fetch })
    expect(response.status).toBe(200)
    expect(fetch.mock.calls[0][0]).toBe('https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v2.3.4-rc.1/preview/mobile/100%25_%2523%20%E5%9B%BE.webp')
  })

  it('仅接受GET和HEAD', async () => {
    const fetch = vi.fn(async () => imageResponse())
    const response = await handleImageRequest(request(imagePath, { method: 'POST' }), { fetch })
    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('GET, HEAD')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('成功GET写入缓存，后续GET与HEAD复用同一份图片', async () => {
    const cache = memoryCache()
    const writes = []
    const fetch = vi.fn(async () => imageResponse())
    const options = { fetch, cache, waitUntil: promise => writes.push(promise) }
    const first = await handleImageRequest(request(), options)
    await Promise.all(writes)
    const second = await handleImageRequest(request(), options)
    const head = await handleImageRequest(request(imagePath, { method: 'HEAD' }), options)
    expect(await first.text()).toBe('image-bytes')
    expect(await second.text()).toBe('image-bytes')
    expect(head.status).toBe(200)
    expect(head.body).toBeNull()
    expect(head.headers.get('Content-Length')).toBe('11')
    expect(second.headers.get('X-Image-Cache')).toBe('HIT')
    expect(head.headers.get('X-Image-Cache')).toBe('HIT')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(cache.put).toHaveBeenCalledTimes(1)
  })

  it('缓存命中支持If-None-Match且304不携带实体', async () => {
    const cache = memoryCache()
    const fetch = vi.fn(async () => imageResponse())
    await handleImageRequest(request(), { fetch, cache })
    const response = await handleImageRequest(request(imagePath, { headers: { 'If-None-Match': 'W/"image-v1"' } }), { fetch, cache })
    expect(response.status).toBe(304)
    expect(response.body).toBeNull()
    expect(response.headers.get('ETag')).toBe('"image-v1"')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('公开图片允许独立域名的匿名跨域裁剪，缓存和304沿用CORS且不允许凭据', async () => {
    const cache = memoryCache()
    const options = { cache, fetch: async () => imageResponse() }
    const headers = { Origin: 'https://gallery.example' }
    const first = await handleImageRequest(request(imagePath, { headers }), options)
    const cached = await handleImageRequest(request(imagePath, { headers }), options)
    const head = await handleImageRequest(request(imagePath, { method: 'HEAD', headers }), options)
    const unchanged = await handleImageRequest(request(imagePath, {
      headers: { ...headers, 'If-None-Match': '"image-v1"' },
    }), options)

    expect(first.status).toBe(200)
    expect(cached.headers.get('X-Image-Cache')).toBe('HIT')
    expect(head.body).toBeNull()
    expect(unchanged.status).toBe(304)
    for (const response of [first, cached, head, unchanged]) {
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.has('Access-Control-Allow-Credentials')).toBe(false)
    }
  })

  it('无缓存HEAD只请求上游HEAD，返回头部且不写入GET缓存', async () => {
    const cache = memoryCache()
    const fetch = vi.fn(async () => imageResponse(null, { 'Content-Length': '1234' }))
    const response = await handleImageRequest(request(imagePath, { method: 'HEAD' }), { fetch, cache })
    expect(response.status).toBe(200)
    expect(response.body).toBeNull()
    expect(response.headers.get('Content-Length')).toBe('1234')
    expect(fetch.mock.calls[0][1].method).toBe('HEAD')
    expect(cache.put).not.toHaveBeenCalled()
  })

  it.each(['match', 'put'])('缓存%s失败不会使有效图片请求失败', async (method) => {
    const cache = memoryCache()
    cache[method] = vi.fn(async () => { throw new Error('cache unavailable') })
    const response = await handleImageRequest(request(), { fetch: async () => imageResponse(), cache })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('image-bytes')
  })

  it.each([
    { status: 404, headers: { 'Content-Type': 'image/webp' }, expected: 404 },
    { status: 500, headers: { 'Content-Type': 'image/webp' }, expected: 502 },
    { status: 301, headers: { Location: 'https://evil.example/image.webp' }, expected: 502 },
    { status: 200, headers: { 'Content-Type': 'text/html' }, expected: 502 },
    { status: 200, headers: { 'Content-Type': 'image/svg+xml' }, expected: 502 },
  ])('上游$status与$headers失败不缓存也不透传错误正文', async ({ status, headers, expected }) => {
    const cache = memoryCache()
    const response = await handleImageRequest(request(), {
      cache,
      fetch: async () => new Response('upstream-secret', { status, headers }),
    })
    expect(response.status).toBe(expected)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Location')).toBeNull()
    expect(await response.text()).not.toContain('upstream-secret')
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('不会把访客Cookie、Authorization或Range传给上游', async () => {
    const fetch = vi.fn(async () => imageResponse())
    const response = await handleImageRequest(request(imagePath, {
      headers: { Cookie: 'private=yes', Authorization: 'Bearer secret', Range: 'bytes=0-1' },
    }), { fetch })
    expect(response.status).toBe(200)
    const headers = new Headers(fetch.mock.calls[0][1].headers)
    expect(headers.has('Cookie')).toBe(false)
    expect(headers.has('Authorization')).toBe(false)
    expect(headers.has('Range')).toBe(false)
  })

  it('Content-Length超过5MiB时拒绝下载且不缓存', async () => {
    const cache = memoryCache()
    const response = await handleImageRequest(request(), {
      cache,
      fetch: async () => imageResponse('small', { 'Content-Length': String(5 * 1024 * 1024 + 1) }),
    })
    expect(response.status).toBe(502)
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('无Content-Length的流超过5MiB时取消流且不缓存', async () => {
    const cache = memoryCache()
    const cancel = vi.fn()
    const response = await handleImageRequest(request(), {
      cache,
      fetch: async () => imageResponse(new ReadableStream({
        pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)) },
        cancel,
      })),
    })
    expect(response.status).toBe(502)
    expect(cancel).toHaveBeenCalledOnce()
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('上游连接超过10秒时中止请求，错误响应不缓存', async () => {
    vi.useFakeTimers()
    const cache = memoryCache()
    const fetch = vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))
    const pending = handleImageRequest(request(), { fetch, cache })
    await vi.advanceTimersByTimeAsync(10_001)
    const response = await pending
    expect(response.status).toBe(504)
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('头部已返回但图片流停滞时，10秒总超时仍生效', async () => {
    vi.useFakeTimers()
    const cancel = vi.fn()
    const pending = handleImageRequest(request(), {
      fetch: async () => imageResponse(new ReadableStream({ cancel })),
    })
    await vi.advanceTimersByTimeAsync(10_001)
    const response = await pending
    expect(response.status).toBe(504)
    expect(cancel).toHaveBeenCalledOnce()
  })
})

describe('本地图片入口', () => {
  it.each(['configureServer', 'configurePreviewServer'])('%s使用真实HTTP返回图片并复用缓存，其他路径透传', async (hook) => {
    let middleware
    const fetch = vi.fn(async () => imageResponse())
    const plugin = viteImageProxyPlugin({ fetch })
    plugin[hook]({ middlewares: { use(handler) { middleware = handler } } })
    expect(typeof middleware).toBe('function')
    const server = createServer((req, res) => middleware(req, res, () => {
      res.statusCode = 404
      res.end('fallback')
    }))
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const base = `http://127.0.0.1:${server.address().port}`
      const first = await globalThis.fetch(`${base}${imagePath}`)
      const second = await globalThis.fetch(`${base}${imagePath}`, { method: 'HEAD' })
      const other = await globalThis.fetch(`${base}/data/desktop/latest.json`)
      expect(first.status).toBe(200)
      expect(await first.text()).toBe('image-bytes')
      expect(second.status).toBe(200)
      expect(second.headers.get('X-Image-Cache')).toBe('HIT')
      expect(await second.text()).toBe('')
      expect(other.status).toBe(404)
      expect(await other.text()).toBe('fallback')
      expect(fetch).toHaveBeenCalledTimes(1)
    }
    finally {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    }
  })

  it('本地HTTP在上游尾块结束前收到原图首字节，客户端断连会取消上游', async () => {
    let middleware
    let upstream
    const cancel = vi.fn()
    const plugin = viteImageProxyPlugin({ fetch: async () => imageResponse(new ReadableStream({
      start(controller) { upstream = controller }, cancel,
    })) })
    plugin.configureServer({ middlewares: { use(handler) { middleware = handler } } })
    const server = createServer((req, res) => middleware(req, res, () => res.end('fallback')))
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const base = `http://127.0.0.1:${server.address().port}`
      const response = await globalThis.fetch(`${base}/images/v1.2.63/wallpaper/desktop/a.png`)
      expect(response.status).toBe(200)
      upstream.enqueue(new TextEncoder().encode('first'))
      const reader = response.body.getReader()
      expect(new TextDecoder().decode((await reader.read()).value)).toBe('first')
      await reader.cancel()
      await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce())
    }
    finally {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    }
  })

  it('本地原图完整传输后才复用缓存，不等待后台缓存阻塞首块', async () => {
    let middleware
    let upstream
    const fetch = vi.fn(async () => imageResponse(new ReadableStream({ start(controller) { upstream = controller } })))
    const plugin = viteImageProxyPlugin({ fetch })
    plugin.configureServer({ middlewares: { use(handler) { middleware = handler } } })
    const server = createServer((req, res) => middleware(req, res, () => res.end('fallback')))
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const url = `http://127.0.0.1:${server.address().port}/images/v1.2.63/wallpaper/desktop/a.png`
      const response = await globalThis.fetch(url)
      const reader = response.body.getReader()
      upstream.enqueue(new TextEncoder().encode('first'))
      expect(new TextDecoder().decode((await reader.read()).value)).toBe('first')
      upstream.enqueue(new TextEncoder().encode('-final'))
      upstream.close()
      expect(new TextDecoder().decode((await reader.read()).value)).toBe('-final')
      expect((await reader.read()).done).toBe(true)
      const cached = await globalThis.fetch(url)
      expect(cached.headers.get('X-Image-Cache')).toBe('HIT')
      expect(await cached.text()).toBe('first-final')
      expect(fetch).toHaveBeenCalledOnce()
    }
    finally {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    }
  })

  it('本地缓存限制条目数量，优先淘汰最近未使用的图片', async () => {
    const cache = createImageMemoryCache({ maxEntries: 2, maxBytes: 100 })
    const a = request('/images/v1.0.0/thumbnail/avatar/a.webp')
    const b = request('/images/v1.0.0/thumbnail/avatar/b.webp')
    const c = request('/images/v1.0.0/thumbnail/avatar/c.webp')
    await cache.put(a, imageResponse('a'))
    await cache.put(b, imageResponse('b'))
    expect(await (await cache.match(a)).text()).toBe('a')
    await cache.put(c, imageResponse('c'))
    expect(await cache.match(b)).toBeUndefined()
    expect(await (await cache.match(a)).text()).toBe('a')
    expect(await (await cache.match(c)).text()).toBe('c')
  })

  it('本地缓存同时限制总字节数并跳过超出容量的单图', async () => {
    const cache = createImageMemoryCache({ maxEntries: 10, maxBytes: 5 })
    const a = request('/images/v1.0.0/thumbnail/avatar/a.webp')
    const b = request('/images/v1.0.0/thumbnail/avatar/b.webp')
    const c = request('/images/v1.0.0/thumbnail/avatar/c.webp')
    await cache.put(a, imageResponse('123'))
    await cache.put(b, imageResponse('456'))
    await cache.put(c, imageResponse('123456'))
    expect(await cache.match(a)).toBeUndefined()
    expect(await (await cache.match(b)).text()).toBe('456')
    expect(await cache.match(c)).toBeUndefined()
  })
})
