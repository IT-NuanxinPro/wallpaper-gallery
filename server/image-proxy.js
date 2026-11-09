const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, s-maxage=31536000, immutable'
const UPSTREAM_BASE = 'https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const UPSTREAM_TIMEOUT_MS = 10_000
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
    || !['thumbnail', 'preview'].includes(kind)
    || !['desktop', 'mobile', 'avatar'].includes(series)
    || !file.length || !IMAGE_EXTENSION.test(file.at(-1)) || !file.every(safeSegment)) {
    return null
  }
  const path = segments.map(encodeURIComponent).join('/')
  return { upstream: `${UPSTREAM_BASE}/${path}`, cacheKey: new Request(`${url.origin}/images/${path}`) }
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

async function readLimitedBody(response, signal) {
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
      if (length > MAX_IMAGE_BYTES) {
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

async function fetchImage(request, upstreamUrl, fetch, signal) {
  const upstream = await fetch(upstreamUrl, { method: request.method, redirect: 'manual', signal })
  const contentType = imageType(upstream)
  const declaredLength = upstream.headers.get('Content-Length')
  if (upstream.status !== 200 || !contentType || Number(declaredLength) > MAX_IMAGE_BYTES) {
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
  const body = await readLimitedBody(upstream, signal)
  headers.set('Content-Length', String(body.byteLength))
  return new Response(body, { headers })
}

async function fetchWithDeadline(request, upstream, fetch) {
  const controller = new AbortController()
  let timeout
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error('Image request timeout'))
      controller.abort()
    }, UPSTREAM_TIMEOUT_MS)
  })
  try {
    return await Promise.race([fetchImage(request, upstream, fetch, controller.signal), deadline])
  }
  catch {
    return errorResponse(request, controller.signal.aborted ? 504 : 502)
  }
  finally {
    clearTimeout(timeout)
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

  const response = await fetchWithDeadline(request, location.upstream, fetch)
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
