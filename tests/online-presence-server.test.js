import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleOnlinePresence, ONLINE_MAX_VISITORS } from '../server/online-presence.js'
import { handlePresenceHeartbeat, OnlineVisitors } from '../workers/online-presence/index.js'

const origin = 'https://wallpaper.061129.xyz'
const visitorId = '7f2663fc-d361-43e3-b8a9-c934673fc821'
const result = { online: 3, ttlSeconds: 90, heartbeatSeconds: 30 }
const post = (body = { visitorId }, headers = {}) => new Request(`${origin}/api/online-presence`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': origin, 'CF-Connecting-IP': '203.0.113.5', ...headers },
  body: JSON.stringify(body),
})
const internal = visitor => new Request('https://online-visitors.internal/heartbeat', {
  method: 'POST', body: JSON.stringify({ visitor }),
})
const visitorHash = char => char.repeat(64)
const openDatabases = []

// 使用真正 SQLite 执行 SQL 和事务，避免内存 Map 测试掩盖存储查询错误。
function storageHarness() {
  const database = new DatabaseSync(':memory:')
  openDatabases.push(database)
  let alarm = null
  const sql = { exec(query, ...bindings) {
    let rows = []
    if (query.trim().startsWith('CREATE TABLE')) {
      database.exec(query)
    }
    else {
      const statement = database.prepare(query)
      if (statement.columns().length)
        rows = statement.all(...bindings)
      else
        statement.run(...bindings)
    }
    return { toArray: () => rows, one: () => { if (rows.length !== 1) throw Error('Expected one row'); return rows[0] } }
  } }
  return { storage: {
    sql,
    getAlarm: vi.fn(async () => alarm),
    setAlarm: vi.fn(async time => { alarm = time }),
    consumeAlarm: () => { alarm = null },
    transactionSync(fn) {
      database.exec('BEGIN')
      try { const value = fn(); database.exec('COMMIT'); return value }
      catch (error) { database.exec('ROLLBACK'); throw error }
    },
  } }
}

function environment(object = { fetch: vi.fn(async () => Response.json(result)) }) {
  return {
    ONLINE_HOSTNAMES: 'wallpaper.061129.xyz',
    HEARTBEAT_RATE: { limit: vi.fn(async () => ({ success: true })) },
    ONLINE_VISITORS: { idFromName: vi.fn(name => name), get: vi.fn(() => object) },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  for (const database of openDatabases.splice(0)) database.close()
})

