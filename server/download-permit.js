import { decodeWallpaperShareToken } from '../src/utils/wallpaper/share.js'

export function permitResponse(status, code, fields = {}) {
  return Response.json({ code, ...fields }, { status, headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
    ...(status === 429 ? { 'Retry-After': '60' } : {}),
  } })
}

async function readBody(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json'))
    throw new Error('content-type')
  const reader = request.body?.getReader()
  if (!reader)
    throw new Error('body')
  const chunks = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done)
        break
      length += value.length
      if (length > 8192) {
        await reader.cancel()
        throw new Error('size')
      }
      chunks.push(value)
    }
  }
  finally { reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}

/** Pages入口只转发边缘提供的IP；不信任客户端自报用户/IP或任意下载URL。 */
export async function handleDownloadPermit(request, env = {}) {
  if (request.method !== 'POST')
    return permitResponse(405, 'method_not_allowed')
  const url = new URL(request.url)
  if (request.headers.get('Origin') !== url.origin)
    return permitResponse(403, 'invalid_origin')
  let body
  try {
    body = await readBody(request)
  }
  catch { return permitResponse(400, 'invalid_request') }
  if (!decodeWallpaperShareToken(body?.resource) || (body.challengeToken !== undefined && (typeof body.challengeToken !== 'string' || body.challengeToken.length > 2048)))
    return permitResponse(400, 'invalid_request')
  const ip = request.headers.get('CF-Connecting-IP')
  if (!ip || !env.DOWNLOAD_GUARD?.fetch)
    return permitResponse(503, 'unavailable')
  try {
    const response = await env.DOWNLOAD_GUARD.fetch(new Request('https://download-guard.internal/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, hostname: url.hostname, resource: body.resource, challengeToken: body.challengeToken || '' }),
      signal: AbortSignal.timeout(10000),
    }))
    const result = await response.json()
    if (response.status === 200 && result.code === 'allowed' && /^[\w-]+\.[\w-]+$/.test(result.ticket || '') && result.ticket.length <= 9000)
      return permitResponse(200, 'allowed', { downloadUrl: `/api/download-file?ticket=${result.ticket}` })
    if (response.status === 403 && result.code === 'challenge_required' && /^[\w-]{10,100}$/.test(result.siteKey || ''))
      return permitResponse(403, 'challenge_required', { siteKey: result.siteKey })
    if (response.status === 429)
      return permitResponse(429, 'rate_limited', { retryAfter: 60 })
    return permitResponse(503, 'unavailable')
  }
  catch { return permitResponse(503, 'unavailable') }
}
