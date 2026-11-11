<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { FOLD_TIMING } from '@/utils/wallpaper/devicePreview'
import { convexHull, getDuoFoldPose, polygonCss, projectDuoPoint, roundedPanelPoints } from '@/utils/wallpaper/duoFold'

const props = defineProps({ src: { type: String, required: true }, axis: { type: String, default: 'y' } })
const emit = defineEmits(['prepared', 'finishProgress'])
const root = ref(null)
const fixed = ref(null)
const fixedTint = ref(null)
const moving = ref(null)
const slab = ref(null)
const outline = ref(null)
const rim = ref(null)
const bezel = ref(null)
const camera = ref(null)
const shade = ref(null)
const sheen = ref(null)
const ground = ref(null)
const blurLevels = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1]
const blurLayers = []
const canvases = []
let raf = 0
let revision = 0
let disposed = false
let settle
let preparation
let image
let width = 0
let height = 0
let radius = 0
let visibleBounds

function cancel() {
  revision++
  cancelAnimationFrame(raf)
  preparation?.cancel()
  preparation = null
  if (image)
    image.src = ''
  image = null
  settle?.(false)
  settle = null
  root.value?.classList.remove('is-prepared')
}
function freeTextures() {
  for (const canvas of canvases)
    canvas.width = canvas.height = 0
  canvases.length = 0
  blurLayers.forEach(layer => layer.remove())
  blurLayers.length = 0
  root.value?.querySelectorAll('canvas').forEach(canvas => canvas.remove())
}
function createTexture(scale, blur = 0) {
  const padding = 0.3
  const inset = 7
  const w = Math.max(1, Math.round((width - inset * 2) * scale))
  const h = Math.max(1, Math.round((height - inset * 2) * scale))
  const px = Math.ceil(w * padding)
  const py = Math.ceil(h * padding)
  const crop = document.createElement('canvas')
  crop.width = w
  crop.height = h
  const ctx = crop.getContext('2d')
  const ratio = Math.max(w / image.naturalWidth, h / image.naturalHeight)
  ctx.drawImage(image, (w - image.naturalWidth * ratio) / 2, (h - image.naturalHeight * ratio) / 2, image.naturalWidth * ratio, image.naturalHeight * ratio)
  // 镜像延伸边缘，磨砂模糊不会在透明边界吸入黑色。
  const extended = document.createElement('canvas')
  extended.width = w + 2 * px
  extended.height = h + 2 * py
  const context = extended.getContext('2d')
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      context.save()
      context.translate(px + x * w + (x > 0 ? w : 0), py + y * h + (y > 0 ? h : 0))
      context.scale(x ? -1 : 1, y ? -1 : 1)
      context.drawImage(crop, x < 0 ? -w : 0, y < 0 ? -h : 0)
      context.restore()
    }
  }
  crop.width = crop.height = 0
  let texture = extended
  if (blur > 0) {
    texture = document.createElement('canvas')
    texture.width = extended.width
    texture.height = extended.height
    const blurred = texture.getContext('2d')
    blurred.filter = `blur(${blur * scale}px) saturate(1.06)`
    blurred.drawImage(extended, 0, 0)
    extended.width = extended.height = 0
  }
  Object.assign(texture.style, {
    position: 'absolute',
    left: `${width * 0.3 + inset - px / scale}px`,
    top: `${height * 0.3 + inset - py / scale}px`,
    width: `${texture.width / scale}px`,
    height: `${texture.height / scale}px`,
    maxWidth: 'none',
  })
  canvases.push(texture)
  return texture
}
async function prepare(generation) {
  const source = new Image()
  image = source
  source.decoding = 'async'
  source.src = props.src
  let stop
  const cancelled = new Promise((resolve) => {
    stop = () => {
      source.src = ''
      resolve(false)
    }
  })
  const attempt = { cancel: stop }
  preparation = attempt
  const decoded = await Promise.race([source.decode().then(() => true), cancelled])
  if (preparation === attempt)
    preparation = null
  if (!decoded)
    return false
  if (disposed || generation !== revision || !root.value)
    return false
  freeTextures()
  const appearance = getComputedStyle(root.value)
  width = Number.parseFloat(appearance.width) || root.value.clientWidth
  height = Number.parseFloat(appearance.height) || root.value.clientHeight
  radius = Number.parseFloat(appearance.borderTopLeftRadius) || width * 0.046
  if (!width || !height)
    return false
  for (const amount of blurLevels) {
    const layer = document.createElement('span')
    layer.className = 'duo-surface__blur'
    layer.appendChild(createTexture(0.75, getDuoFoldPose(0.5, width, height, props.axis).maxBlur * amount))
    moving.value.insertBefore(layer, shade.value)
    blurLayers.push(layer)
  }
  return true
}
function draw(progress) {
  if (!root.value)
    return
  const pose = getDuoFoldPose(progress, width, height, props.axis)
  pose.radius = radius
  const half = pose.length / 2
  const margin = 7
  const depth = pose.front ? 0 : -pose.thickness
  const hingeRadius = pose.front ? 0 : pose.radius * 0.25
  const padX = width * 0.3
  const padY = height * 0.3
  const project = (points, z = depth) => points.map(([a, b]) => projectDuoPoint(pose, a, b, z))
  const shape = (inset, outer = pose.radius, inner = hingeRadius) => roundedPanelPoints(inset, inset, pose.front ? half + 1 - inset : half - inset * 2, pose.cross - inset * 2, Math.max(0, outer - inset), Math.max(0, inner - inset))
  // 静止半屏与整个已裁切图像一起平移，合拢时的半屏仍处于舞台中心。
  fixed.value.style.transform = props.axis === 'y' ? `translateX(${pose.shift}px)` : `translateY(${pose.shift}px)`
  const brightness = pose.front ? 0.7 + 0.3 * pose.cosine : 0.7 + 0.1 * pose.cosine
  fixedTint.value.style.opacity = String(1 - brightness)
  const hull = convexHull([...project(shape(0), 0), ...project(shape(0), -pose.thickness)])
  slab.value.style.clipPath = polygonCss(hull, padX, padY)
  slab.value.style.opacity = pose.frost > 0.002 ? '1' : '0'
  const fixedBounds = props.axis === 'y'
    ? [[width / 2 + pose.shift, 0], [width + pose.shift, height]]
    : [[0, height / 2 + pose.shift], [width, height + pose.shift]]
  const points = [...hull, ...fixedBounds]
  visibleBounds = { left: Math.min(...points.map(point => point[0])), top: Math.min(...points.map(point => point[1])), right: Math.max(...points.map(point => point[0])), bottom: Math.max(...points.map(point => point[1])) }
  const projection = project(shape(0))
  outline.value.style.clipPath = polygonCss(projection, padX, padY)
  rim.value.style.clipPath = polygonCss(project(shape(1)), padX, padY)
  bezel.value.style.clipPath = polygonCss(project(shape(3)), padX, padY)
  moving.value.style.clipPath = polygonCss(project(shape(margin)), padX, padY)
  rim.value.style.background = `color-mix(in srgb,#9a9fa6,#000 ${16 * pose.frost}%)`
  shade.value.style.opacity = String(pose.front ? 1 - brightness : 0.3 * pose.frost ** 2)
  const direction = props.axis === 'y' ? 'to right' : 'to bottom'
  const position = (fraction) => {
    const point = projectDuoPoint(pose, half - margin - fraction * (half - margin * 2), pose.cross / 2, depth)
    return props.axis === 'y' ? point[0] + padX : point[1] + padY
  }
  let previous = pose.frost > 0.0001 ? Math.sqrt(blurLevels[0] / 2 / pose.frost) : 10
  blurLayers.forEach((layer, index) => {
    const next = Math.max(previous + 0.02, pose.frost > 0.0001 ? Math.sqrt(blurLevels[index] / pose.frost) : 10)
    const a = position(previous)
    const b = position(next)
    const mask = a < b ? `linear-gradient(${direction},transparent ${a}px,#000 ${b}px)` : `linear-gradient(${direction},#000 ${b}px,transparent ${a}px)`
    layer.style.visibility = previous < 1 ? 'visible' : 'hidden'
    layer.style.maskImage = mask
    layer.style.webkitMaskImage = mask
    previous = next
  })
  sheen.value.style.opacity = String(0.15 * pose.frost)
  const hole = projectDuoPoint(pose, margin + 7, props.axis === 'y' ? margin + 7 : pose.cross - margin - 7, depth)
  camera.value.style.transform = `translate(${hole[0] - 2.5}px,${hole[1] - 2.5}px) scale(${props.axis === 'y' ? Math.max(0.08, Math.abs(pose.cosine)) : 1},${props.axis === 'x' ? Math.max(0.08, Math.abs(pose.cosine)) : 1})`
  camera.value.style.opacity = pose.front ? '0' : '1'
  ground.value.style.transform = props.axis === 'x'
    ? `translateY(${pose.shift}px)`
    : `scaleX(${0.5 + 0.5 * Math.max(0, pose.cosine)})`
  // 最后10%交给单张完整媒体，合页边缘和两半取样不会留在最终画面。
  const completion = Math.min(1, Math.max(0, (progress - 0.9) / 0.1))
  // 完整屏幕覆盖动画表面；互补透明度会让背景透过，造成收尾闪暗。
  emit('finishProgress', completion)
  root.value.dataset.progress = progress.toFixed(3)
}
async function play(beforeOpen) {
  cancel()
  const generation = revision
  try {
    if (!await prepare(generation))
      return false
  }
  catch {
    return !disposed && generation === revision // 备用纹理失败仍返回清晰原媒体。
  }
  if (disposed || generation !== revision)
    return false
  draw(0)
  root.value.classList.add('is-prepared')
  emit('prepared')
  if (beforeOpen)
    await beforeOpen()
  if (disposed || generation !== revision)
    return false
  return new Promise((resolve) => {
    settle = resolve
    const start = performance.now()
    const tick = (now) => {
      if (disposed || generation !== revision)
        return
      const progress = Math.min(1, Math.max(0, (now - start - FOLD_TIMING.delay) / FOLD_TIMING.fold2))
      draw(progress)
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      }
      else {
        settle = null
        resolve(true)
      }
    }
    raf = requestAnimationFrame(tick)
  })
}
onBeforeUnmount(() => {
  disposed = true
  cancel()
  freeTextures()
  if (image)
    image.src = ''
})
function getVisibleRect() {
  if (!root.value || !visibleBounds || !width || !height)
    return null
  const rect = root.value.getBoundingClientRect()
  return {
    x: rect.x + visibleBounds.left * rect.width / width,
    y: rect.y + visibleBounds.top * rect.height / height,
    width: (visibleBounds.right - visibleBounds.left) * rect.width / width,
    height: (visibleBounds.bottom - visibleBounds.top) * rect.height / height,
  }
}
function getEntryShape() {
  const rect = getVisibleRect()
  if (!rect)
    return null
  // 关闭时玻璃向前突出一个机身厚度，封面的尺寸和圆角都包含同一透视比例。
  const pose = getDuoFoldPose(0, width, height, props.axis)
  const scale = pose.perspective / (pose.perspective - pose.thickness) * root.value.getBoundingClientRect().width / width
  const outer = radius * scale
  const hinge = radius * 0.25 * scale
  const radii = props.axis === 'x' ? [hinge, hinge, outer, outer] : [hinge, outer, outer, hinge]
  return { ...rect, radii, inset: 7 * scale }
}
defineExpose({ play, cancel, getVisibleRect, getEntryShape })
</script>

<template>
  <div ref="root" class="duo-surface" :class="{ 'is-horizontal': axis === 'x' }" aria-hidden="true">
    <i ref="ground" class="duo-surface__ground" />
    <div ref="fixed" class="duo-surface__fixed">
      <img :src="src" alt="">
      <i ref="fixedTint" />
    </div>
    <div class="duo-surface__projection">
      <i ref="slab" class="duo-surface__slab" />
      <i ref="outline" class="duo-surface__outline" />
      <i ref="rim" class="duo-surface__rim" />
      <i ref="bezel" class="duo-surface__bezel" />
      <div ref="moving" class="duo-surface__window">
        <img class="duo-surface__clear" :src="src" alt="">
        <i ref="shade" class="duo-surface__shade" />
        <i ref="sheen" class="duo-surface__sheen" />
      </div>
    </div>
    <i ref="camera" class="duo-surface__camera" />
  </div>
</template>

<style src="./duo-fold.css"></style>
