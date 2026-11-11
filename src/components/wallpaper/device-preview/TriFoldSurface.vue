<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { FOLD_TIMING } from '@/utils/wallpaper/devicePreview'
import { getTriFoldPose } from '@/utils/wallpaper/duoFold'

defineProps({ src: { type: String, required: true } })
const emit = defineEmits(['prepared', 'finishProgress'])
const root = ref(null)
const left = ref(null)
const right = ref(null)
const frontCover = ref(null)
let raf = 0
let revision = 0
let settle
let disposed = false
function cancel() {
  revision++
  cancelAnimationFrame(raf)
  settle?.(false)
  settle = null
}
function draw(progress) {
  const pose = getTriFoldPose(progress)
  const thickness = root.value.clientWidth * 0.008
  left.value.style.transform = `translateZ(${thickness * (pose.left / 180)}px) rotateY(${pose.left}deg)`
  right.value.style.transform = `translateZ(${thickness * (-pose.right / 180) / 2}px) rotateY(${pose.right}deg)`
  left.value.style.setProperty('--panel-shade', Math.sin(pose.left * Math.PI / 180) * 0.3)
  right.value.style.setProperty('--panel-shade', Math.sin(-pose.right * Math.PI / 180) * 0.3)
  // 合拢的背板是圆角，下面的固定屏幕也必须同步收角；否则会在背板四角外露出方形边框。
  // 离开背面阶段后逐步归零，使完全展开的三屏仍能无缝拼成一张图。
  const coveredCorner = angle => Math.min(1, Math.max(0, (angle - 100) / 60))
  root.value.style.setProperty('--center-left-corner', coveredCorner(pose.left))
  root.value.style.setProperty('--center-right-corner', coveredCorner(-pose.right))
  root.value.dataset.progress = progress.toFixed(3)
  emit('finishProgress', pose.completion)
}
async function play(beforeOpen) {
  cancel()
  const generation = revision
  if (!root.value || disposed)
    return false
  draw(0)
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
      const progress = Math.min(1, Math.max(0, (now - start - FOLD_TIMING.delay) / FOLD_TIMING.fold3))
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
})
function getVisibleRect() {
  if (!root.value)
    return null
  const bounds = [...root.value.querySelectorAll('.tri-surface__panel')].map(panel => panel.getBoundingClientRect())
  const x = Math.min(...bounds.map(rect => rect.left))
  const y = Math.min(...bounds.map(rect => rect.top))
  return { x, y, width: Math.max(...bounds.map(rect => rect.right)) - x, height: Math.max(...bounds.map(rect => rect.bottom)) - y }
}
function getEntryShape() {
  if (!frontCover.value)
    return null
  const element = frontCover.value
  const rect = element.getBoundingClientRect()
  const appearance = getComputedStyle(element)
  const scale = rect.width / (Number.parseFloat(appearance.width) || element.offsetWidth)
  // 这层封面有2px外沿；移动层也包含外沿，交接时不再跳尺寸或补方角。
  const edge = 2 * scale
  const radii = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(corner => Number.parseFloat(appearance[`border${corner}Radius`]) * scale + edge)
  return { x: rect.x - edge, y: rect.y - edge, width: rect.width + edge * 2, height: rect.height + edge * 2, radii, inset: 9 * scale }
}
defineExpose({ play, cancel, getVisibleRect, getEntryShape })
</script>

<template>
  <div ref="root" class="tri-surface" :style="{ '--fold-image': `url(${JSON.stringify(src)})` }" aria-hidden="true">
    <div class="tri-surface__panel tri-surface__center">
      <div class="tri-surface__front">
        <div class="tri-surface__texture" />
      </div>
    </div>
    <div ref="right" class="tri-surface__panel tri-surface__right">
      <div class="tri-surface__front">
        <div class="tri-surface__texture" />
      </div>
      <div class="tri-surface__back tri-surface__brand">
        <svg class="tri-surface__mountains" viewBox="0 0 180 500" preserveAspectRatio="none"><path d="M-30 440 90 240 230 460M-40 370 35 270 210 500M-20 490 65 340 170 480" /></svg>
        <img src="/favicon.svg" alt=""><span>Wallpaper<br>Gallery</span>
      </div>
    </div>
    <div ref="left" class="tri-surface__panel tri-surface__left">
      <div class="tri-surface__front">
        <div class="tri-surface__texture" />
      </div>
      <div ref="frontCover" class="tri-surface__back tri-surface__cover">
        <i />
      </div>
    </div>
  </div>
</template>

<style src="./tri-fold.css"></style>
