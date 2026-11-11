import { permitResponse } from '../../server/download-permit.js'
import { decodeWallpaperShareToken } from '../../src/utils/wallpaper/share.js'
import { issueDownloadTicket, verifyDownloadTicket } from './tickets.js'

const ACTION = 'wallpaper_download'

/** 仅由Pages service binding调用；此Worker不开放workers.dev或公网路由。 */
export async function checkDownloadRequest(request, env, { fetchImpl = fetch } = {}) {
  if (request.method !== 'POST')
    return permitResponse(405, 'method_not_allowed')
  if (!env.REQUEST_RATE || !env.FREE_DOWNLOADS || !env.MAX_DOWNLOADS || !env.FILE_DOWNLOADS || !env.TURNSTILE_SECRET_KEY || String(env.DOWNLOAD_SIGNING_SECRET || '').length < 32 || !/^[\w-]{10,100}$/.test(env.TURNSTILE_SITE_KEY || ''))
    return permitResponse(503, 'unavailable')
  let body
  try {
    body = await request.json()
  }
  catch { return permitResponse(400, 'invalid_request') }
  const hosts = String(env.DOWNLOAD_HOSTNAMES || '').split(',').map(value => value.trim()).filter(Boolean)
  if (!/^[\da-f:.]{3,45}$/i.test(body?.ip || '') || !hosts.includes(body.hostname) || typeof body.challengeToken !== 'string' || body.challengeToken.length > 2048)
    return permitResponse(403, 'invalid_request')
  try {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`wallpaper-download:${body.ip}`))
    const key = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
    if (!(await env.REQUEST_RATE.limit({ key })).success)
      return permitResponse(429, 'rate_limited', { retryAfter: 60 })
    if (new URL(request.url).pathname === '/redeem') {
      const ticket = await verifyDownloadTicket(body.ticket, env.DOWNLOAD_SIGNING_SECRET, { ip: key, hostname: body.hostname })
      if (!ticket || !decodeWallpaperShareToken(ticket.resource) || !['GET', 'HEAD'].includes(body.method))
        return permitResponse(403, 'invalid_ticket')
      if (body.method === 'GET' && !(await env.FILE_DOWNLOADS.limit({ key })).success)
        return permitResponse(429, 'rate_limited', { retryAfter: 60 })
      return permitResponse(200, 'allowed', { resource: ticket.resource })
    }
    if (new URL(request.url).pathname !== '/check' || !decodeWallpaperShareToken(body.resource))
      return permitResponse(400, 'invalid_request')
    const free = (await env.FREE_DOWNLOADS.limit({ key })).success
    if (!free) {
      if (!body.challengeToken)
        return permitResponse(403, 'challenge_required', { siteKey: env.TURNSTILE_SITE_KEY })
      const validation = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: body.challengeToken, remoteip: body.ip }),
        signal: AbortSignal.timeout(7000),
      })
      if (!validation.ok)
        return permitResponse(503, 'unavailable')
      const result = await validation.json()
      if (result.success !== true || result.hostname !== body.hostname || result.action !== ACTION)
        return permitResponse(403, 'challenge_required', { siteKey: env.TURNSTILE_SITE_KEY })
    }
    if (!(await env.MAX_DOWNLOADS.limit({ key })).success)
      return permitResponse(429, 'rate_limited', { retryAfter: 60 })
    const ticket = await issueDownloadTicket({ resource: body.resource, hostname: body.hostname, ip: key, expires: Date.now() + 120000 }, env.DOWNLOAD_SIGNING_SECRET)
    return permitResponse(200, 'allowed', { ticket })
  }
  catch { return permitResponse(503, 'unavailable') }
}

export default { fetch: (request, env) => checkDownloadRequest(request, env) }