describe('在线人数 Pages 入口', () => {
  it('只转发规范匿名标识和边缘 IP，不转发账户、Cookie 或客户端声明的时间', async () => {
    const service = { fetch: vi.fn(async request => {
      expect(await request.json()).toEqual({ visitorId })
      expect(request.headers.get('CF-Connecting-IP')).toBe('203.0.113.5')
      expect(request.headers.get('Cookie')).toBeNull()
      expect(request.headers.get('Authorization')).toBeNull()
      expect(request.headers.get('X-Forwarded-For')).toBeNull()
      return Response.json({ ...result, private: 'strip-me' })
    }) }
    const response = await handleOnlinePresence(post({ visitorId: visitorId.toUpperCase() }, { Cookie: 'private=value', Authorization: 'Bearer private', 'X-Forwarded-For': 'spoof' }), { ONLINE_PRESENCE: service })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(result)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex')
  })

  it.each([
    { visitorId: 'not-an-id' },
    { visitorId: visitorId.replace('-4', '-1') },
    { visitorId, now: 100 },
    { visitorId, ip: 'spoof' },
    { visitorId: 'a'.repeat(200) },
    null,
  ])('拒绝不符合契约的请求 %j', async body => {
    const service = { fetch: vi.fn() }
    const response = await handleOnlinePresence(post(body), { ONLINE_PRESENCE: service })
    expect(response.status).toBe(400)
    expect(service.fetch).not.toHaveBeenCalled()
  })

  it('拒绝跨站、无 Origin、GET、错误内容类型及缺失边缘 IP', async () => {
    expect((await handleOnlinePresence(post(undefined, { Origin: 'https://elsewhere.example' }))).status).toBe(403)
    const missingOrigin = post(); missingOrigin.headers.delete('Origin')
    expect((await handleOnlinePresence(missingOrigin)).status).toBe(403)
    expect((await handleOnlinePresence(new Request(`${origin}/api/online-presence`))).status).toBe(405)
    expect((await handleOnlinePresence(post(undefined, { 'Content-Type': 'text/plain' }))).status).toBe(400)
    const missingIp = post(); missingIp.headers.delete('CF-Connecting-IP')
    expect((await handleOnlinePresence(missingIp, { ONLINE_PRESENCE: { fetch: vi.fn() } })).status).toBe(503)
    expect((await handleOnlinePresence(post())).status).toBe(503)
  })

  it('真正按请求流限制 128 字节，不相信伪造的 Content-Length', async () => {
    const response = await handleOnlinePresence(post({ visitorId: 'a'.repeat(200) }, { 'Content-Length': '1' }))
    expect(response.status).toBe(400)
  })

  it.each([
    { ...result, online: -1 }, { ...result, online: 1.5 },
    { ...result, online: '3' }, { ...result, online: ONLINE_MAX_VISITORS + 1 },
    { ...result, heartbeatSeconds: 1 }, { ...result, ttlSeconds: 300 },
  ])('服务异常或无效数据不伪造零人数 %j', async body => {
    const response = await handleOnlinePresence(post(), { ONLINE_PRESENCE: { fetch: async () => Response.json(body) } })
    expect(response.status).toBe(503)
    expect(await response.json()).not.toHaveProperty('online')
  })

  it('保留有效的零人数，限流响应带 Retry-After，网络错误返回 503', async () => {
    const zero = await handleOnlinePresence(post(), { ONLINE_PRESENCE: { fetch: async () => Response.json({ ...result, online: 0 }) } })
    expect(await zero.json()).toMatchObject({ online: 0 })
    const limited = await handleOnlinePresence(post(), { ONLINE_PRESENCE: { fetch: async () => new Response(null, { status: 429 }) } })
    expect(limited.status).toBe(429)
    expect(limited.headers.get('Retry-After')).toBe('60')
    expect((await handleOnlinePresence(post(), { ONLINE_PRESENCE: { fetch: async () => { throw Error('network') } } })).status).toBe(503)
  })

  it('绑定 fetch 忽略 abort 时仍在 5 秒返回 503，清理计时器并丢弃迟到响应', async () => {
    vi.useFakeTimers()
    let resolveFetch, requestSignal
    const fetchPromise = new Promise(resolve => { resolveFetch = resolve })
    const service = { fetch: vi.fn(request => { requestSignal = request.signal; return fetchPromise }) }
    let finished = false
    const pending = handleOnlinePresence(post(), { ONLINE_PRESENCE: service }).then(response => { finished = true; return response })
    await vi.advanceTimersByTimeAsync(0)
    expect(service.fetch).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(4999)
    expect(finished).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const response = await pending
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ code: 'unavailable' })
    expect(requestSignal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    const late = { ok: true, status: 200, json: vi.fn(async () => ({ ...result, online: 99 })) }
    resolveFetch(late)
    await vi.advanceTimersByTimeAsync(0)
    expect(late.json).not.toHaveBeenCalled()
    const next = await handleOnlinePresence(post(), { ONLINE_PRESENCE: { fetch: async () => Response.json(result) } })
    expect(await next.json()).toEqual(result)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('收到响应头后 JSON 读取卡住也受同一 5 秒期限约束，迟到数据不影响后续请求', async () => {
    vi.useFakeTimers()
    let resolveJson, requestSignal
    const jsonPromise = new Promise(resolve => { resolveJson = resolve })
    const stalled = { ok: true, status: 200, json: vi.fn(() => jsonPromise) }
    const pending = handleOnlinePresence(post(), { ONLINE_PRESENCE: { fetch: async request => { requestSignal = request.signal; return stalled } } })
    await vi.advanceTimersByTimeAsync(0)
    expect(stalled.json).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(5000)
    const response = await pending
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ code: 'unavailable' })
    expect(requestSignal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    resolveJson({ ...result, online: 99 })
    await vi.advanceTimersByTimeAsync(0)
    const next = await handleOnlinePresence(post(), { ONLINE_PRESENCE: { fetch: async () => Response.json(result) } })
    expect(await next.json()).toEqual(result)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('在线人数私有 Worker', () => {
  it('任意访客都进入同一个 DO，并且只传入不可逆的标识摘要', async () => {
    const object = { fetch: vi.fn(async request => {
      const body = await request.json()
      expect(Object.keys(body)).toEqual(['visitor'])
      expect(body.visitor).toMatch(/^[a-f0-9]{64}$/)
      expect(request.headers.get('CF-Connecting-IP')).toBeNull()
      return Response.json(result)
    }) }
    const env = environment(object)
    expect((await handlePresenceHeartbeat(post(), env)).status).toBe(200)
    expect(env.ONLINE_VISITORS.idFromName).toHaveBeenCalledWith('wallpaper-online-v1')
    expect(env.HEARTBEAT_RATE.limit.mock.calls[0][0].key).toMatch(/^[a-f0-9]{64}$/)
    expect(env.HEARTBEAT_RATE.limit.mock.calls[0][0].key).not.toContain('203.0.113.5')
  })

  it('限流和配置失败时不调用 DO，也不使用任意转发 IP 兜底', async () => {
    const env = environment()
    env.HEARTBEAT_RATE.limit.mockResolvedValue({ success: false })
    expect((await handlePresenceHeartbeat(post(), env)).status).toBe(429)
    expect(env.ONLINE_VISITORS.get).not.toHaveBeenCalled()
    expect((await handlePresenceHeartbeat(post(), { ...env, HEARTBEAT_RATE: null })).status).toBe(503)
    const noIp = post(undefined, { 'X-Forwarded-For': '203.0.113.5' }); noIp.headers.delete('CF-Connecting-IP')
    expect((await handlePresenceHeartbeat(noIp, env)).status).toBe(503)
  })

  it('仅允许已配置站点的同源心跳及正确路径', async () => {
    const env = environment()
    expect((await handlePresenceHeartbeat(post(undefined, { Origin: 'https://evil.example' }), env)).status).toBe(403)
    expect((await handlePresenceHeartbeat(post(), { ...env, ONLINE_HOSTNAMES: 'other.example' })).status).toBe(403)
    expect((await handlePresenceHeartbeat(new Request(`${origin}/wrong`, post()), env)).status).toBe(403)
    expect((await handlePresenceHeartbeat(post({ visitorId, time: 123 }), env)).status).toBe(400)
    expect(env.ONLINE_VISITORS.get).not.toHaveBeenCalled()
  })
})

describe('SQLite Durable Object 在线集合', () => {
  it('相同浏览器多标签并发只计一人，不同浏览器各计一人', async () => {
    const context = storageHarness()
    const object = new OnlineVisitors(context)
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const responses = await Promise.all(Array.from({ length: 12 }, () => object.fetch(internal(visitorHash('a')))))
    expect(await Promise.all(responses.map(response => response.json()))).toEqual(Array.from({ length: 12 }, () => ({ online: 1, ttlSeconds: 90, heartbeatSeconds: 30 })))
    expect(await (await object.fetch(internal(visitorHash('b')))).json()).toMatchObject({ online: 2 })
    expect(context.storage.sql.exec('SELECT * FROM visitors').toArray()).toHaveLength(2)
  })

  it('基于服务端时间续期，90 秒后准确过期，并发新访客不会丢计数', async () => {
    const context = storageHarness(), object = new OnlineVisitors(context)
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    await object.fetch(internal(visitorHash('a')))
    now.mockReturnValue(1_030_000)
    await object.fetch(internal(visitorHash('a')))
    now.mockReturnValue(1_119_999)
    expect(await (await object.fetch(internal(visitorHash('b')))).json()).toMatchObject({ online: 2 })
    now.mockReturnValue(1_120_000)
    expect(await (await object.fetch(internal(visitorHash('c')))).json()).toMatchObject({ online: 2 })
    expect(context.storage.sql.exec('SELECT visitor FROM visitors WHERE visitor = ?', visitorHash('a')).toArray()).toHaveLength(0)
  })

  it('实例重启仍从同一 SQLite 保持人数，报警器在没有后续请求时清理过期行', async () => {
    const context = storageHarness()
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    await new OnlineVisitors(context).fetch(internal(visitorHash('a')))
    const restarted = new OnlineVisitors(context)
    expect(await (await restarted.fetch(internal(visitorHash('b')))).json()).toMatchObject({ online: 2 })
    expect(context.storage.setAlarm).toHaveBeenCalledWith(1_090_000)
    now.mockReturnValue(1_090_000); context.storage.consumeAlarm()
    await restarted.alarm()
    expect(context.storage.sql.exec('SELECT * FROM visitors').toArray()).toHaveLength(0)
    expect(context.storage.sql.exec('SELECT total FROM presence_count').one().total).toBe(0)
  })

  it('报警清理旧访客后，为仍活跃的访客安排下一次到期清理', async () => {
    const context = storageHarness(), object = new OnlineVisitors(context)
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    await object.fetch(internal(visitorHash('a')))
    now.mockReturnValue(1_030_000)
    await object.fetch(internal(visitorHash('b')))
    now.mockReturnValue(1_090_000); context.storage.consumeAlarm()
    await object.alarm()
    expect(context.storage.sql.exec('SELECT total FROM presence_count').one().total).toBe(1)
    expect(context.storage.setAlarm).toHaveBeenLastCalledWith(1_120_000)
  })

  it('达到容量不虚构人数或继续写入，新会话过期后可重新进入', async () => {
    const context = storageHarness(), object = new OnlineVisitors(context)
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    context.storage.sql.exec('WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM numbers WHERE n < ?) INSERT INTO visitors (visitor, last_seen) SELECT printf(\'%064x\', n), ? FROM numbers', ONLINE_MAX_VISITORS, 1_000_000)
    context.storage.sql.exec('UPDATE presence_count SET total = ? WHERE id = 1', ONLINE_MAX_VISITORS)
    expect((await object.fetch(internal(visitorHash('a')))).status).toBe(503)
    expect(context.storage.sql.exec('SELECT * FROM visitors').toArray()).toHaveLength(ONLINE_MAX_VISITORS)
    now.mockReturnValue(1_100_000)
    expect(await (await object.fetch(internal(visitorHash('a')))).json()).toMatchObject({ online: 1 })
  })

  it('DO 不接受原始浏览器 ID、客户端时间或任意额外字段', async () => {
    const object = new OnlineVisitors(storageHarness())
    expect((await object.fetch(internal(visitorId))).status).toBe(400)
    const spoofed = new Request('https://online-visitors.internal/heartbeat', { method: 'POST', body: JSON.stringify({ visitor: visitorHash('a'), now: Number.MAX_SAFE_INTEGER }) })
    expect((await object.fetch(spoofed)).status).toBe(400)
  })
})
