import { describe, expect, it, vi } from 'vitest'
import { buildFrameMorph, createPreviewMotion, getPreviewDevices, getPreviewGeometry, getPreviewMode, normalizePreviewDevice, resolveScreenPreview } from '../src/utils/wallpaper/devicePreview.js'

describe('设备预览的比例与生命周期', () => {
  it('电脑/手机设备分组独立，损坏偏好不会进入不存在的模式', () => {
    expect(getPreviewDevices('desktop').map(item => item.id)).toEqual(['laptop', 'tablet', 'fold2', 'fold3'])
    expect(normalizePreviewDevice('wide', 'mobile')).toBe('phone')
    expect(getPreviewMode('video', 'mobile')).toBe('mobile')
    expect(getPreviewMode('bing')).toBe('desktop')
  })
  it('本机比例来自CSS屏幕，不把DPR重复乘入布局，并拒绝无效尺寸', () => {
    expect(resolveScreenPreview({ width: 3440, height: 1440 })).toEqual({ device: 'monitor', ratio: 3440 / 1440 })
    expect(resolveScreenPreview({ width: 390, height: 844, touch: 5 }, 'mobile').device).toBe('phone')
    expect(resolveScreenPreview({ width: 1024, height: 768, touch: 5 }).device).toBe('tablet')
    expect(resolveScreenPreview({ width: NaN, height: 0 }, 'mobile').ratio).toBe(390 / 844)
  })
  it('折叠方向、平板横竖、宽屏分别保留自己的几何', () => {
    expect(getPreviewGeometry('fold2', 'mobile')).toMatchObject({ panels: 2, axis: 'x' })
    expect(getPreviewGeometry('fold3', 'desktop')).toMatchObject({ panels: 3, axis: 'y' })
    expect(getPreviewGeometry('tablet', 'desktop', 'portrait').ratio).toBeLessThan(1)
    expect(getPreviewGeometry('laptop', 'desktop', 'both', 1.5).ratio).toBe(1.5)
  })
  it('新动画取消旧动画，旧finished不会完成新状态，卸载可清理', async () => {
    const pending = []
    const element = { animate: vi.fn(() => { let resolve; const finished = new Promise(r => { resolve = r }); const a = { finished, cancel: vi.fn(resolve) }; pending.push({ ...a, resolve }); return a }) }
    const motion = createPreviewMotion()
    const first = motion.play([element], [{ opacity: 0 }, { opacity: 1 }], { duration: 200 })
    const next = motion.play([element], [], { duration: 200 })
    expect(await first).toBe(false)
    expect(pending[0].cancel).toHaveBeenCalled()
    motion.cancel()
    expect(await next).toBe(false)
    expect(pending[1].cancel).toHaveBeenCalled()
  })
})


describe('设备尺寸与位置衔接', () => {
  it.each([1, 0.8, 1.5])('笔记本至左侧平板的两端保持实际屏幕边界，舞台缩放%s', (scale) => {
    const bounds = { x: 80, y: 150, width: 800 * scale, height: 512 * scale }
    const viewport = (rect) => ({ x: bounds.x + rect.x * scale, y: bounds.y + rect.y * scale, width: rect.width * scale, height: rect.height * scale, borderRadius: '16px' })
    const oldRect = viewport({ x: 48, y: 36, width: 704, height: 440 })
    const newRect = viewport({ x: 24, y: 152, width: 424, height: 296 })
    const frames = buildFrameMorph(oldRect, newRect, bounds, { width: 800, height: 512 })
    for (const [index, expected] of [oldRect, newRect].entries()) {
      const actual = frames[index]
      expect(bounds.x + Number.parseFloat(actual.left) * scale).toBeCloseTo(expected.x)
      expect(bounds.y + Number.parseFloat(actual.top) * scale).toBeCloseTo(expected.y)
      expect(Number.parseFloat(actual.width) * scale).toBeCloseTo(expected.width)
      expect(Number.parseFloat(actual.height) * scale).toBeCloseTo(expected.height)
      expect(actual.transform).toBe('none')
      expect(actual.translate).toBe('none')
      expect(actual.right).toBe('auto')
      expect(actual.bottom).toBe('auto')
    }
    // 线性插值阶段的屏幕中心没有额外锚点偏移，也不会在开始阶段突然放大。
    const middle = Object.fromEntries(['left', 'top', 'width', 'height'].map(key => [key, (Number.parseFloat(frames[0][key]) + Number.parseFloat(frames[1][key])) / 2]))
    expect(bounds.x + (middle.left + middle.width / 2) * scale).toBeCloseTo((oldRect.x + oldRect.width / 2 + newRect.x + newRect.width / 2) / 2)
    expect(middle.width).toBeGreaterThan(424)
    expect(middle.width).toBeLessThan(704)
  })
})
