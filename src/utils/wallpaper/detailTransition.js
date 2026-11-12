import { shallowRef } from 'vue'

function validRect(rect) {
  return rect && ['left', 'top', 'width', 'height'].every(key => Number.isFinite(rect[key])) && rect.width > 0 && rect.height > 0
}

function internalPath(path) {
  return typeof path === 'string' && /^\/(?!\/)/.test(path) && !Array.from(path).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
}

export function fitTransitionImage(rect, width, height, fit = 'contain') {
  const scale = (fit === 'cover' ? Math.max : Math.min)(rect.width / width, rect.height / height)
  const imageWidth = width * scale
  const imageHeight = height * scale
  return { left: (rect.width - imageWidth) / 2, top: (rect.height - imageHeight) / 2, width: imageWidth, height: imageHeight }
}

export function createWallpaperTransition() {
  const state = shallowRef(null)
  const focusTarget = shallowRef(null)
  let pending = null
  let origin = null
  let timeout

  function cancel() {
    clearTimeout(timeout)
    timeout = undefined
    state.value = null
  }

  function capture(context) {
    pending = null
    if (!context?.assetKey || !context.currentSrc || !validRect(context.rect) || !(context.width > 0 && context.height > 0) || !internalPath(context.from) || !internalPath(context.to))
      return false
    pending = { ...context, rect: { ...context.rect }, capturedAt: Date.now() }
    return true
  }

  function begin(to, from, source = null, reducedMotion = false) {
    cancel()
    focusTarget.value = null
    const candidate = pending
    pending = null
    let context
    let direction
    if (candidate?.from === from && candidate.to === to && Date.now() - candidate.capturedAt < 1500) {
      origin = candidate
      context = candidate
      direction = 'forward'
    }
    else if (origin?.to === from && origin.from === to) {
      if (origin.input === 'keyboard')
        focusTarget.value = { assetKey: origin.assetKey, path: to, ready: false }
      if (source?.currentSrc && validRect(source.rect) && (!source.assetKey || source.assetKey === origin.assetKey)) {
        context = { ...origin, ...source, input: origin.input, from, to, assetKey: origin.assetKey }
        direction = 'back'
      }
    }
    else {
      origin = null
    }
    if (!context || reducedMotion)
      return
    state.value = { phase: 'waiting', direction, context, arrived: false, restored: direction !== 'back' }
    // 视觉交接有严格上限；加载和滚动恢复仍按各自的真实生命周期继续。
    timeout = setTimeout(cancel, 450)
  }

  function arrived(path) {
    if (state.value?.context.to === path)
      state.value = { ...state.value, arrived: true }
  }

  function browseRestored(path) {
    if (focusTarget.value?.path === path)
      focusTarget.value = { ...focusTarget.value, ready: true }
    if (state.value?.direction === 'back' && state.value.context.to === path)
      state.value = { ...state.value, restored: true }
  }

  function targetReady(target) {
    const current = state.value
    if (current?.phase !== 'waiting' || !current.arrived || !current.restored || target?.assetKey !== current.context.assetKey || !validRect(target.rect)
      || (current.direction === 'back' && target.inViewport !== true)) {
      return false
    }
    clearTimeout(timeout)
    timeout = undefined
    state.value = { ...current, phase: 'running', target }
    return true
  }

  function preview(assetKey, path) {
    return origin?.assetKey === assetKey && origin.to === path ? origin.currentSrc : ''
  }

  function dispose() {
    cancel()
    pending = null
    origin = null
    focusTarget.value = null
  }

  return { state, focusTarget, capture, begin, arrived, browseRestored, targetReady, preview, finish: cancel, cancel, dispose }
}

export const wallpaperTransition = createWallpaperTransition()

export function captureWallpaperTransition({ assetKey, from, to, element, event }) {
  if (event?.metaKey || event?.ctrlKey || event?.shiftKey || event?.altKey || (event?.button && event.button !== 0))
    return false
  const image = element?.querySelector?.('.card-image img') || element?.querySelector?.('img')
  if (!image?.complete || !image.naturalWidth)
    return false
  const frame = element.querySelector?.('.card-image') || image
  const bounds = frame.getBoundingClientRect()
  if (!isTransitionRectVisible(bounds))
    return false
  return wallpaperTransition.capture({
    assetKey,
    from,
    to,
    currentSrc: image.currentSrc || image.src,
    rect: copyTransitionRect(bounds),
    width: image.naturalWidth,
    height: image.naturalHeight,
    input: event?.detail === 0 ? 'keyboard' : 'pointer',
    fit: 'cover',
    radius: typeof getComputedStyle === 'function' ? getComputedStyle(frame).borderRadius : '0px',
  })
}

export function copyTransitionRect(rect) {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

export function isTransitionRectVisible(rect) {
  return validRect(rect) && rect.top < window.innerHeight && rect.left < window.innerWidth && rect.top + rect.height > 0 && rect.left + rect.width > 0
}

export function getWallpaperTransitionPreview(assetKey, path) {
  return wallpaperTransition.preview(assetKey, path)
}

export function notifyWallpaperBrowseRestored(path) {
  wallpaperTransition.browseRestored(path)
}
