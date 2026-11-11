import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useInteraction } from '../src/composables/useInteraction.js'
import { useAuthStore } from '../src/stores/auth.js'
import { useInteractionStore } from '../src/stores/interaction.js'

const remote = vi.hoisted(() => ({ likes: new Set(), collections: new Set(), adjustments: [] }))
vi.mock('element-plus', () => ({ ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }))
vi.mock('../src/stores/popularity.js', () => ({ usePopularityStore: () => ({
  adjustLikeCount: (key, delta) => remote.adjustments.push({ key, delta, type: 'like' }),
  adjustCollectCount: (key, delta) => remote.adjustments.push({ key, delta, type: 'collect' }),
}) }))
vi.mock('../src/lib/supabase/client.js', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }) },
    from(table) {
      const rows = table === 'user_wallpaper_likes' ? remote.likes : remote.collections
      let assetKey
      let removing = false
      const query = {
        select: () => query,
        eq(column, value) {
          if (column === 'asset_key')
            assetKey = value
          return query
        },
        single: async () => ({ data: { id: 'collection-1' } }),
        maybeSingle: async () => ({ data: rows.has(assetKey) ? { asset_key: assetKey } : null }),
        delete() { removing = true; return query },
        insert(row) { rows.add(row.asset_key); return Promise.resolve({ error: null }) },
        then(resolve) {
          if (removing)
            rows.delete(assetKey)
          return Promise.resolve({ error: null }).then(resolve)
        },
      }
      return query
    },
  }),
}))

describe('同名壁纸喜欢与收藏隔离', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    remote.likes.clear()
    remote.collections.clear()
    remote.adjustments.length = 0
    useAuthStore().session = { user: { id: 'user-1' } }
  })

  it('卡片切换后按路径显示状态，服务写入和资料库快照不会合并', async () => {
    const wallpaper = ref({ filename: 'same.jpg', path: '/wallpaper/desktop/a/same.jpg' })
    const interaction = useInteraction(wallpaper, ref('desktop'))
    await interaction.toggleLike()
    await interaction.toggleCollect()
    expect(interaction.liked.value).toBe(true)
    expect(interaction.collected.value).toBe(true)
    wallpaper.value = { filename: 'same.jpg', path: '/wallpaper/desktop/b/same.jpg' }
    expect(interaction.liked.value).toBe(false)
    expect(interaction.collected.value).toBe(false)
    await interaction.toggleLike()
    await interaction.toggleCollect()
    const expected = ['desktop:path:/wallpaper/desktop/a/same.jpg', 'desktop:path:/wallpaper/desktop/b/same.jpg']
    expect([...remote.likes].sort()).toEqual(expected)
    expect([...remote.collections].sort()).toEqual(expected)
    expect(useInteractionStore().allLikes.map(item => item.asset_key).sort()).toEqual(expected)
    expect(useInteractionStore().allCollectionItems.map(item => item.asset_key).sort()).toEqual(expected)
    expect(remote.adjustments.map(item => item.key)).toEqual([expected[0], expected[0], expected[1], expected[1]])
  })

  it('Bing喜欢与收藏按同一日期身份写入、回显及取消', async () => {
    const key = 'bing:bing-2026-11-10.jpg'
    const wallpaper = ref({ filename: 'bing-2026-11-10.jpg', _assetKey: key, _series: 'bing', isBing: true })
    const interaction = useInteraction(wallpaper, ref('bing'))
    expect(await interaction.toggleLike()).toMatchObject({ success: true, liked: true })
    expect(await interaction.toggleCollect()).toMatchObject({ success: true, collected: true })
    expect([...remote.likes]).toEqual([key])
    expect([...remote.collections]).toEqual([key])
    expect(interaction.liked.value).toBe(true)
    expect(interaction.collected.value).toBe(true)
    await interaction.toggleLike()
    await interaction.toggleCollect()
    expect(remote.likes.size).toBe(0)
    expect(remote.collections.size).toBe(0)
    expect(remote.adjustments.map(item => [item.key, item.delta])).toEqual([[key, 1], [key, 1], [key, -1], [key, -1]])
  })
})
