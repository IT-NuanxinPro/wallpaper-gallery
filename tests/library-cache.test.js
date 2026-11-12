import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import { useInteractionStore } from '../src/stores/interaction.js'

const api = vi.hoisted(() => ({ likes: vi.fn(), collections: vi.fn(), stats: vi.fn() }))
vi.mock('../src/services/interactionService.js', () => ({
  fetchAllUserLikes: api.likes, fetchAllUserCollectionItems: api.collections, fetchUserInteractionStats: api.stats,
  fetchDefaultCollectionId: vi.fn(), fetchUserCollections: vi.fn(), fetchUserLikes: vi.fn(), toggleCollect: vi.fn(), toggleLike: vi.fn(),
}))
beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  api.likes.mockResolvedValue([{ asset_key: 'desktop:path:/wallpaper/desktop/a.jpg' }])
  api.collections.mockResolvedValue([])
  api.stats.mockResolvedValue({ likes: 1, collections: 0, downloads: 0 })
})

it('同用户并发加载合并，短期重新进入复用快照，强制刷新保留已展示数据', async () => {
  let finish
  api.likes.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const store = useInteractionStore()
  const first = store.loadLibraryData({ userId: 'a' })
  const second = store.loadLibraryData({ userId: 'a' })
  expect(api.likes).toHaveBeenCalledOnce()
  finish([{ asset_key: 'desktop:path:/wallpaper/desktop/a.jpg' }])
  await Promise.all([first, second])
  expect(store.libraryLoaded).toBe(true)
  await store.loadLibraryData({ userId: 'a' })
  expect(api.likes).toHaveBeenCalledOnce()
  api.likes.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const refresh = store.loadLibraryData({ userId: 'a', force: true })
  expect(store.allLikes).toHaveLength(1)
  expect(store.libraryLoading).toBe(true)
  finish([])
  await refresh
  expect(store.allLikes).toEqual([])
  expect(store.likesBySeries.desktop).toEqual([])
})

it('账号切换立即清除旧快照且忽略迟到响应，登出reset使缓存失效', async () => {
  let finishOld
  api.likes.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
  const store = useInteractionStore()
  const old = store.loadLibraryData({ userId: 'a' })
  api.likes.mockResolvedValue([])
  await store.loadLibraryData({ userId: 'b' })
  finishOld([{ asset_key: 'desktop:path:/wallpaper/desktop/private-a.jpg' }])
  await old
  expect(store.allLikes).toEqual([])
  expect(store.libraryOwner).toBe('b')
  store.$reset()
  expect(store.libraryLoaded).toBe(false)
  await store.loadLibraryData({ userId: 'b' })
  expect(api.likes).toHaveBeenCalledTimes(3)
})
