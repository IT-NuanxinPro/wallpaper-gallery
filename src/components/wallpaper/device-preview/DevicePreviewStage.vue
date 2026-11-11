<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { buildFrameMorph, createPreviewMotion, getPreviewDevices, getPreviewGeometry, normalizePreviewDevice, resolveScreenPreview } from '@/utils/wallpaper/devicePreview'
import DevicePreviewToolbar from './DevicePreviewToolbar.vue'
import DuoFoldSurface from './DuoFoldSurface.vue'
import TriFoldSurface from './TriFoldSurface.vue'

const props = defineProps({ mode: { type: String, default: 'desktop' }, src: { type: String, default: '' }, alt: { type: String, default: '' }, ready: Boolean })
const selected = ref(props.mode === 'mobile' ? 'phone' : 'laptop')
const tabletLayout = ref('both')
const follow = ref(false)
const screen = ref({})
const stage = ref(null)
const frame = ref(null)
const screenFrame = ref(null)
const cover = ref(null)
const coverImage = ref(null)
const coverImageStyle = ref({})
const coverStyle = ref({})
const changing = ref(false)
const folding = ref(false)
const foldSurface = ref(null)
const foldPrepared = ref(false)
const foldFinish = ref(0)
const reducedMotion = ref(false)
const clock = ref('')
const motion = createPreviewMotion()
let mediaQuery
let clockTimer
let transitionRevision = 0
let mounted = false
const devices = computed(() => getPreviewDevices(props.mode))
const screenMatch = computed(() => resolveScreenPreview(screen.value, props.mode))
const device = computed(() => follow.value ? screenMatch.value.device : selected.value)
const geometry = computed(() => getPreviewGeometry(device.value, props.mode, tabletLayout.value, follow.value ? screenMatch.value.ratio : 0))
const splitTablet = computed(() => device.value === 'tablet' && props.mode === 'desktop' && tabletLayout.value === 'both' && !follow.value)
const style = computed(() => ({ '--device-ratio': geometry.value.ratio }))
const isFold = computed(() => ['fold2', 'fold3'].includes(device.value))

function readScreen() {
  stopMotion()
  screen.value = { width: window.screen.width, height: window.screen.height, touch: navigator.maxTouchPoints }
}
function stopMotion() {
  transitionRevision++
  motion.cancel()
  foldSurface.value?.cancel?.()
  changing.value = false
  folding.value = false
  foldPrepared.value = false
  foldFinish.value = 0
}
function currentRect() {
  const element = changing.value ? cover.value : frame.value
  if (!element)
    return null
  const rect = (folding.value && foldPrepared.value && !changing.value ? foldSurface.value?.getVisibleRect?.() : null) || element.getBoundingClientRect()
  const appearance = getComputedStyle(element)
  const imageElement = changing.value ? coverImage.value : screenFrame.value
  const screenAppearance = imageElement && getComputedStyle(imageElement)
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    borderRadius: appearance.borderRadius,
    screenRadius: screenAppearance?.borderRadius,
    screenBorder: screenAppearance && ['Top', 'Right', 'Bottom', 'Left'].map(side => screenAppearance[`border${side}Width`]),
  }
}
async function morphFrom(previous) {
  const revision = transitionRevision
  await nextTick()
  if (!mounted || revision !== transitionRevision || !previous || !frame.value || reducedMotion.value)
    return
  const current = currentRect()
  const bounds = stage.value.getBoundingClientRect()
  if (!current.width || !current.height || !bounds.width || !bounds.height)
    return
  // 固定到舞台坐标再同时插值位置与尺寸；布局不再随着width变化二次移动锚点。
  const stageStyle = getComputedStyle(stage.value)
  const frames = buildFrameMorph(previous, current, bounds, { width: Number.parseFloat(stageStyle.width), height: Number.parseFloat(stageStyle.height) })
  const elements = [frame.value]
  const keyframes = [frames]
  if (screenFrame.value && previous.screenBorder) {
    elements.push(screenFrame.value)
    keyframes.push([previous, current].map(value => ({
      borderRadius: value.screenRadius,
      ...Object.fromEntries(['Top', 'Right', 'Bottom', 'Left'].map((side, index) => [`border${side}Width`, value.screenBorder[index]])),
    })))
  }
  await motion.play(elements, index => keyframes[index], { duration: 500, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'both' })
}
function prepareCover(previous) {
  if (!previous || !stage.value || reducedMotion.value)
    return
  const bounds = stage.value.getBoundingClientRect()
  const stageStyle = getComputedStyle(stage.value)
  coverStyle.value = buildFrameMorph(previous, previous, bounds, { width: Number.parseFloat(stageStyle.width), height: Number.parseFloat(stageStyle.height) })[0]
  coverImageStyle.value = { borderRadius: previous.screenRadius || previous.borderRadius }
  changing.value = true
}
async function shrinkToCover(revision) {
  if (!changing.value || !frame.value || !cover.value)
    return
  const entry = foldSurface.value?.getEntryShape?.()
  if (!entry)
    return
  const bounds = stage.value.getBoundingClientRect()
  const stageStyle = getComputedStyle(stage.value)
  const size = { width: Number.parseFloat(stageStyle.width), height: Number.parseFloat(stageStyle.height) }
  const scale = bounds.width / (size.width || bounds.width)
  const target = {
    ...entry,
    borderRadius: entry.radii.map(radius => `${radius / scale}px`).join(' '),
  }
  const targetFrame = buildFrameMorph(target, target, bounds, size)[0]
  const targetImage = {
    inset: `${entry.inset / scale}px`,
    width: `calc(100% - ${entry.inset * 2 / scale}px)`,
    height: `calc(100% - ${entry.inset * 2 / scale}px)`,
    borderRadius: entry.radii.map(radius => `${Math.max(0, radius - entry.inset) / scale}px`).join(' '),
  }
  const frames = [
    [coverStyle.value, targetFrame],
    [coverImageStyle.value, targetImage],
  ]
  await motion.play([cover.value, coverImage.value], index => frames[index], { duration: 420, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'both' })
  if (mounted && revision === transitionRevision)
    changing.value = false
}
async function startFold(previous) {
  if (!mounted || !stage.value || !isFold.value || !props.ready || reducedMotion.value)
    return
  prepareCover(previous)
  folding.value = true
  const revision = transitionRevision
  await nextTick()
  if (!mounted || revision !== transitionRevision)
    return
  const finished = await foldSurface.value?.play?.(() => shrinkToCover(revision))
  if (finished && mounted && revision === transitionRevision) {
    folding.value = false
    changing.value = false
  }
}
function replay() {
  const previous = currentRect()
  stopMotion()
  return startFold(previous)
}
async function selectDevice(value) {
  const previous = currentRect()
  stopMotion()
  follow.value = false
  selected.value = normalizePreviewDevice(value, props.mode)
  if (isFold.value && props.ready && !reducedMotion.value)
    await startFold(previous)
  else
    await morphFrom(previous)
}
function selectLayout(value) {
  const previous = currentRect()
  stopMotion()
  tabletLayout.value = value
  morphFrom(previous)
}
function toggleFollow() {
  const previous = currentRect()
  readScreen()
  follow.value = !follow.value
  if (isFold.value && props.ready && !reducedMotion.value)
    startFold(previous)
  else
    morphFrom(previous)
}
function motionChanged() {
  reducedMotion.value = mediaQuery.matches
  if (reducedMotion.value)
    stopMotion()
}
function updateClock() {
  clock.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}
