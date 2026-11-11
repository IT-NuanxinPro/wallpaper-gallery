import { isValidWallpaperDetailRecord } from '../src/utils/wallpaper/detailRecords.js'
import { getWallpaperDetailBucketPath } from '../src/utils/wallpaper/share.js'
import { permitResponse } from './download-permit.js'

const MAX_BYTES = 256 * 1024 * 1024

/** 受控下载只接受短时票据，原文件地址从自己的详情桶解析。 */
export async function handleDownloadFile(request, env, { fetchImpl = fetch } = {}) {
  if (!['GET', 'HEAD'].includes(request.method))
    return permitResponse(405, 'method_not_allowed')
  const url = new URL(request.url)
  const ticket = url.searchParams.get('ticket')
  if (!ticket || ticket.length > 9000 || !/^[\w-]+\.[\w-]+$/.test(ticket))
    return permitResponse(403, 'invalid_ticket')
  if (!env.DOWNLOAD_GUARD?.fetch || !env.ASSETS?.fetch)
    return permitResponse(503, 'unavailable')
  try {
    const authorization = await env.DOWNLOAD_GUARD.fetch(new Request('https://download-guard.internal/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, ip: request.headers.get('CF-Connecting-IP'), hostname: url.hostname, challengeToken: '', method: request.method }),
      signal: AbortSignal.timeout(10000),
    }))
    if (authorization.status >= 500)
      return permitResponse(503, 'unavailable')
    if (!authorization.ok)
      return permitResponse(authorization.status === 429 ? 429 : 403, authorization.status === 429 ? 'rate_limited' : 'invalid_ticket')
    const { resource } = await authorization.json()
    const bucketPath = getWallpaperDetailBucketPath(resource)
    if (!bucketPath)
      return permitResponse(403, 'invalid_ticket')
    const response = await env.ASSETS.fetch(new Request(new URL(bucketPath, url.origin)))
    if (!response.ok)
      return permitResponse(503, 'unavailable')
    const bucket = await response.json()
    const record = bucket?.schema === 1 ? bucket.items?.[resource] : null
    if (!record || !isValidWallpaperDetailRecord(record, resource))
      return permitResponse(404, 'file_not_found')
    // 只从已校验的本站元数据取URL，不接受用户传入url；也不跟随上游重定向。
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(120000)])
    const upstream = await fetchImpl(record.downloadUrl, { method: request.method, redirect: 'manual', signal })
    const type = upstream.headers.get('Content-Type')?.split(';')[0].toLowerCase() || ''
    if (upstream.status !== 200 || (!type.startsWith('image/') && !type.startsWith('video/') && type !== 'application/octet-stream') || type === 'image/svg+xml' || Number(upstream.headers.get('Content-Length')) > MAX_BYTES) {
      void upstream.body?.cancel()
      return permitResponse(502, 'upstream_unavailable')
    }
    const filename = record.filename || 'wallpaper'
    const headers = new Headers({
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="wallpaper"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16)}`)}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
      'Referrer-Policy': 'no-referrer',
    })
    if (upstream.headers.has('Content-Length'))
      headers.set('Content-Length', upstream.headers.get('Content-Length'))
    if (request.method === 'HEAD') {
      void upstream.body?.cancel()
      return new Response(null, { headers })
    }
    if (!upstream.body)
      return permitResponse(502, 'upstream_unavailable')
    let size = 0
    const limited = new TransformStream({ transform(chunk, controller) {
      signal.throwIfAborted()
      size += chunk.byteLength
      if (size > MAX_BYTES)
        throw new Error('File exceeds download limit')
      controller.enqueue(chunk)
    } })
    return new Response(upstream.body.pipeThrough(limited, { signal }), { headers })
  }
  catch { return permitResponse(503, 'unavailable') }
}
