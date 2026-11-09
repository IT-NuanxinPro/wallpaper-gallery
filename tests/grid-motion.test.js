import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, nextTick, ref } from 'vue'
import { useGridPagination } from '../src/components/wallpaper/WallpaperGrid/composables/useGridPagination.js'
import { vCardReveal } from '../src/components/wallpaper/WallpaperGrid/composables/cardReveal.js'

const renderer = createRenderer({
  createComment: () => ({}), createText: () => ({}), createElement: () => ({}),
  insert: () => {}, remove: () => {}, setText: () => {}, setElementText: () => {},
  patchProp: () => {}, parentNode: () => null, nextSibling: () => null,
})

let observers
let frames
let frameId
let motionPreference
let apps
let cards

beforeEach(() => {
  observers = []
  frames = new Map()
  frameId = 0
  apps = []
  cards = []
  motionPreference = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  vi.stubGlobal('window', { matchMedia: vi.fn(() => motionPreference) })
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
    frames.set(++frameId, callback)
    return frameId
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn(id => frames.delete(id)))
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback, options) {
      this.callback = callback
      this.options = options
      this.observe = vi.fn()
      this.unobserve = vi.fn()
      this.disconnect = vi.fn()
      observers.push(this)
    }
  })
})

afterEach(() => {
  apps.forEach(app => app.unmount())
  cards.forEach(card => vCardReveal.beforeUnmount(card))
  vi.unstubAllGlobals()
})

async function runFrame() {
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach(callback => callback())
  await nextTick()
}

function mountPagination(length = 80) {
  const wallpapers = ref(Array.from({ length }, (_, id) => ({ id })))
  let pagination
  const app = renderer.createApp({
    setup() {
      pagination = useGridPagination({ wallpapers })
      return () => null
    },
  })
  app.mount({})
  apps.push(app)
  return { pagination, wallpapers, app }
}

function addCard() {
  const animation = { cancel: vi.fn() }
  const card = { animate: vi.fn(() => animation) }
  cards.push(card)
  vCardReveal.mounted(card)
  return { card, animation }
}

describe('网格按需分页', () => {
  it('哨兵进入视口才加载，并合并同一轮重复通知', async () => {
    const { pagination } = mountPagination()
    const sentinel = {}
    pagination.loadMoreSentinel.value = sentinel
    await nextTick()
    const observer = observers[0]
    observer.callback([{ target: sentinel, isIntersecting: false }])
    expect(frames.size).toBe(0)
    observer.callback([{ target: sentinel, isIntersecting: true }])
    observer.callback([{ target: sentinel, isIntersecting: true }])
    expect(frames.size).toBe(1)
    expect(pagination.displayedItems.value).toHaveLength(20)
    await runFrame()
    expect(pagination.displayedItems.value).toHaveLength(40)
    expect(pagination.isLoadingMore.value).toBe(false)
    observer.callback([{ target: sentinel, isIntersecting: true }])
    expect(frames.size).toBe(0)
    await nextTick()
    const nextObserver = observers.at(-1)
    expect(nextObserver).not.toBe(observer)
    nextObserver.callback([{ target: sentinel, isIntersecting: true }])
    await runFrame()
    expect(pagination.displayedItems.value).toHaveLength(60)
  })

  it('追加元数据保留展开数，切换筛选会取消待处理加载', async () => {
    const { pagination, wallpapers } = mountPagination()
    pagination.loadMore()
    await runFrame()
    wallpapers.value = [...wallpapers.value, { id: 80 }]
    expect(pagination.displayedItems.value).toHaveLength(40)
    pagination.loadMore()
    pagination.resetDisplayCount()
    wallpapers.value = [{ id: 'filtered' }]
    await runFrame()
    expect(pagination.displayCount.value).toBe(20)
    expect(pagination.displayedItems.value).toEqual([{ id: 'filtered' }])
    expect(pagination.hasMoreData.value).toBe(false)
  })

  it('卸载释放观察器与帧任务，丢弃过期观察回调', async () => {
    const { pagination, app } = mountPagination()
    const sentinel = {}
    pagination.loadMoreSentinel.value = sentinel
    await nextTick()
    const observer = observers[0]
    observer.callback([{ target: sentinel, isIntersecting: true }])
    app.unmount()
    apps = []
    expect(observer.disconnect).toHaveBeenCalled()
    expect(frames.size).toBe(0)
    observer.callback([{ target: sentinel, isIntersecting: true }])
    await runFrame()
    expect(pagination.displayCount.value).toBe(20)
  })

  it('筛选重置后仍在视口的哨兵会重新观察，且旧回调不能加载新列表', async () => {
    const { pagination, wallpapers } = mountPagination()
    const sentinel = {}
    pagination.loadMoreSentinel.value = sentinel
    await nextTick()
    const oldObserver = observers[0]
    oldObserver.callback([{ target: sentinel, isIntersecting: true }])
    await runFrame()
    pagination.resetDisplayCount()
    wallpapers.value = Array.from({ length: 80 }, (_, id) => ({ id: `filtered-${id}` }))
    await nextTick()
    oldObserver.callback([{ target: sentinel, isIntersecting: true }])
    expect(frames.size).toBe(0)
    const observer = observers.at(-1)
    observer.callback([{ target: sentinel, isIntersecting: true }])
    await runFrame()
    expect(pagination.displayCount.value).toBe(40)
    expect(pagination.displayedItems.value[0].id).toBe('filtered-0')
  })

  it('不支持 IntersectionObserver 时保留手动分页', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const { pagination } = mountPagination(21)
    pagination.loadMore()
    await runFrame()
    expect(pagination.displayedItems.value).toHaveLength(21)
    expect(pagination.hasMoreData.value).toBe(false)
  })
})

