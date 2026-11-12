import { describe, expect, it, vi } from 'vitest'
import { animateGridChange, classifyGridChange, measureVisibleCards } from '../src/components/wallpaper/WallpaperGrid/composables/gridContinuity.js'

describe('网格只过渡真实的结果变化', () => {
  it('追加和相同结果不重播，排序与跨系列分别处理', () => {
    expect(classifyGridChange(['a'], ['a', 'b'], 'desktop', 'desktop')).toBe('append')
    expect(classifyGridChange(['a', 'b'], ['a', 'b'], 'desktop', 'desktop')).toBe('none')
    expect(classifyGridChange(['a', 'b'], ['b', 'a'], 'desktop', 'desktop')).toBe('reorder')
    expect(classifyGridChange(['a', 'b'], ['b', 'c'], 'desktop', 'desktop')).toBe('filter')
    expect(classifyGridChange(['a'], ['b'], 'desktop', 'mobile')).toBe('series')
  })

  it('记录可见几何，保留项从原位置接位，视口外卡片不运行动画', () => {
    const makeCard = (id, top) => ({
      dataset: { gridKey: id },
      getBoundingClientRect: () => ({ left: 0, right: 100, top, bottom: top + 80, width: 100, height: 80 }),
      animate: vi.fn(() => ({ cancel: vi.fn() })),
    })
    const first = makeCard('a', 20)
    const second = makeCard('b', 120)
    const hidden = makeCard('c', 2000)
    const grid = { children: [first, second, hidden] }
    const before = measureVisibleCards(grid, { width: 390, height: 844 })
    expect([...before.keys()]).toEqual(['a', 'b'])
    first.getBoundingClientRect = () => ({ left: 0, right: 100, top: 120, bottom: 200, width: 100, height: 80 })
    second.getBoundingClientRect = () => ({ left: 0, right: 100, top: 20, bottom: 100, width: 100, height: 80 })
    const after = measureVisibleCards(grid, { width: 390, height: 844 })
    const cancel = animateGridChange(before, after, { mode: 'reorder' })
    expect(first.animate.mock.calls[0][0][0].transform).toBe('translate(0px, -100px)')
    expect(second.animate.mock.calls[0][0][0].transform).toBe('translate(0px, 100px)')
    expect(hidden.animate).not.toHaveBeenCalled()
    cancel()
    expect(first.animate.mock.results[0].value.cancel).toHaveBeenCalled()
  })

  it('减少动态效果不创建位移或淡入动画', () => {
    const element = { animate: vi.fn() }
    const cards = new Map([['a', { element, rect: { left: 0, top: 0 } }]])
    animateGridChange(new Map(), cards, { mode: 'filter', reduced: true })()
    expect(element.animate).not.toHaveBeenCalled()
  })

  it('连续筛选保留中间透明度，同位置卡片也平滑结束淡入', () => {
    const element = { animate: vi.fn(() => ({ cancel() {} })) }
    const previous = new Map([['a', { element, rect: { left: 0, top: 0 }, opacity: 0.4 }]])
    const next = new Map([['a', { element, rect: { left: 0, top: 0 }, opacity: 1 }]])
    animateGridChange(previous, next, { mode: 'filter' })
    expect(element.animate.mock.calls[0]?.[0]).toEqual([{ opacity: 0.4 }, { opacity: 1 }])
  })
})
