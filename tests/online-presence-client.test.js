import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOnlinePresence } from '../src/composables/useOnlinePresence'

const idA = 'f56f8262-992a-4d4e-82d3-a0c477e13850'
const idB = '18c57866-4a41-46d7-ae70-79982486a17f'
const success = online => ({ ok: true, json: async () => ({ online, ttlSeconds: 90, heartbeatSeconds: 30 }) })
let store, win, doc, nav, fetchImpl, trackers
function surface(extra = {}) {
  const handlers = new Map()
  return { ...extra, handlers, addEventListener: (name, handler) => handlers.set(name, handler), removeEventListener: name => handlers.delete(name), emit(name) { handlers.get(name)?.() } }
}
function tracker(options = {}) {
  const result = createOnlinePresence({
    fetchImpl, getWindow: () => win, getDocument: () => doc, getNavigator: () => nav,
    getStorage: () => ({ getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) }),
    createId: () => idA, ...options,
  })
  trackers.push(result)
  return result
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  store = new Map()
  win = surface()
  doc = surface({ visibilityState: 'visible' })
  nav = { onLine: true }
  fetchImpl = vi.fn(async () => success(7))
  trackers = []
})
afterEach(() => {
  for (const item of trackers) item.release()
  vi.useRealTimers()
})

describe('全站在线心跳', () => {
  it('延后首个请求，每30秒发送匿名标识，复用生命周期不增加定时器', async () => {
    const state = tracker()
    state.retain()
    state.retain()
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(state.count.value).toBeNull()
    await vi.advanceTimersByTimeAsync(1500)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(state.count.value).toBe(7)
    const [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/online-presence')
    expect(options).toMatchObject({ method: 'POST', cache: 'no-store', credentials: 'omit', headers: { 'Content-Type': 'application/json' } })
    expect(JSON.parse(options.body)).toEqual({ visitorId: idA })
    await vi.advanceTimersByTimeAsync(30000)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    state.release()
    await vi.advanceTimersByTimeAsync(30000)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    state.release()
    expect(state.count.value).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    expect(win.handlers.size + doc.handlers.size).toBe(0)
  })
  it('同一浏览器多个标签复用同一标识，不同浏览器生成独立标识', async () => {
    const first = tracker(), second = tracker({ createId: () => idB })
    first.retain()
    second.retain()
    await vi.advanceTimersByTimeAsync(1500)
    expect(fetchImpl.mock.calls.map(([, options]) => JSON.parse(options.body).visitorId)).toEqual([idA, idA])
    const otherStore = new Map()
    const third = tracker({ createId: () => idB, getStorage: () => ({ getItem: key => otherStore.get(key), setItem: (key, value) => otherStore.set(key, value) }) })
    third.retain()
    await vi.advanceTimersByTimeAsync(1500)
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body).visitorId).toBe(idB)
  })
  it('正常切换窗口焦点不会提前或推迟30秒心跳', async () => {
    const state = tracker()
    state.retain()
    await vi.advanceTimersByTimeAsync(1500)
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(5000)
      win.emit('focus')
      await vi.advanceTimersByTimeAsync(0)
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
  it('隐藏页面停止心跳并清除旧数字，恢复前台立即更新', async () => {
    const state = tracker()
    state.retain()
    await vi.advanceTimersByTimeAsync(1500)
    doc.visibilityState = 'hidden'
    doc.emit('visibilitychange')
    expect(state.count.value).toBeNull()
    await vi.advanceTimersByTimeAsync(95000)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    doc.visibilityState = 'visible'
    doc.emit('visibilitychange')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(state.count.value).toBe(7)
  })
  it('初始后台或离线不请求；联网恢复、bfcache恢复可以重新开始', async () => {
    doc.visibilityState = 'hidden'
    const state = tracker()
    state.retain()
    await vi.advanceTimersByTimeAsync(60000)
    expect(fetchImpl).not.toHaveBeenCalled()
    doc.visibilityState = 'visible'
    nav.onLine = false
    doc.emit('visibilitychange')
    await vi.advanceTimersByTimeAsync(60000)
    expect(fetchImpl).not.toHaveBeenCalled()
    nav.onLine = true
    win.emit('online')
    await vi.advanceTimersByTimeAsync(0)
    expect(state.count.value).toBe(7)
    win.emit('pagehide')
    await vi.advanceTimersByTimeAsync(95000)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    win.emit('pageshow')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
  it('晚到的响应不能覆盖恢复后的新数字', async () => {
    let finish
    fetchImpl.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const state = tracker()
    state.retain()
    await vi.advanceTimersByTimeAsync(1500)
    doc.visibilityState = 'hidden'
    doc.emit('visibilitychange')
    expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(6000)
    doc.visibilityState = 'visible'
    doc.emit('visibilitychange')
    await vi.advanceTimersByTimeAsync(0)
    expect(state.count.value).toBe(7)
    finish(success(999))
    await vi.advanceTimersByTimeAsync(0)
    expect(state.count.value).toBe(7)
  })
  it('网络失败隐藏人数，退避重试，频繁切换焦点不能绕过退避', async () => {
    fetchImpl.mockResolvedValue({ ok: false, status: 503, headers: new Headers() })
    const state = tracker()
    state.retain()
    await vi.advanceTimersByTimeAsync(1500)
    expect(state.count.value).toBeNull()
    for (let i = 0; i < 5; i++) win.emit('focus')
    await vi.advanceTimersByTimeAsync(29999)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    fetchImpl.mockResolvedValue(success(0))
    await vi.advanceTimersByTimeAsync(59999)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(state.count.value).toBe(0)
  })
  it('遵循限流重试时间，超时覆盖读取响应体且释放定时器', async () => {
    fetchImpl.mockResolvedValueOnce({ ok: false, status: 429, headers: new Headers({ 'Retry-After': '120' }) })
    const state = tracker()
    state.retain()
    await vi.advanceTimersByTimeAsync(1500)
    await vi.advanceTimersByTimeAsync(119999)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    fetchImpl.mockResolvedValue({ ok: true, json: () => new Promise(() => {}) })
    await vi.advanceTimersByTimeAsync(1)
    await vi.advanceTimersByTimeAsync(8000)
    expect(fetchImpl.mock.calls[1][1].signal.aborted).toBe(true)
    expect(state.count.value).toBeNull()
    state.release()
    expect(vi.getTimerCount()).toBe(0)
  })
  it.each([-1, 1.5, '20', NaN, Infinity, null])('拒绝无效人数%s，不伪造0', async value => {
    fetchImpl.mockResolvedValue(success(value))
    const state = tracker()
    state.retain()
    await vi.advanceTimersByTimeAsync(1500)
    expect(state.count.value).toBeNull()
  })
  it('存储被禁用时不发送无法跨标签去重的标识', async () => {
    const state = tracker({ getStorage() { throw new Error('SecurityError') } })
    state.retain()
    await vi.advanceTimersByTimeAsync(1500)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(state.count.value).toBeNull()
  })
  it('匿名标识24小时未用后更新，活动标签持续共用', async () => {
    const first = tracker()
    first.retain()
    await vi.advanceTimersByTimeAsync(1500)
    first.release()
    await vi.advanceTimersByTimeAsync(86400000)
    const second = tracker({ createId: () => idB })
    second.retain()
    await vi.advanceTimersByTimeAsync(1500)
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).visitorId).toBe(idB)
  })
})
