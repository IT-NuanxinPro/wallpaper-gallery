import { expect, it } from 'vitest'
import { playWallpaperTransition } from '../src/utils/wallpaper/detailTransitionMotion.js'

function playback() {
  const target = { style: { visibility: 'visible' } }
  let complete
  const animator = {
    set(element, style) { Object.assign(element.style, style) },
    timeline(options) {
      complete = options.onComplete
      return { to() { return this }, kill() {} }
    },
  }
  const cover = { style: {} }
  const image = { style: {} }
  const cancel = playWallpaperTransition({
    cover, image, animator,
    context: { width: 1600, height: 1000, rect: { left: 20, top: 50, width: 240, height: 150 }, fit: 'cover' },
    target: { element: target, rect: { left: 40, top: 80, width: 800, height: 500 }, fit: 'contain' },
  })
  return { target, cover, image, cancel, complete: () => complete() }
}

it('覆盖层只在接管媒体时隐藏目标，取消后还原目标原来的可见样式', () => {
  const { target, cover, cancel } = playback()
  expect(target.style.visibility).toBe('hidden')
  expect(cover.style).toMatchObject({ left: 20, top: 50, width: 240, height: 150 })
  cancel()
  expect(target.style.visibility).toBe('visible')
  cancel()
  expect(target.style.visibility).toBe('visible')
})

it('正常完成同样恢复真实媒体，迟到的动画回调不会改变下一次可见性', () => {
  const { target, complete, cancel } = playback()
  complete()
  expect(target.style.visibility).toBe('visible')
  target.style.visibility = 'collapse'
  cancel()
  complete()
  expect(target.style.visibility).toBe('collapse')
})
