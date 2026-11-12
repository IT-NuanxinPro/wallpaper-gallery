import {
  ONLINE_HEARTBEAT_SECONDS,
  ONLINE_MAX_VISITORS,
  ONLINE_TTL_SECONDS,
  onlinePresenceResponse,
  readOnlineVisitor,
} from '../../server/online-presence.js'

const TTL_MS = ONLINE_TTL_SECONDS * 1000

async function digest(value) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** 无公网路由，仅接受 Pages 的私有 service binding 请求。 */
export async function handlePresenceHeartbeat(request, env) {
  if (request.method !== 'POST')
    return onlinePresenceResponse(405, { code: 'method_not_allowed' })
  const url = new URL(request.url)
  const hosts = String(env.ONLINE_HOSTNAMES || '').split(',').map(host => host.trim()).filter(Boolean)
  if (url.pathname !== '/api/online-presence' || !hosts.includes(url.hostname) || request.headers.get('Origin') !== url.origin)
    return onlinePresenceResponse(403, { code: 'invalid_origin' })
  if (!env.HEARTBEAT_RATE?.limit || !env.ONLINE_VISITORS?.idFromName || !env.ONLINE_VISITORS?.get)
    return onlinePresenceResponse(503, { code: 'unavailable' })
  const ip = request.headers.get('CF-Connecting-IP')
  if (!/^[\da-f:.]{3,45}$/i.test(ip || ''))
    return onlinePresenceResponse(503, { code: 'unavailable' })
  let visitorId
  try {
    visitorId = await readOnlineVisitor(request)
  }
  catch { return onlinePresenceResponse(400, { code: 'invalid_request' }) }
  try {
    const key = await digest(`wallpaper-presence-ip:${ip}`)
    if (!(await env.HEARTBEAT_RATE.limit({ key })).success)
      return onlinePresenceResponse(429, { code: 'rate_limited' })
    const visitor = await digest(`wallpaper-presence-visitor:${visitorId}`)
    const object = env.ONLINE_VISITORS.get(env.ONLINE_VISITORS.idFromName('wallpaper-online-v1'))
    // DO 只接收匿名摘要，不接收 IP、原始浏览器标识或客户端时间。
    return await object.fetch(new Request('https://online-visitors.internal/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitor }),
    }))
  }
  catch { return onlinePresenceResponse(503, { code: 'unavailable' }) }
}

export class OnlineVisitors {
  constructor(ctx) {
    this.ctx = ctx
    this.sql = ctx.storage.sql
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS visitors (visitor TEXT PRIMARY KEY, last_seen INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS visitors_expiry ON visitors(last_seen);
      CREATE TABLE IF NOT EXISTS presence_count (id INTEGER PRIMARY KEY CHECK(id = 1), total INTEGER NOT NULL CHECK(total >= 0));
      INSERT OR IGNORE INTO presence_count (id, total) VALUES (1, 0);
    `)
  }

  prune(now) {
    const expired = this.sql.exec('DELETE FROM visitors WHERE last_seen <= ? RETURNING visitor', now - TTL_MS).toArray().length
    if (expired)
      this.sql.exec('UPDATE presence_count SET total = total - ? WHERE id = 1', expired)
    return this.sql.exec('SELECT total FROM presence_count WHERE id = 1').one().total
  }

  async fetch(request) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/heartbeat')
      return onlinePresenceResponse(405, { code: 'method_not_allowed' })
    let body
    try {
      body = await request.json()
    }
    catch { return onlinePresenceResponse(400, { code: 'invalid_request' }) }
    if (!/^[a-f0-9]{64}$/.test(body?.visitor || '') || Object.keys(body).length !== 1)
      return onlinePresenceResponse(400, { code: 'invalid_request' })
    const now = Date.now()
    let online
    this.ctx.storage.transactionSync(() => {
      online = this.prune(now)
      const existing = this.sql.exec('SELECT last_seen FROM visitors WHERE visitor = ?', body.visitor).toArray()[0]
      if (!existing && online >= ONLINE_MAX_VISITORS)
        return
      if (!existing) {
        this.sql.exec('INSERT INTO visitors (visitor, last_seen) VALUES (?, ?)', body.visitor, now)
        this.sql.exec('UPDATE presence_count SET total = total + 1 WHERE id = 1')
        online++
      }
      // 同一浏览器多个标签同时刷新时，短时间重复心跳无需重复写索引。
      else if (now - existing.last_seen >= 5000) {
        this.sql.exec('UPDATE visitors SET last_seen = ? WHERE visitor = ?', now, body.visitor)
      }
      else if (now < existing.last_seen) {
        this.sql.exec('UPDATE visitors SET last_seen = ? WHERE visitor = ?', now, body.visitor)
      }
    })
    if (!this.sql.exec('SELECT visitor FROM visitors WHERE visitor = ?', body.visitor).toArray().length)
      return onlinePresenceResponse(503, { code: 'capacity_reached' })
    if (await this.ctx.storage.getAlarm() === null)
      await this.ctx.storage.setAlarm(now + TTL_MS)
    return onlinePresenceResponse(200, { online, ttlSeconds: ONLINE_TTL_SECONDS, heartbeatSeconds: ONLINE_HEARTBEAT_SECONDS })
  }

  async alarm() {
    const now = Date.now()
    this.ctx.storage.transactionSync(() => this.prune(now))
    const next = this.sql.exec('SELECT MIN(last_seen) AS oldest FROM visitors').one().oldest
    if (next !== null)
      await this.ctx.storage.setAlarm(Math.max(now + 1, next + TTL_MS))
  }
}

export default { fetch: (request, env) => handlePresenceHeartbeat(request, env) }
