import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createWallpaperTransition, fitTransitionImage } from '../src/utils/wallpaper/detailTransition.js'

const rect = { left: 20, top: 40, width: 240, height: 150 }
const origin = { assetKey: 'desktop:path:/wallpaper/desktop/lake.jpg', from: '/desktop?q=lake', to: '/wallpaper/lake', currentSrc: '/thumbnail/lake.webp', rect, width: 1600, height: 1000, input: 'keyboard' }
let transition
beforeEach(() => { vi.useFakeTimers(); transition = createWallpaperTransition() })
afterEach(() => { transition.dispose(); vi.useRealTimers() })

it('卡片上下文只交给匹配的下一次导航，详情可即时读取成功缩略图', () => {
  transition.capture(origin)
  transition.begin(origin.to, origin.from)
  expect(transition.state.value).toMatchObject({ direction: 'forward', phase: 'waiting', context: { currentSrc: '/thumbnail/lake.webp' } })
  expect(transition.preview(origin.assetKey, origin.to)).toBe('/thumbnail/lake.webp')
  expect(transition.preview('another', origin.to)).toBe('')
  transition.begin('/about', origin.from)
  transition.begin(origin.to, origin.from)
  expect(transition.state.value).toBeNull()
  expect(transition.preview(origin.assetKey, origin.to)).toBe('')
})

it('目标必须同时匹配路由与资源身份，过期上下文不能挪用到下一张图片', () => {
  transition.capture(origin)
  transition.begin(origin.to, origin.from)
  expect(transition.targetReady({ assetKey: origin.assetKey, rect })).toBe(false)
  transition.arrived(origin.to)
  expect(transition.targetReady({ assetKey: 'other', rect })).toBe(false)
  expect(transition.targetReady({ assetKey: origin.assetKey, rect })).toBe(true)
  expect(transition.state.value.phase).toBe('running')
  transition.finish()
  expect(transition.state.value).toBeNull()
})

it('450ms未准备好就释放覆盖层，稍后媒体就绪不会重放旧交接', () => {
  transition.capture(origin)
  transition.begin(origin.to, origin.from)
  transition.arrived(origin.to)
  vi.advanceTimersByTime(450)
  expect(transition.state.value).toBeNull()
  expect(transition.targetReady({ assetKey: origin.assetKey, rect })).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
})

it('返回必须等列表实际恢复完成，失效目标不会触发滚动或焦点', () => {
  transition.capture(origin)
  transition.begin(origin.to, origin.from)
  transition.arrived(origin.to)
  transition.finish()
  transition.begin(origin.from, origin.to, { ...origin, rect: { ...rect, width: 800, height: 500 } })
  transition.arrived(origin.from)
  expect(transition.targetReady({ assetKey: origin.assetKey, rect })).toBe(false)
  transition.browseRestored('/mobile')
  expect(transition.targetReady({ assetKey: origin.assetKey, rect })).toBe(false)
  transition.browseRestored(origin.from)
  expect(transition.targetReady({ assetKey: origin.assetKey, rect, inViewport: false })).toBe(false)
  expect(transition.targetReady({ assetKey: origin.assetKey, rect, inViewport: true })).toBe(true)
  expect(transition.state.value).toMatchObject({ direction: 'back', phase: 'running', context: { input: 'keyboard' } })
})

it.each(['reduced', 'missing-source', 'timeout'])('键盘返回在%s降级后仍保留恢复完成后的焦点请求', (reason) => {
  transition.capture(origin)
  transition.begin(origin.to, origin.from)
  transition.arrived(origin.to)
  transition.finish()
  transition.begin(origin.from, origin.to, reason === 'missing-source' ? null : origin, reason === 'reduced')
  if (reason === 'timeout')
    vi.advanceTimersByTime(450)
  expect(transition.focusTarget.value).toMatchObject({ assetKey: origin.assetKey, ready: false })
  transition.browseRestored(origin.from)
  expect(transition.focusTarget.value).toMatchObject({ assetKey: origin.assetKey, ready: true })
  transition.begin('/about', origin.from)
  expect(transition.focusTarget.value).toBeNull()
})

it('取消、卸载、快速导航与减少动态效果都会立即释放当前资源和定时器', () => {
  transition.capture(origin)
  transition.begin(origin.to, origin.from)
  transition.cancel()
  expect(transition.state.value).toBeNull()
  expect(vi.getTimerCount()).toBe(0)
  transition.capture(origin)
  transition.begin(origin.to, origin.from, null, true)
  expect(transition.state.value).toBeNull()
  transition.capture(origin)
  transition.begin(origin.to, origin.from)
  transition.dispose()
  expect(transition.state.value).toBeNull()
  expect(transition.preview(origin.assetKey, origin.to)).toBe('')
})

it('来源不可见、未成功加载或非正常内部路径时不建立上下文', () => {
  for (const patch of [{ currentSrc: '' }, { width: 0 }, { rect: { ...rect, width: 0 } }, { from: 'https://outside.test' }, { to: '//outside.test' }]) {
    transition.capture({ ...origin, ...patch })
    transition.begin(origin.to, origin.from)
    expect(transition.state.value).toBeNull()
  }
})

it('图片在裁切卡片与完整详情之间始终维持原始比例', () => {
  expect(fitTransitionImage({ width: 200, height: 200 }, 1600, 900, 'cover')).toEqual({ left: -77.77777777777777, top: 0, width: 355.55555555555554, height: 200 })
  expect(fitTransitionImage({ width: 800, height: 600 }, 1600, 900, 'contain')).toEqual({ left: 0, top: 75, width: 800, height: 450 })
})
