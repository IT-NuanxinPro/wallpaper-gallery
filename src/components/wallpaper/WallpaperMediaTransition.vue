<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMotionPreference } from '@/composables/useMotionPreference'
import { copyTransitionRect, isTransitionRectVisible, wallpaperTransition } from '@/utils/wallpaper/detailTransition'
import { playWallpaperTransition } from '@/utils/wallpaper/detailTransitionMotion'

const router = useRouter()
const reducedMotion = useMotionPreference()
const state = wallpaperTransition.state
const cover = ref(null)
const coverImage = ref(null)
const coverReady = ref(false)
const initialStyle = computed(() => state.value
  ? {
      left: `${state.value.context.rect.left}px`,
      top: `${state.value.context.rect.top}px`,
      width: `${state.value.context.rect.width}px`,
      height: `${state.value.context.rect.height}px`,
      borderRadius: state.value.context.radius || 0,
      opacity: coverReady.value ? 1 : 0,
    }
  : {})
let frame
let cancelMotion
let navigation

function cleanup() {
  cancelAnimationFrame(frame)
  frame = undefined
  cancelMotion?.()
  cancelMotion = undefined
}

function findDetailMedia(assetKey) {
  return [...document.querySelectorAll('[data-wallpaper-detail-media]')]
    .find(element => !assetKey || element.dataset.wallpaperDetailMedia === assetKey)
}

function readDetailSource() {
  const element = findDetailMedia()
  if (!element)
    return null
  const image = element.querySelector('img.is-ready, img.wallpaper-image-stage__placeholder')
  const video = element.querySelector('video')
  // 视频仅传递海报，绝不复制播放器、播放状态或原始视频文件。
  const currentSrc = video?.poster || (image?.complete && image.naturalWidth ? image.currentSrc || image.src : '')
  if (!currentSrc)
    return null
  const rect = element.getBoundingClientRect()
  if (!isTransitionRectVisible(rect))
    return null
  const media = video || image
  return {
    assetKey: element.dataset.wallpaperDetailMedia,
    currentSrc,
    rect: copyTransitionRect(rect),
    width: image?.naturalWidth || video?.videoWidth || rect.width,
    height: image?.naturalHeight || video?.videoHeight || rect.height,
    fit: getComputedStyle(media).objectFit || 'contain',
    radius: getComputedStyle(element).borderRadius,
  }
}

function findTarget(current) {
  const assetKey = current.context.assetKey
  const link = current.direction === 'back'
    ? [...document.querySelectorAll('[data-wallpaper-asset-key]')].find(element => element.dataset.wallpaperAssetKey === assetKey)
    : null
  const element = current.direction === 'back' ? link?.querySelector('.card-image') : findDetailMedia(assetKey)
  if (!element)
    return null
  const bounds = element.getBoundingClientRect()
  if (bounds.width <= 0 || bounds.height <= 0)
    return null
  const image = element.querySelector('img')
  if (current.direction === 'back' && (!image?.complete || !image.naturalWidth))
    return null
  const media = element.querySelector('.wallpaper-image-stage__image, video, img')
  return {
    assetKey,
    element,
    link,
    rect: copyTransitionRect(bounds),
    inViewport: isTransitionRectVisible(bounds),
    fit: media ? getComputedStyle(media).objectFit || 'contain' : 'contain',
    radius: getComputedStyle(element).borderRadius,
  }
}

function findReadyTarget() {
  const current = state.value
  if (current?.phase !== 'waiting')
    return
  if (coverImage.value?.complete && coverImage.value.naturalWidth)
    coverReady.value = true
  const target = coverReady.value ? findTarget(current) : null
  if (!target || !wallpaperTransition.targetReady(target))
    frame = requestAnimationFrame(findReadyTarget)
}

watch(state, async (current) => {
  cleanup()
  if (!current)
    return
  await nextTick()
  if (state.value !== current || reducedMotion.value)
    return
  if (current.phase === 'waiting') {
    frame = requestAnimationFrame(findReadyTarget)
    return
  }
  if (!cover.value || !coverImage.value) {
    wallpaperTransition.cancel()
    return
  }
  cancelMotion = playWallpaperTransition({
    cover: cover.value,
    image: coverImage.value,
    context: current.context,
    target: current.target,
    onComplete() {
      if (current.direction === 'back' && current.context.input === 'keyboard' && current.target.link?.isConnected && isTransitionRectVisible(current.target.link.getBoundingClientRect()))
        current.target.link.focus({ preventScroll: true })
      wallpaperTransition.finish()
    },
  })
}, { flush: 'sync' })

watch(() => state.value?.context.currentSrc, () => {
  coverReady.value = false
}, { flush: 'sync' })
watch(wallpaperTransition.focusTarget, async (request) => {
  if (!request?.ready)
    return
  await nextTick()
  if (wallpaperTransition.focusTarget.value !== request)
    return
  const link = [...document.querySelectorAll('[data-wallpaper-asset-key]')].find(element => element.dataset.wallpaperAssetKey === request.assetKey)
  const target = link && isTransitionRectVisible(link.getBoundingClientRect()) ? link : document.querySelector('[data-wallpaper-results]')
  target?.focus({ preventScroll: true })
  wallpaperTransition.focusTarget.value = null
})

const removeBefore = router.beforeEach((to, from) => {
  navigation = to
  wallpaperTransition.begin(to.fullPath, from.fullPath, from.name === 'WallpaperDetail' ? readDetailSource() : null, reducedMotion.value)
})
const removeAfter = router.afterEach((to, _from, failure) => {
  if (navigation !== to)
    return
  if (failure)
    wallpaperTransition.cancel()
  else
    wallpaperTransition.arrived(to.fullPath)
})
const removeError = router.onError(() => wallpaperTransition.cancel())
watch(reducedMotion, () => wallpaperTransition.cancel())
function handleResize() {
  wallpaperTransition.cancel()
}
onMounted(() => window.addEventListener('resize', handleResize, { passive: true }))
onBeforeUnmount(() => {
  removeBefore()
  removeAfter()
  removeError()
  window.removeEventListener('resize', handleResize)
  wallpaperTransition.dispose()
  cleanup()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="state" ref="cover" class="wallpaper-media-transition" :style="initialStyle" aria-hidden="true">
      <img ref="coverImage" :src="state.context.currentSrc" alt="" @load="coverReady = true" @error="wallpaperTransition.cancel()">
    </div>
  </Teleport>
</template>

<style scoped>
.wallpaper-media-transition {
  position: fixed;
  z-index: 1200;
  overflow: hidden;
  pointer-events: none;
  background: #101827;
  contain: layout paint;
}

.wallpaper-media-transition img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  object-fit: cover;
}
</style>
