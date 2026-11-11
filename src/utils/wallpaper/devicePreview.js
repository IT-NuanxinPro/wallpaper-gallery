export const DESKTOP_PREVIEW_DEVICES = [
  { id: 'laptop', label: '笔记本' },
  { id: 'tablet', label: '平板' },
  { id: 'fold2', label: '双折叠 Duo' },
  { id: 'fold3', label: '三折叠' },
]
export const MOBILE_PREVIEW_DEVICES = [
  { id: 'phone', label: '手机' },
  { id: 'tablet', label: '平板' },
  { id: 'monitor', label: '竖屏显示器' },
  { id: 'fold2', label: '双折叠 Duo' },
]
export const FOLD_TIMING = { delay: 280, fold2: 2200, fold3: 2600 }

export function getPreviewMode(series, usage) {
  return series === 'mobile' || (series === 'video' && ['mobile', 'social-cover'].includes(usage)) ? 'mobile' : 'desktop'
}

export function getPreviewDevices(mode) {
  return mode === 'mobile' ? MOBILE_PREVIEW_DEVICES : DESKTOP_PREVIEW_DEVICES
}

export function normalizePreviewDevice(value, mode) {
  return getPreviewDevices(mode).some(device => device.id === value) ? value : mode === 'mobile' ? 'phone' : 'laptop'
}

export function resolveScreenPreview({ width, height, touch = 0 } = {}, mode = 'desktop') {
  const w = Number(width)
  const h = Number(height)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0 || w > 20000 || h > 20000)
    return { device: mode === 'mobile' ? 'phone' : 'laptop', ratio: mode === 'mobile' ? 390 / 844 : 16 / 10 }
  const ratio = w / h
  const device = mode === 'mobile'
    ? ratio < 0.65 ? 'phone' : ratio < 1 ? 'monitor' : 'tablet'
    : touch > 0 && Math.min(w, h) >= 600 ? 'tablet' : 'monitor'
  return { device, ratio: Math.min(3.5, Math.max(0.4, ratio)) }
}

export function getPreviewGeometry(device, mode, tabletLayout = 'both', screenRatio = 0) {
  const mobile = mode === 'mobile'
  const ratios = { laptop: 16 / 10, tablet: mobile || tabletLayout === 'portrait' ? 38 / 54.3 : 53 / 37, fold2: mobile ? 45 / 63 : 78.2 / 56, fold3: 78 / 55, phone: 390 / 844, monitor: mobile ? 9 / 16 : 16 / 9 }
  return { ratio: screenRatio || ratios[device] || ratios.laptop, panels: device === 'fold3' ? 3 : device === 'fold2' ? 2 : 1, axis: mobile && device === 'fold2' ? 'x' : 'y' }
}

/** 将屏幕矩形转换为固定舞台坐标，尺寸变化不再触发布局居中补偿。 */
export function buildFrameMorph(previous, current, bounds, size = bounds) {
  const scaleX = bounds.width / (size.width || bounds.width)
  const scaleY = bounds.height / (size.height || bounds.height)
  return [previous, current].map(rect => ({
    left: `${(rect.x - bounds.x) / scaleX}px`,
    top: `${(rect.y - bounds.y) / scaleY}px`,
    width: `${rect.width / scaleX}px`,
    height: `${rect.height / scaleY}px`,
    right: 'auto',
    bottom: 'auto',
    transform: 'none',
    translate: 'none',
    borderRadius: rect.borderRadius,
  }))
}

/** 统一管理动画取消，连续切换和卸载不会留下旧动画回调。 */
export function createPreviewMotion() {
  let animations = []
  let revision = 0
  function cancel() {
    revision++
    for (const animation of animations)
      animation.cancel()
    animations = []
  }
  async function play(elements, frames, options) {
    cancel()
    const current = revision
    animations = elements.filter(element => typeof element?.animate === 'function').map((element, index) => element.animate(typeof frames === 'function' ? frames(index) : frames, options))
    await Promise.allSettled(animations.map(animation => animation.finished))
    if (current !== revision)
      return false
    animations.forEach(animation => animation.cancel())
    animations = []
    return true
  }
  return { play, cancel }
}
