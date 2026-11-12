import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useInteraction } from '../src/composables/useInteraction.js'
import { useInteractionStore } from '../src/stores/interaction.js'

const remote = vi.hoisted(() => ({ like: vi.fn(), collect: vi.fn(), defaultCollection: vi.fn(), success: vi.fn() }))
vi.mock('../src/services/interactionService.js', () => ({
  toggleLike: remote.like,
  toggleCollect: remote.collect,
  fetchDefaultCollectionId: remote.defaultCollection,
  fetchAllUserCollectionItems: vi.fn(), fetchAllUserLikes: vi.fn(), fetchUserCollections: vi.fn(),
  fetchUserInteractionStats: vi.fn(), fetchUserLikes: vi.fn(),
}))
vi.mock('../src/stores/auth.js', () => ({ useAuthStore: () => ({ isAuthenticated: ref(true) }) }))
vi.mock('../src/stores/popularity.js', () => ({ usePopularityStore: () => ({ adjustLikeCount() {}, adjustCollectCount() {} }) }))
vi.mock('element-plus', () => ({ ElMessage: { success: remote.success, warning: vi.fn(), error: vi.fn() } }))

const item = { filename: 'a.jpg', path: '/wallpaper/desktop/a.jpg' }
const key = 'desktop:path:/wallpaper/desktop/a.jpg'
function deferred() {
  let resolve, reject
  const promise = new Promise((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  remote.like.mockResolvedValue(true)
  remote.collect.mockResolvedValue(true)
  remote.defaultCollection.mockResolvedValue('collection-1')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

it('首次收藏立即回显，等待默认收藏夹时只锁收藏，失败回滚并可重试', async () => {
  const request = deferred()
  remote.defaultCollection.mockReturnValueOnce(request.promise)
  const state = useInteraction(ref(item), ref('desktop'))
  const pending = state.toggleCollect()
  expect(state.collected.value).toBe(true)
  expect(state.collectPending.value).toBe(true)
  expect(state.likePending.value).toBe(false)
  expect(useInteractionStore().allCollectionItems).toEqual([])
  expect(await state.toggleCollect()).toMatchObject({ ignored: true })
  await state.toggleLike()
  expect(state.liked.value).toBe(true)
  request.reject(new Error('Failed to fetch'))
  expect(await pending).toMatchObject({ success: false, feedbackHandled: true })
  expect(state.collected.value).toBe(false)
  expect(state.collectPending.value).toBe(false)
  expect(state.collectError.value).toContain('网络')
  expect(useInteractionStore().allCollectionItems).toEqual([])
  const retry = state.toggleCollect()
  expect(state.collectError.value).toBe('')
  await retry
  expect(state.collected.value).toBe(true)
  expect(useInteractionStore().allCollectionItems).toMatchObject([{ asset_key: key, collection_id: 'collection-1' }])
  expect(remote.success).not.toHaveBeenCalled()
})

it('失败取消收藏时恢复原收藏记录，切换资源不显示另一张的错误', async () => {
  const store = useInteractionStore()
  const previous = { asset_key: key, collection_id: 'collection-1', added_at: '2026-01-01' }
  store.collectedBySeriesMap.desktop = new Set([key])
  store.allCollectionItems = [previous]
  remote.collect.mockRejectedValueOnce(new Error('Failed to fetch'))
  const wallpaper = ref(item)
  const state = useInteraction(wallpaper, ref('desktop'))
  await state.toggleCollect()
  expect(store.allCollectionItems).toEqual([previous])
  expect(state.collectError.value).not.toBe('')
  wallpaper.value = { filename: 'b.jpg', path: '/wallpaper/desktop/b.jpg' }
  expect(state.collectError.value).toBe('')
  expect(state.collectPending.value).toBe(false)
})

it('登出重置之后，旧操作完成不能恢复旧账户状态或解除新操作锁', async () => {
  const old = deferred()
  const next = deferred()
  remote.like.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
  const store = useInteractionStore()
  const state = useInteraction(ref(item), ref('desktop'))
  const first = state.toggleLike()
  store.$reset()
  const second = state.toggleLike()
  old.reject(new Error('Failed to fetch'))
  await first
  expect(state.likePending.value).toBe(true)
  expect(state.liked.value).toBe(true)
  expect(state.likeError.value).toBe('')
  next.resolve(true)
  await second
  expect(state.likePending.value).toBe(false)
  expect(store.stats.likes).toBe(1)
})
