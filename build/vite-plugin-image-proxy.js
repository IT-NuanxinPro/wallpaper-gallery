import { Buffer } from 'node:buffer'
import { handleImageRequest } from '../server/image-proxy.js'

export function createImageMemoryCache({ maxEntries = 128, maxBytes = 32 * 1024 * 1024 } = {}) {
  const entries = new Map()
  let totalBytes = 0
  return {
    async match(request) {
      const entry = entries.get(request.url)
      if (!entry)
        return undefined
      entries.delete(request.url)
      entries.set(request.url, entry)
      return new Response(entry.body.slice(0), { status: entry.status, headers: entry.headers })
    },
    async put(request, response) {
      const body = await response.arrayBuffer()
      if (body.byteLength > maxBytes || maxEntries < 1)
        return
      const existing = entries.get(request.url)
      if (existing) {
        totalBytes -= existing.body.byteLength
        entries.delete(request.url)
      }
      while (entries.size && (entries.size >= maxEntries || totalBytes + body.byteLength > maxBytes)) {
        const oldest = entries.keys().next().value
        totalBytes -= entries.get(oldest).body.byteLength
        entries.delete(oldest)
      }
      entries.set(request.url, { body, status: response.status, headers: [...response.headers] })
      totalBytes += body.byteLength
    },
  }
}

export function viteImageProxyPlugin({ fetch = globalThis.fetch } = {}) {
  const cache = createImageMemoryCache()
  const configure = (server) => {
    server.middlewares.use(async (req, res, next) => {
      if (req.url !== '/images' && !req.url?.startsWith('/images/'))
        return next()
      try {
        const headers = new Headers()
        for (const [name, value] of Object.entries(req.headers)) {
          if (value != null)
            headers.set(name, Array.isArray(value) ? value.join(', ') : value)
        }
        // 使用固定本地源，避免把不受信任的 Host 头变成上游目标或缓存键。
        const request = new Request(new URL(req.url, 'http://image-proxy.local'), { method: req.method, headers })
        const response = await handleImageRequest(request, { fetch, cache })
        res.statusCode = response.status
        response.headers.forEach((value, name) => res.setHeader(name, value))
        res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined)
      }
      catch {
        res.statusCode = 502
        res.setHeader('Cache-Control', 'no-store')
        res.end(req.method === 'HEAD' ? undefined : 'Image unavailable')
      }
    })
  }
  return {
    name: 'wallpaper-image-proxy',
    configureServer: configure,
    configurePreviewServer: configure,
  }
}
