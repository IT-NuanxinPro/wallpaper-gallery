const clamp = value => Math.min(1, Math.max(0, value))

// CSS ease-in-out 的同一时间曲线；用弦中点求解横轴，保持两种铰链节奏一致。
export function easeInOut(progress) {
  let low = 0
  let high = 1
  let t = progress
  for (let step = 0; step < 14; step++) {
    t = (low + high) / 2
    const x = 3 * (1 - t) ** 2 * t * 0.42 + 3 * (1 - t) * t ** 2 * 0.58 + t ** 3
    if (x < progress)
      low = t
    else
      high = t
  }
  return progress <= 0 ? 0 : progress >= 1 ? 1 : 3 * (1 - t) * t ** 2 + t ** 3
}

/** 两扇依次展开：左扇先行，右扇从总时长的40%开始。 */
export function getTriFoldPose(progress) {
  const phase = clamp(progress)
  return {
    left: 180 * (1 - easeInOut(clamp(phase / 0.58))),
    right: -180 * (1 - easeInOut(clamp((phase - 0.4) / 0.6))),
    completion: clamp((phase - 0.9) / 0.1),
  }
}

export function getDuoFoldPose(progress, width, height, axis = 'y') {
  const phase = clamp(progress)
  const angle = Math.PI * (1 - easeInOut(phase))
  const length = axis === 'y' ? width : height
  const cross = axis === 'y' ? height : width
  const sine = Math.sin(angle)
  const cosine = Math.cos(angle)
  return {
    phase,
    axis,
    width,
    height,
    length,
    cross,
    sine,
    cosine,
    front: cosine >= 0,
    shift: cosine < 0 ? length * cosine / 4 : 0,
    perspective: length * (axis === 'y' ? 3.1 : 5.2),
    thickness: length * (axis === 'y' ? 0.025 : 0.0254),
    radius: length * 0.046,
    rim: Math.max(1, length * 0.00575),
    bezel: Math.max(2, length * 0.0073),
    frost: Math.max(0, sine),
    maxBlur: length * 0.045,
  }
}

/** 投影的是玻璃边界，纹理保持在屏幕平面上；不把图像当作金属背板翻转。 */
export function projectDuoPoint(pose, along, across, depth = 0) {
  const hinge = pose.length / 2
  const relative = along - hinge
  const z = -relative * pose.sine + depth * pose.cosine
  const scale = pose.perspective / (pose.perspective - z)
  const a = hinge + (pose.shift + relative * pose.cosine + depth * pose.sine) * scale
  const b = pose.cross / 2 + (across - pose.cross / 2) * scale
  return pose.axis === 'y' ? [a, b] : [b, a]
}

export function roundedPanelPoints(x, y, width, height, outerRadius, hingeRadius = 0) {
  const left = Math.min(outerRadius, width / 2, height / 2)
  const right = Math.min(hingeRadius, width / 2, height / 2)
  const corners = [
    [x + left, y + left, left, Math.PI],
    [x + width - right, y + right, right, Math.PI * 1.5],
    [x + width - right, y + height - right, right, 0],
    [x + left, y + height - left, left, Math.PI * 0.5],
  ]
  return corners.flatMap(([cx, cy, radius, start]) => Array.from({ length: 9 }, (_, index) => {
    const angle = start + Math.PI / 2 * index / 8
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]
  }))
}

export function polygonCss(points, padX = 0, padY = 0) {
  return `polygon(${points.map(([x, y]) => `${(x + padX).toFixed(3)}px ${(y + padY).toFixed(3)}px`).join(',')})`
}

export function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const half = (input) => {
    const result = []
    for (const point of input) {
      while (result.length > 1 && cross(result.at(-2), result.at(-1), point) <= 0)
        result.pop()
      result.push(point)
    }
    return result.slice(0, -1)
  }
  return [...half(sorted), ...half(sorted.reverse())]
}
