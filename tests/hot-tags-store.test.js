import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadHotTags } from '../src/services/hotTagsService.js'
import { useHotTagsStore } from '../src/stores/hotTags.js'

vi.mock('../src/services/hotTagsService.js', () => ({ loadHotTags: vi.fn() }))

describe('热门标签缓存和系列切换', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-10T04:00:00Z'))
    vi.mocked(loadHotTags).mockReset()
    setActivePinia(createPinia())
  })

  afterEach(() => vi.useRealTimers())

  it('缓存一小时后重新加载，手动刷新立即重新加载', async () => {
    vi.mocked(loadHotTags).mockResolvedValue([{ tag: '雪山' }])
    const store = useHotTagsStore()
    await store.fetchHotTags('desktop')
    await store.fetchHotTags('desktop')
    expect(loadHotTags).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60 * 60 * 1000)
    await store.fetchHotTags('desktop')
    expect(loadHotTags).toHaveBeenCalledTimes(2)
    await store.fetchHotTags('desktop', true)
    expect(loadHotTags).toHaveBeenCalledTimes(3)
  })

  it.each(['video', 'mobile'])('切到 %s 后，旧请求不得覆盖当前推荐', async (nextSeries) => {
    const store = useHotTagsStore()
    vi.mocked(loadHotTags).mockResolvedValueOnce([{ tag: '猫咪' }])
    await store.fetchHotTags('mobile')
    let resolveDesktop
    vi.mocked(loadHotTags).mockImplementationOnce(() => new Promise((resolve) => {
      resolveDesktop = resolve
    }))
    const pending = store.fetchHotTags('desktop')
    await store.fetchHotTags(nextSeries)
    resolveDesktop([{ tag: '雪山' }])
    await pending
    expect(store.currentSeries).toBe(nextSeries)
    expect(store.tags).toEqual(nextSeries === 'video' ? [] : [{ tag: '猫咪' }])
    expect(store.loading).toBe(false)
  })
})
