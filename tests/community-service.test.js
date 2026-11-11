import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCommunityService } from '../src/services/communityService.js'
import { createLatestCommunityRequest, publicProfileName } from '../src/utils/community/profile.js'

afterEach(() => vi.useRealTimers())

describe('公开社区服务', () => {
  it('只使用受限RPC并限制分页，保留真实空结果', async () => {
    const calls = []
    const service = createCommunityService({ getClient: () => ({ rpc(name, args) { calls.push({ name, args }); return Promise.resolve({ data: { items: [], has_more: false }, error: null }) } }) })
    expect(await service.getMyCollections({ limit: 999, offset: -5 })).toEqual({ items: [], has_more: false })
    expect(calls).toEqual([{ name: 'get_my_collection_visibility', args: { p_limit: 48, p_offset: 0 } }])
  })

  it('服务未部署、错误响应不会伪装为0或泄露后端文本', async () => {
    const unavailable = createCommunityService({ getClient: () => null })
    await expect(unavailable.getMyCollections()).rejects.toThrow('暂不可用')
    const service = createCommunityService({ getClient: () => ({ rpc: () => Promise.resolve({ data: null, error: { message: 'private@email.test', code: 'PGRST202' } }) }) })
    await expect(service.getMyCollections()).rejects.toThrow('暂不可用')
    await expect(service.getMyCollections()).rejects.not.toThrow('private@email.test')
  })

  it('关注传递明确目标状态，取消关注可重复调用；非法身份不发请求', async () => {
    const calls = []
    const service = createCommunityService({ getClient: () => ({ rpc(name, args) { calls.push({ name, args }); return Promise.resolve({ data: { following: args.p_following }, error: null }) } }) })
    const id = '11111111-1111-4111-8111-111111111111'
    const actor = '22222222-2222-4222-8222-222222222222'
    await expect(service.setFollowing(id, false, actor)).resolves.toEqual({ following: false })
    await expect(service.setFollowing(id, false, actor)).resolves.toEqual({ following: false })
    await expect(service.setFollowing('wrong', true)).rejects.toThrow()
    expect(calls).toHaveLength(2)
    expect(calls[0]).toEqual({ name: 'set_profile_follow', args: { p_user_id: id, p_following: false, p_actor_id: actor } })
  })

  it('公开资料名称不用邮箱兜底', () => {
    expect(publicProfileName({ primary_email: 'secret@example.test' })).toBe('壁纸爱好者')
    expect(publicProfileName({ display_name: '山间' })).toBe('山间')
  })

  it('旧账号和旧路由迟到响应不能覆盖新页面，取消立即清空旧公开内容', async () => {
    const pending = []
    const states = []
    const loader = createLatestCommunityRequest({ onState: state => states.push(state) })
    const first = loader.run(signal => new Promise(resolve => pending.push({ signal, resolve })))
    const second = loader.run(signal => new Promise(resolve => pending.push({ signal, resolve })))
    expect(pending[0].signal.aborted).toBe(true)
    expect(states.at(-1)).toMatchObject({ status: 'loading', data: null })
    pending[1].resolve({ id: 'new' })
    await second
    pending[0].resolve({ id: 'old' })
    await first
    expect(states.at(-1)).toMatchObject({ status: 'ready', data: { id: 'new' } })
    loader.cancel()
    expect(states.at(-1)).toMatchObject({ status: 'idle', data: null })
  })

  it('失效或未公开主页清空旧数据，网络错误保留可重试状态', async () => {
    const onState = vi.fn()
    const loader = createLatestCommunityRequest({ onState })
    await loader.run(async () => null)
    expect(onState.mock.lastCall[0]).toMatchObject({ status: 'empty', data: null })
    await loader.run(async () => { throw new Error('network') })
    expect(onState.mock.lastCall[0]).toMatchObject({ status: 'error', data: null })
  })

  it('列表响应缺失或错误格式必须报错，不能展示成没有收藏夹', async () => {
    for (const data of [null, [], { items: [], has_more: 'false' }, { items: null, has_more: false }]) {
      const service = createCommunityService({ getClient: () => ({ rpc: async () => ({ data, error: null }) }) })
      await expect(service.getMyCollections()).rejects.toThrow()
    }
  })

  it('设置写入15秒超时明确失败，底层忽略abort的迟到成功不能变成成功', async () => {
    vi.useFakeTimers()
    let finish
    let requestSignal
    const query = new Promise(resolve => { finish = resolve })
    query.abortSignal = signal => { requestSignal = signal; return query }
    const service = createCommunityService({ getClient: () => ({ rpc: () => query }) })
    let outcome
    const request = service.saveSettings({ enabled: true, show_likes: false }, '11111111-1111-4111-8111-111111111111')
      .then(value => { outcome = { value } }, error => { outcome = { error } })
    await vi.advanceTimersByTimeAsync(14999)
    expect(outcome).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(outcome?.error?.name).toBe('TimeoutError')
    expect(requestSignal.aborted).toBe(true)
    finish({ data: { enabled: true, show_likes: false }, error: null })
    await request
    expect(outcome.value).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('外部取消立即中止合并信号与等待，不会继续等到超时', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    let requestSignal
    const query = new Promise(() => {})
    query.abortSignal = signal => { requestSignal = signal; return query }
    const service = createCommunityService({ getClient: () => ({ rpc: () => query }) })
    let error
    service.getMyCollections({ signal: controller.signal }).catch(value => { error = value })
    await Promise.resolve()
    controller.abort()
    await vi.advanceTimersByTimeAsync(0)
    expect(error?.name).toBe('AbortError')
    expect(requestSignal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('成功和失败都清理超时及外部监听，不会取消已完成请求', async () => {
    vi.useFakeTimers()
    for (const error of [null, { code: 'PGRST202' }]) {
      const controller = new AbortController()
      let requestSignal
      const query = Promise.resolve({ data: { items: [], has_more: false }, error })
      query.abortSignal = signal => { requestSignal = signal; return query }
      const service = createCommunityService({ getClient: () => ({ rpc: () => query }) })
      await service.getMyCollections({ signal: controller.signal }).catch(() => {})
      expect(vi.getTimerCount()).toBe(0)
      controller.abort()
      await vi.advanceTimersByTimeAsync(15000)
      expect(requestSignal.aborted).toBe(false)
    }
  })
})


it('收藏夹仅接受私有或公开，旧隐藏值读取时按私有显示且不写回', async () => {
  const rpc = vi.fn(async () => ({ data: { items: [{ id: 'legacy', visibility: 'unlisted' }, { id: 'visible', visibility: 'public' }], has_more: false }, error: null }))
  const service = createCommunityService({ getClient: () => ({ rpc }) })
  expect((await service.getMyCollections()).items.map(item => item.visibility)).toEqual(['private', 'public'])
  await expect(service.setCollectionVisibility('11111111-1111-4111-8111-111111111111', 'unlisted', '22222222-2222-4222-8222-222222222222')).rejects.toThrow('可见性无效')
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc.mock.calls[0][0]).toBe('get_my_collection_visibility')
})
