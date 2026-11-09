import { createRenderer, effectScope, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { observeLoadingVisibility } from '../src/components/common/feedback/observeLoadingVisibility.js'
import { useLoadingSurface } from '../src/components/common/feedback/useLoadingSurface.js'
import { defineAsyncModal } from '../src/components/common/feedback/defineAsyncModal.js'

const fallback = vi.hoisted(() => ({ props: null, close: null }))
vi.mock('../src/components/common/feedback/ModalLoadingState.vue', () => ({
  default: {
    props: ['isOpen', 'error'],
    emits: ['close'],
    setup(props, { emit }) {
      return () => {
        fallback.props = { ...props }
        fallback.close = () => emit('close')
        return null
      }
    },
  },
}))

const renderer = createRenderer({
  createComment: () => ({}), createText: () => ({}), createElement: () => ({}),
  insert: () => {}, remove: () => {}, setText: () => {}, setElementText: () => {},
  patchProp: () => {}, parentNode: () => null, nextSibling: () => null,
})

describe('异步弹窗加载和错误契约', () => {
  let app
  beforeEach(() => {
    vi.useFakeTimers()
    fallback.props = null
  })
  afterEach(() => {
    app?.unmount()
    vi.useRealTimers()
  })

  function mountModal(loader) {
    const Modal = defineAsyncModal(loader)
    const isOpen = ref(true)
    const onClose = vi.fn(() => { isOpen.value = false })
    app = renderer.createApp({ setup: () => () => h(Modal, { isOpen: isOpen.value, onClose }) })
    app.config.errorHandler = () => {}
    app.mount({})
    return { isOpen, onClose }
  }

  it('模块加载立即反馈，加载失败后仍保留打开状态和关闭事件', async () => {
    let reject
    const { onClose } = mountModal(() => new Promise((_, rejectLoad) => { reject = rejectLoad }))
    expect(fallback.props.isOpen).toBe(true)
    reject(new Error('chunk unavailable'))
    await vi.advanceTimersByTimeAsync(0)
    expect(fallback.props.error?.message).toBe('chunk unavailable')
    expect(fallback.props.isOpen).toBe(true)
    fallback.close()
    await nextTick()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(fallback.props.isOpen).toBe(false)
  })

  it('模块永不返回时进入有限超时错误态，关闭可用', async () => {
    const { onClose } = mountModal(() => new Promise(() => {}))
    await vi.advanceTimersByTimeAsync(15000)
    expect(fallback.props.error).toBeInstanceOf(Error)
    expect(fallback.props.isOpen).toBe(true)
    fallback.close()
    await nextTick()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(fallback.props.isOpen).toBe(false)
  })
})

describe('加载遮罩生命周期', () => {
  let scope
  beforeEach(() => {
    vi.useFakeTimers()
    scope = effectScope()
  })
  afterEach(() => {
    scope.stop()
    vi.useRealTimers()
  })

  it('初始空闲不产生遮罩或延迟任务，开始请求立即显示', () => {
    const busy = ref(false)
    const visible = scope.run(() => useLoadingSurface(busy))
    expect(visible.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    busy.value = true
    expect(visible.value).toBe(true)
  })

  it('快速请求保留短视觉反馈，但不修改已经完成的业务忙碌状态', () => {
    const busy = ref(true)
    const visible = scope.run(() => useLoadingSurface(busy))
    vi.advanceTimersByTime(40)
    busy.value = false
    expect(busy.value).toBe(false)
    expect(visible.value).toBe(true)
    vi.advanceTimersByTime(199)
    expect(visible.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(visible.value).toBe(false)
  })

  it('连续请求取消旧隐藏任务，后续忙碌状态不会被旧计时器关闭', () => {
    const busy = ref(true)
    const visible = scope.run(() => useLoadingSurface(busy))
    vi.advanceTimersByTime(30)
    busy.value = false
    vi.advanceTimersByTime(20)
    busy.value = true
    vi.advanceTimersByTime(300)
    expect(visible.value).toBe(true)
    busy.value = false
    expect(visible.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('卸载清理延迟隐藏任务，不再改写已销毁的展示状态', () => {
    const busy = ref(true)
    const visible = scope.run(() => useLoadingSurface(busy))
    busy.value = false
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(500)
    expect(visible.value).toBe(true)
  })

  it('重新展示独立请求时重新计算最短反馈时间', () => {
    const busy = ref(true)
    const visible = scope.run(() => useLoadingSurface(busy))
    vi.advanceTimersByTime(500)
    busy.value = false
    expect(visible.value).toBe(false)
    busy.value = true
    vi.advanceTimersByTime(20)
    busy.value = false
    vi.advanceTimersByTime(219)
    expect(visible.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(visible.value).toBe(false)
  })
})

describe('共享加载动画可见性', () => {
  let observer
  let documentTarget
  let disposers
  beforeEach(() => {
    disposers = []
    documentTarget = new EventTarget()
    documentTarget.hidden = false
    vi.stubGlobal('document', documentTarget)
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback) {
        this.callback = callback
        this.targets = new Set()
        observer = this
      }

      observe(target) { this.targets.add(target) }
      unobserve(target) { this.targets.delete(target) }
      disconnect() { this.targets.clear() }
    })
  })
  afterEach(() => {
    disposers.forEach(dispose => dispose())
    vi.unstubAllGlobals()
  })

  it('多个加载器共享观察器，离开视口和页面隐藏均暂停，恢复只启动视口内实例', () => {
    const first = {}
    const second = {}
    let firstRunning
    let secondRunning
    disposers.push(observeLoadingVisibility(first, running => { firstRunning = running }))
    const sharedObserver = observer
    disposers.push(observeLoadingVisibility(second, running => { secondRunning = running }))
    expect(observer).toBe(sharedObserver)
    expect(observer.targets.size).toBe(2)
    expect(firstRunning).toBe(false)
    observer.callback([{ target: first, isIntersecting: true }, { target: second, isIntersecting: false }])
    expect(firstRunning).toBe(true)
    expect(secondRunning).toBe(false)
    documentTarget.hidden = true
    documentTarget.dispatchEvent(new Event('visibilitychange'))
    expect(firstRunning).toBe(false)
    documentTarget.hidden = false
    documentTarget.dispatchEvent(new Event('visibilitychange'))
    expect(firstRunning).toBe(true)
    expect(secondRunning).toBe(false)
    observer.callback([{ target: first, isIntersecting: false }])
    expect(firstRunning).toBe(false)
  })

  it('卸载移除观察并忽略迟到回调，最后一个卸载后可干净地重新挂载', () => {
    const element = {}
    const updates = []
    const dispose = observeLoadingVisibility(element, running => updates.push(running))
    disposers.push(dispose)
    const oldObserver = observer
    dispose()
    const updatesBefore = updates.length
    oldObserver.callback([{ target: element, isIntersecting: true }])
    documentTarget.hidden = true
    documentTarget.dispatchEvent(new Event('visibilitychange'))
    expect(updates.length).toBe(updatesBefore)
    expect(oldObserver.targets.size).toBe(0)
    disposers.push(observeLoadingVisibility({}, () => {}))
    expect(observer).not.toBe(oldObserver)
  })

  it('没有IntersectionObserver时仍然按页面可见性启停', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    let running
    disposers.push(observeLoadingVisibility({}, value => { running = value }))
    expect(running).toBe(true)
    documentTarget.hidden = true
    documentTarget.dispatchEvent(new Event('visibilitychange'))
    expect(running).toBe(false)
  })
})