describe('卡片首次进入视口的 slide-up', () => {
  it('已进入视口的卡片不会被动画重新隐藏，也不会覆盖悬停的 transform', () => {
    const { card } = addCard()
    observers[0].callback([{ target: card, isIntersecting: true }])
    const [keyframes, options] = card.animate.mock.calls[0]
    expect(keyframes.every(frame => frame.opacity === undefined || frame.opacity === 1)).toBe(true)
    expect(keyframes.every(frame => frame.transform === undefined)).toBe(true)
    expect(options.delay || 0).toBe(0)
    expect(options.fill).not.toBe('backwards')
  })

  it('多个卡片共用观察器，首次进入后不再反复动画且不延迟显示', () => {
    const items = Array.from({ length: 10 }, addCard)
    expect(observers).toHaveLength(1)
    const observer = observers[0]
    observer.callback(items.map(({ card }) => ({ target: card, isIntersecting: true })))
    items.forEach(({ card }) => {
      expect(card.animate).toHaveBeenCalledTimes(1)
      expect(card.animate.mock.calls[0][1].delay || 0).toBe(0)
      expect(observer.unobserve).toHaveBeenCalledWith(card)
    })
    observer.callback([{ target: items[0].card, isIntersecting: true }])
    expect(items[0].card.animate).toHaveBeenCalledTimes(1)
    expect(observer.disconnect).toHaveBeenCalled()
  })

  it('默认内容保持可见，不支持动画或减少动态效果时跳过观察和位移', () => {
    motionPreference.matches = true
    const { card } = addCard()
    expect(card.animate).not.toHaveBeenCalled()
    expect(observers).toHaveLength(0)
    motionPreference.matches = false
    const staticCard = {}
    vCardReveal.mounted(staticCard)
    expect(staticCard).toEqual({})
    expect(observers).toHaveLength(0)
  })

  it('卸载取消执行中的动画，并清理尚未进入视口的卡片', () => {
    const first = addCard()
    const second = addCard()
    const observer = observers[0]
    observer.callback([{ target: first.card, isIntersecting: true }])
    vCardReveal.beforeUnmount(first.card)
    vCardReveal.beforeUnmount(second.card)
    expect(first.animation.cancel).toHaveBeenCalledOnce()
    expect(observer.unobserve).toHaveBeenCalledWith(second.card)
    expect(observer.disconnect).toHaveBeenCalled()
    expect(motionPreference.removeEventListener).toHaveBeenCalled()
    cards = []
  })

  it('运行期间开启减少动态效果会结束所有位移动画', () => {
    const first = addCard()
    const observer = observers[0]
    observer.callback([{ target: first.card, isIntersecting: true }])
    motionPreference.matches = true
    const onChange = motionPreference.addEventListener.mock.calls[0][1]
    onChange()
    expect(first.animation.cancel).toHaveBeenCalledOnce()
  })
})
