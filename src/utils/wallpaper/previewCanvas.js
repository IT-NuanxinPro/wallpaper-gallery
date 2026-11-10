/** 仅更新内在像素；显示大小由预览容器的 CSS 决定，避免旧画布尺寸反向锁定布局。 */
export function resizePreviewCanvas(canvas, devicePixelRatio = 1) {
  const width = canvas?.parentElement?.clientWidth || 0
  const height = canvas?.parentElement?.clientHeight || 0
  if (width <= 0 || height <= 0)
    return null
  const dpr = Number.isFinite(devicePixelRatio) ? Math.max(1, Math.min(devicePixelRatio, 2)) : 1
  const pixelWidth = Math.max(1, Math.round(width * dpr))
  const pixelHeight = Math.max(1, Math.round(height * dpr))
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
  return { width, height, dpr }
}
