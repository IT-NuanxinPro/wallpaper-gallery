export const ONLINE_TTL_SECONDS = 90
export const ONLINE_HEARTBEAT_SECONDS = 30
export const ONLINE_MAX_VISITORS = 20000

const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function onlinePresenceResponse(status, fields) {
  return Response.json(fields, { status, headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
    ...(status === 405 ? { Allow: 'POST' } : {}),
    ...(status === 429 ? { 'Retry-After': '60' } : {}),
  } })
}

/** 限制实际流长度，不能仅相信客户端声明的 Content-Length。 */
export async function readOnlineVisitor(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    throw new Error('content-type')
  const reader = request.body?.getReader()
  if (!reader)
    throw new Error('body')
  const bytes = new Uint8Array(128)
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done)
        break
      if (length + value.length > bytes.length) {
        await reader.cancel()
        throw new Error('size')
      }
      bytes.set(value, length)
      length += value.length
    }
  }
  finally { reader.releaseLock() }
  const body = JSON.parse(new TextDecoder().decode(bytes.subarray(0, length)))
  if (!body || Object.keys(body).length !== 1 || typeof body.visitorId !== 'string' || !VISITOR_ID.test(body.visitorId))
    throw new Error('visitor')
  return body.visitorId.toLowerCase()
}

export function validOnlineResult(body) {
  return Number.isSafeInteger(body?.online) && body.online >= 0 && body.online <= ONLINE_MAX_VISITORS
    && body.ttlSeconds === ONLINE_TTL_SECONDS && body.heartbeatSeconds === ONLINE_HEARTBEAT_SECONDS
}

/** 仅传递本站匿名标识和边缘 IP；Cookie、账户凭证不会进入统计 Worker。 */
export async function handleOnlinePresence(request, env = {}) {
  if (request.method !== 'POST')
    return onlinePresenceResponse(405, { code: 'method_not_allowed' })
  const url = new URL(request.url)
  if (request.headers.get('Origin') !== url.origin)
    return onlinePresenceResponse(403, { code: 'invalid_origin' })
  let visitorId
  try {
    visitorId = await readOnlineVisitor(request)
  }
  catch { return onlinePresenceResponse(400, { code: 'invalid_request' }) }
  const ip = request.headers.get('CF-Connecting-IP')
  if (!ip || !env.ONLINE_PRESENCE?.fetch)
    return onlinePresenceResponse(503, { code: 'unavailable' })
  const controller = new AbortController()
  let timeout
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error('timeout')), 5000)
  })
  try {
    // 同时约束绑定请求和响应体读取；即使底层忽略 abort 也能及时结束。
    const pending = (async () => {
      const response = await env.ONLINE_PRESENCE.fetch(new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': url.origin, 'CF-Connecting-IP': ip },
        body: JSON.stringify({ visitorId }),
        signal: controller.signal,
      }))
      controller.signal.throwIfAborted()
      if (response.status === 429)
        return onlinePresenceResponse(429, { code: 'rate_limited' })
      const result = await response.json()
      controller.signal.throwIfAborted()
      if (!response.ok || !validOnlineResult(result))
        throw new Error('unavailable')
      return onlinePresenceResponse(200, {
        online: result.online,
        ttlSeconds: ONLINE_TTL_SECONDS,
        heartbeatSeconds: ONLINE_HEARTBEAT_SECONDS,
      })
    })()
    return await Promise.race([pending, deadline])
  }
  catch { return onlinePresenceResponse(503, { code: 'unavailable' }) }
  finally {
    clearTimeout(timeout)
    controller.abort()
  }
}