watch(() => props.mode, () => {
  stopMotion()
  selected.value = normalizePreviewDevice('', props.mode)
  follow.value = false
  tabletLayout.value = 'both'
})
watch(() => props.src, stopMotion)
watch(() => props.ready, (ready) => {
  if (!ready)
    stopMotion()
  else if (mounted && isFold.value)
    replay()
})
onMounted(() => {
  mounted = true
  readScreen()
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionChanged()
  mediaQuery.addEventListener('change', motionChanged)
  window.addEventListener('resize', readScreen, { passive: true })
  window.screen.orientation?.addEventListener('change', readScreen)
  updateClock()
  clockTimer = setInterval(updateClock, 60000)
})
onBeforeUnmount(() => {
  mounted = false
  stopMotion()
  clearInterval(clockTimer)
  mediaQuery?.removeEventListener('change', motionChanged)
  window.removeEventListener('resize', readScreen)
  window.screen.orientation?.removeEventListener('change', readScreen)
})
</script>

<template>
  <div class="device-preview" :class="{ 'is-mobile-preview': mode === 'mobile', 'is-follow': follow, 'is-folding': folding, 'is-changing': changing, 'is-reduced-motion': reducedMotion }" :style="style" :data-device="device">
    <div ref="stage" class="device-preview__stage">
      <div class="device-preview__arrangement" :class="{ 'is-paired': splitTablet }">
        <div ref="frame" class="preview-frame" :class="[`preview-frame--${device}`, { 'is-portrait-tablet': tabletLayout === 'portrait' && !follow }]">
          <div class="preview-frame__shell" :style="folding && foldPrepared ? { opacity: foldFinish } : undefined">
            <div ref="screenFrame" class="preview-frame__screen">
              <slot />
              <span v-if="device === 'phone'" class="preview-frame__island" aria-hidden="true" />
              <span v-if="device === 'phone' && clock" class="preview-frame__clock" aria-hidden="true">{{ clock }}</span>
              <span v-if="device === 'phone'" class="preview-frame__home" aria-hidden="true" />
            </div>
            <span class="preview-frame__camera" aria-hidden="true" />
          </div>
          <DuoFoldSurface v-if="folding && device === 'fold2'" ref="foldSurface" :src="src" :axis="geometry.axis" @prepared="foldPrepared = true" @finish-progress="foldFinish = $event" />
          <TriFoldSurface v-if="folding && device === 'fold3'" ref="foldSurface" :src="src" @prepared="foldPrepared = true" @finish-progress="foldFinish = $event" />
          <span class="preview-frame__base" :class="{ 'is-visible': device === 'laptop' }" aria-hidden="true" />
          <span class="preview-frame__stand" :class="{ 'is-visible': device === 'monitor' }" aria-hidden="true" />
        </div>
        <div class="preview-frame preview-frame--tablet preview-frame--secondary" :class="{ 'is-visible': splitTablet }" aria-hidden="true">
          <div class="preview-frame__shell">
            <div class="preview-frame__screen">
              <img :src="src" alt="" decoding="async">
            </div><span class="preview-frame__camera" />
          </div>
        </div>
      </div>
      <div v-show="changing" ref="cover" class="device-transition-cover" :style="coverStyle" aria-hidden="true">
        <img ref="coverImage" :src="src" :style="coverImageStyle" alt="">
      </div>
      <p class="device-preview__caption" :class="{ 'is-visible': follow }" :aria-hidden="!follow">
        按本机屏幕预览 · {{ screen.width }} × {{ screen.height }}
      </p>
    </div>
    <DevicePreviewToolbar :devices="devices" :selected="device" :follow="follow" :vertical="mode === 'mobile'" :tablet-layout="tabletLayout" :folding="folding" @select="selectDevice" @follow="toggleFollow" @layout="selectLayout" @replay="replay" />
  </div>
</template>

<style src="./device-preview.css"></style>
