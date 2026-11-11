const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, s-maxage=31536000, immutable'
const UPSTREAM_BASE = 'https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const UPSTREAM_TIMEOUT_MS = 10_000
const MAX_ORIGINAL_BYTES = 32 * 1024 * 1024
const ORIGINAL_TIMEOUT_MS = 30_000
const TAG_PATTERN = /^v\d+\.\d+\.\d+(?:-[a-z\d]+(?:[.-][a-z\d]+)*)?(?:\+[a-z\d]+(?:[.-][a-z\d]+)*)?$/i
const IMAGE_EXTENSION = /\.(?:avif|bmp|gif|ico|jpe?g|png|webp)$/i
const IMAGE_TYPES = new Set(['image/avif', 'image/bmp', 'image/gif', 'image/jpeg', 'image/png', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'])

function safeSegment(segment) {
  // 额外检查嵌套编码，但只解码一次来构造上游路径，保留字面量百分号。
  let candidate = segment
  for (let depth = 0; depth < 8; depth++) {
    if (!candidate || candidate === '.' || candidate === '..' || /[/\\:]/.test(candidate)
      || [...candidate].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
      || /%(?:2f|5c|3a|0[\da-f]|1[\da-f]|7f)/i.test(candidate)) {
      return false
    }
    if (!/%[a-f\d]{2}/i.test(candidate))
      return true
    // 这里只检查 ASCII 分隔符，逐字节展开避免无效 UTF-8 掩盖后续危险编码。
    candidate = candidate.replace(/%([a-f\d]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
  }
  return false
}

function imageLocation(request) {
  const url = new URL(request.url)
  if (url.search || url.hash || !url.pathname.startsWith('/images/') || url.pathname.length > 4096)
    return null
  const segments = url.pathname.slice('/images/'.length).split('/').map(decodeURIComponent)
  const [tag, kind, series, ...file] = segments
  if (!tag || tag.length > 100 || !TAG_PATTERN.test(tag)
    || !['thumbnail', 'preview', 'wallpaper'].includes(kind)
    || !['desktop', 'mobile', 'avatar'].includes(series)
    || !file.length || !IMAGE_EXTENSION.test(file.at(-1)) || !file.every(safeSegment)) {
    return null
  }
  const path = segments.map(encodeURIComponent).join('/')
  return {
    upstream: `${UPSTREAM_BASE}/${path}`,
    cacheKey: new Request(`${url.origin}/images/${path}`),
    original: kind === 'wallpaper',
    maxBytes: kind === 'wallpaper' ? MAX_ORIGINAL_BYTES : MAX_IMAGE_BYTES,
    timeoutMs: kind === 'wallpaper' ? ORIGINAL_TIMEOUT_MS : UPSTREAM_TIMEOUT_MS,
  }
}

function errorResponse(request, status) {
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  }
  if (status === 405)
    headers.Allow = 'GET, HEAD'
  return new Response(request.method === 'HEAD' ? null : 'Image unavailable', { status, headers })
}

function imageType(response) {
  const type = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
  return IMAGE_TYPES.has(type) ? type : null
}

function responseForRequest(request, response, cacheStatus) {
  const headers = new Headers(response.headers)
  headers.set('X-Image-Cache', cacheStatus)
  // 图源均为公开图片，允许独立图片域名上的 anonymous 图像参与 canvas 裁剪。
  headers.set('Access-Control-Allow-Origin', '*')
  const etag = headers.get('ETag')
  const matches = request.headers.get('If-None-Match')?.split(',').some(value =>
    value.trim() === '*' || (etag && value.trim().replace(/^W\//, '') === etag.replace(/^W\//, '')),
  )
  if (matches) {
    void response.body?.cancel().catch(() => {})
    headers.delete('Content-Length')
    return new Response(null, { status: 304, headers })
  }
  if (request.method === 'HEAD') {
    void response.body?.cancel().catch(() => {})
    return new Response(null, { headers })
  }
  return new Response(response.body, { headers })
}

async function readLimitedBody(response, signal, maxBytes) {
  const reader = response.body?.getReader()
  if (!reader)
    throw new Error('Missing image body')
  const chunks = []
  let length = 0
  const abort = () => {
    void reader.cancel().catch(() => {})
  }
  signal.addEventListener('abort', abort, { once: true })
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      signal.throwIfAborted()
      if (done)
        break
      length += value.byteLength
      if (length > maxBytes) {
        void reader.cancel().catch(() => {})
        throw new Error('Image too large')
      }
      chunks.push(value)
    }
    if (!length)
      throw new Error('Empty image body')
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return bytes
  }
  finally {
    signal.removeEventListener('abort', abort)
    reader.releaseLock()
  }
}

async function fetchImage(request, upstreamUrl, fetch, signal, maxBytes) {
  signal.throwIfAborted()
  const upstream = await fetch(upstreamUrl, { method: request.method, redirect: 'manual', signal })
  if (signal.aborted)
    void upstream.body?.cancel().catch(() => {})
  signal.throwIfAborted()
  const contentType = imageType(upstream)
  const declaredLength = upstream.headers.get('Content-Length')
  if (upstream.status !== 200 || !contentType || Number(declaredLength) > maxBytes) {
    void upstream.body?.cancel().catch(() => {})
    return errorResponse(request, upstream.status === 404 ? 404 : 502)
  }
  const headers = new Headers({
    'Content-Type': contentType,
    'Cache-Control': IMAGE_CACHE_CONTROL,
    'X-Content-Type-Options': 'nosniff',
  })
  if (upstream.headers.has('ETag'))
    headers.set('ETag', upstream.headers.get('ETag'))
  if (request.method === 'HEAD') {
    void upstream.body?.cancel().catch(() => {})
    if (declaredLength && /^\d+$/.test(declaredLength))
      headers.set('Content-Length', declaredLength)
    return new Response(null, { headers })
  }
  const body = await readLimitedBody(upstream, signal, maxBytes)
  headers.set('Content-Length', String(body.byteLength))
  return new Response(body, { headers })
}

async function fetchWithDeadline(request, location, fetch) {
  const controller = new AbortController()
  let timeout
  let abortRequest
  const deadline = new Promise((_, reject) => {
    abortRequest = () => {
      controller.abort()
      reject(new Error('Image request cancelled'))
    }
    if (request.signal.aborted)
      abortRequest()
    else
      request.signal.addEventListener('abort', abortRequest, { once: true })
    timeout = setTimeout(() => {
      reject(new Error('Image request timeout'))
      controller.abort()
    }, location.timeoutMs)
  })
  try {
    return await Promise.race([fetchImage(request, location.upstream, fetch, controller.signal, location.maxBytes), deadline])
  }
  catch {
    return errorResponse(request, request.signal.aborted ? 499 : controller.signal.aborted ? 504 : 502)
  }
  finally {
    clearTimeout(timeout)
    request.signal.removeEventListener('abort', abortRequest)
  }
}

/** 原图收到上游头部就返回。完整下载前不承诺缓存成功，也不先把32MiB攒进响应。 */
async function streamOriginal(request, location, fetch, cache, waitUntil) {
  const controller = new AbortController()
  let reader
  let output
  let chunks
  let settled = false
  let timer
  let rejectDeadline
  let finishLifetime
  let abortRequest
  const deadline = new Promise((_, reject) => {
    rejectDeadline = reject
  })
  const lifetime = new Promise((resolve) => {
    finishLifetime = resolve
  })
  const cleanup = () => {
    clearTimeout(timer)
    request.signal.removeEventListener('abort', abortRequest)
  }
  const fail = (error) => {
    if (settled)
      return
    settled = true
    cleanup()
    controller.abort(error)
    if (chunks)
      chunks.length = 0
    if (reader) {
      const currentReader = reader
      void currentReader.cancel(error).catch(() => {}).finally(() => currentReader.releaseLock())
    }
    output?.error(error)
    rejectDeadline(error)
    finishLifetime()
  }
  abortRequest = () => fail(new DOMException('Image request cancelled', 'AbortError'))
  timer = setTimeout(() => fail(new DOMException('Image request timeout', 'TimeoutError')), location.timeoutMs)
  if (request.signal.aborted)
    abortRequest()
  else
    request.signal.addEventListener('abort', abortRequest, { once: true })
  // 防止已取消或未消费响应把后台缓存等待挂起；没有缓存时也不延长函数生命周期。
  if (cache && waitUntil)
    waitUntil(lifetime)
  try {
    const fetchUpstream = async () => {
      controller.signal.throwIfAborted()
      const response = await fetch(location.upstream, { method: request.method, redirect: 'manual', signal: controller.signal })
      if (controller.signal.aborted)
        void response.body?.cancel().catch(() => {})
      controller.signal.throwIfAborted()
      return response
    }
    const upstream = await Promise.race([fetchUpstream(), deadline])
    const contentType = imageType(upstream)
    const lengthValue = upstream.headers.get('Content-Length')
    const declaredLength = !upstream.headers.has('Content-Encoding') && lengthValue && /^\d+$/.test(lengthValue) ? Number(lengthValue) : null
    if (upstream.status !== 200 || !contentType || declaredLength > location.maxBytes || (request.method === 'GET' && !upstream.body)) {
      void upstream.body?.cancel().catch(() => {})
      settled = true
      cleanup()
      finishLifetime()
      return errorResponse(request, upstream.status === 404 ? 404 : 502)
    }
    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': IMAGE_CACHE_CONTROL,
      'X-Content-Type-Options': 'nosniff',
    })
    if (declaredLength !== null)
      headers.set('Content-Length', String(declaredLength))
    if (upstream.headers.has('ETag'))
      headers.set('ETag', upstream.headers.get('ETag'))
    if (request.method === 'HEAD') {
      void upstream.body?.cancel().catch(() => {})
      settled = true
      cleanup()
      finishLifetime()
      return new Response(null, { headers })
    }
    reader = upstream.body.getReader()
    // 仅有缓存时保留受32MiB硬上限约束的块；不使用tee让快缓存分支拖着慢客户端无限预读。
    chunks = cache ? [] : null
    let size = 0
    const body = new ReadableStream({
      start(streamController) { output = streamController },
      async pull(streamController) {
        try {
          controller.signal.throwIfAborted()
          const { done, value } = await reader.read()
          controller.signal.throwIfAborted()
          if (done) {
            if (!size || (declaredLength !== null && size !== declaredLength))
              throw new Error('Incomplete image body')
            settled = true
            cleanup()
            reader.releaseLock()
            streamController.close()
            if (chunks) {
              const cacheHeaders = new Headers(headers)
              cacheHeaders.set('Content-Length', String(size))
              const complete = new Response(new Blob(chunks, { type: contentType }), { headers: cacheHeaders })
              chunks.length = 0
              Promise.resolve().then(() => cache.put(location.cacheKey, complete)).catch(() => {}).finally(finishLifetime)
            }
            else {
              finishLifetime()
            }
            return
          }
          size += value.byteLength
          if (size > location.maxBytes)
            throw new Error('Image too large')
          chunks?.push(value)
          streamController.enqueue(value)
        }
        catch (error) {
          if (chunks)
            chunks.length = 0
          fail(error)
        }
      },
      cancel(reason) {
        if (chunks)
          chunks.length = 0
        // 下游已经取消，不能再对关闭的stream调用error。
        output = null
        fail(reason instanceof Error ? reason : new DOMException('Image stream cancelled', 'AbortError'))
      },
    }, { highWaterMark: 0 })
    return new Response(body, { headers })
  }
  catch {
    settled = true
    cleanup()
    finishLifetime()
    return errorResponse(request, request.signal.aborted ? 499 : controller.signal.aborted ? 504 : 502)
  }
}

export async function handleImageRequest(request, { fetch = globalThis.fetch, cache, waitUntil } = {}) {
  if (!['GET', 'HEAD'].includes(request.method))
    return errorResponse(request, 405)
  let location
  try {
    location = imageLocation(request)
  }
  catch {
    return errorResponse(request, 400)
  }
  if (!location)
    return errorResponse(request, 400)

  try {
    const cached = await cache?.match(location.cacheKey)
    if (cached?.status === 200 && imageType(cached))
      return responseForRequest(request, cached, 'HIT')
  }
  catch {
    // 缓存不可用时仍然请求固定上游，缓存不成为图片可用性的前提。
  }

  if (location.original) {
    const response = await streamOriginal(request, location, fetch, cache, waitUntil)
    return response.status === 200 ? responseForRequest(request, response, 'MISS') : response
  }

  const response = await fetchWithDeadline(request, location, fetch)
  if (response.status !== 200)
    return response
  if (cache && request.method === 'GET') {
    const cacheResponse = response.clone()
    const write = Promise.resolve().then(() => cache.put(location.cacheKey, cacheResponse)).catch(() => {})
    if (waitUntil)
      waitUntil(write)
    else
      await write
  }
  return responseForRequest(request, response, 'MISS')
}
