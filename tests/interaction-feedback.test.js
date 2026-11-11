import { effectScope, nextTick, reactive, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createInteractionFeedback } from '../src/utils/interaction/feedback.js'
import { useInteractionPrefetch } from '../src/composables/useInteractionPrefetch.js'
import { useInteraction } from '../src/composables/useInteraction.js'

vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ isAuthenticated: ref(false) }) }))
vi.mock('@/stores/interaction', () => ({ useInteractionStore: () => ({ isLiked: () => false, isCollected: () => false, handleToggleLike: vi.fn(), handleToggleCollect: vi.fn() }) }))

it('游客操作提示并带原专题redirect登录，不将游客状态改为喜欢或收藏', async () => {
  const interaction = useInteraction(ref({ path: '/wallpaper/desktop/a.jpg' }), ref('desktop'))
  const router = { push: vi.fn() }
  const message = { info: vi.fn(), error: vi.fn() }
  const wrap = createInteractionFeedback({ router, getRedirect: () => '/desktop', message })
  expect(await wrap(interaction.toggleLike)()).toEqual({ needsLogin: true })
  expect(await wrap(interaction.toggleCollect)()).toEqual({ needsLogin: true })
  expect(message.info).toHaveBeenCalledWith('请先登录后再喜欢或收藏')
  expect(router.push).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/desktop' } })
  expect(interaction.liked.value).toBe(false)
  expect(interaction.collected.value).toBe(false)
  expect(message.error).not.toHaveBeenCalled()
})

it('未处理失败有反馈，store已反馈失败不重复，成功不误导航', async () => {
  const router = { push: vi.fn() }
  const message = { info: vi.fn(), error: vi.fn() }
  const wrap = createInteractionFeedback({ router, getRedirect: () => '/wallpaper/token', message })
  expect(await wrap(async () => { throw new Error('private error') })()).toEqual({ success: false })
  await wrap(async () => ({ success: false }))()
  await wrap(async () => ({ success: false, error: new Error('store-handled') }))()
  await wrap(async () => ({ success: true, liked: true }))()
  expect(message.error).toHaveBeenCalledTimes(2)
  expect(router.push).not.toHaveBeenCalled()
})

it('未配置/游客不预取，登录和后续切图会自动补齐系列交互状态', async () => {
  const scope = effectScope()
  const auth = reactive({ isConfigured: false, isAuthenticated: false })
  const interaction = { prefetchForSeries: vi.fn() }
  const records = ref([{ series: 'desktop' }])
  scope.run(() => useInteractionPrefetch(records, { auth, interaction }))
  expect(interaction.prefetchForSeries).not.toHaveBeenCalled()
  auth.isConfigured = true
  await nextTick()
  expect(interaction.prefetchForSeries).not.toHaveBeenCalled()
  auth.isAuthenticated = true
  await nextTick()
  expect(interaction.prefetchForSeries).toHaveBeenCalledWith('desktop')
  records.value = [{ series: 'mobile' }]
  await nextTick()
  expect(interaction.prefetchForSeries).toHaveBeenCalledWith('mobile')
  scope.stop()
})
