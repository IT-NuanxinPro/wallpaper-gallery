import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

const { descriptor } = parse(readFileSync(new URL('../src/components/wallpaper/VideoWallpaperPlayer.vue', import.meta.url), 'utf8'))
const { content } = compileScript(descriptor, { id: 'video-player-test', inlineTemplate: true })
// 隔离 LoadingSurface 的 DOM 转场；验证播放器传入的真实 busy 状态和自身操作反馈。
const LoadingSurface = { props: ['busy'], setup: (props, { slots }) => () => Vue.h('section', { 'aria-busy': props.busy }, slots.default?.()) }
const source = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]vue['"]/g, (_, names) => `const {${names.replace(/\bas\b/g, ':')}} = Vue`)
  .replace(/import LoadingSurface from [^\n]+/, '')
  .replace('export default', 'return')
const Player = new Function('Vue', 'LoadingSurface', source)(Vue, LoadingSurface)
const apps = []
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.useRealTimers() })

async function mountPlayer(play = () => Promise.resolve()) {
  const elements = []
  const renderer = Vue.createRenderer({
    createElement(tag) {
      const element = Vue.markRaw({ tag, props: {}, children: [], parent: null, play, pause() {}, load() {}, removeAttribute() {} })
      elements.push(element)
      return element
    },
    createText: text => ({ text }), createComment: text => ({ text }), insertStaticContent: () => [{}, {}],
    insert(element, parent) { element.parent = parent; parent.children?.push(element) },
    remove(element) {
      const detach = node => { node.removed = true; node.children?.forEach(detach) }
      detach(element)
    },
    setText: (element, text) => { element.text = text },
    setElementText: (element, text) => { element.text = text },
    patchProp: (element, key, _old, value) => { element.props[key] = value },
    parentNode: element => element.parent, nextSibling: () => null,
  })
  const src = Vue.ref('/first.mp4')
  const poster = Vue.ref('/first.webp')
  const app = renderer.createApp({ render: () => Vue.h(Player, { src: src.value, poster: poster.value, controls: false }) })
  app.mount({ children: [] })
  apps.push(app)
  await Vue.nextTick()
  await Promise.resolve()
  await Vue.nextTick()
  return { elements, src, poster, video: () => elements.findLast(element => element.tag === 'video' && !element.removed), busy: () => elements.find(element => element.tag === 'section')?.props['aria-busy'], feedback: () => elements.filter(element => element.props?.role === 'status' && !element.removed) }
}

it('首次playing隐藏加载，循环waiting与stalled不再遮挡视频', async () => {
  const player = await mountPlayer()
  expect(player.busy()).toBe(true)
  player.video().props.onCanplay({ target: player.video() })
  await Vue.nextTick()
  expect(player.busy()).toBe(true)
  expect(player.video().props.onPlaying).toBeTypeOf('function')
  player.video().props.onPlaying({ target: player.video() })
  await Vue.nextTick()
  expect(player.busy()).toBe(false)
  for (let loop = 0; loop < 3; loop++) {
    player.video().props.onWaiting({ target: player.video() })
    player.video().props.onStalled({ target: player.video() })
    await Vue.nextTick()
    expect(player.busy()).toBe(false)
    expect(player.feedback()).toHaveLength(0)
    player.video().props.onPlaying({ target: player.video() })
    await Vue.nextTick()
    expect(player.busy()).toBe(false)
  }
})

it('已经播放的源仅更新海报时不会重建视频或恢复首次加载', async () => {
  const player = await mountPlayer()
  const video = player.video()
  video.props.onPlaying({ target: video })
  await Vue.nextTick()
  player.poster.value = '/updated.webp'
  await Vue.nextTick()
  await Vue.nextTick()
  expect(player.video()).toBe(video)
  expect(player.busy()).toBe(false)
})

it('切换到新视频后重新显示首次加载，播放后再次缓冲也不显示', async () => {
  const player = await mountPlayer()
  player.video().props.onPlaying({ target: player.video() })
  await Vue.nextTick()
  player.src.value = '/second.mp4'
  await Vue.nextTick()
  await Vue.nextTick()
  expect(player.busy()).toBe(true)
  player.video().props.onPlaying({ target: player.video() })
  player.video().props.onWaiting({ target: player.video() })
  await Vue.nextTick()
  expect(player.busy()).toBe(false)
  expect(player.feedback()).toHaveLength(0)
})

it('播放后的持续断流仍可重试，但重试不重复显示首次加载遮罩', async () => {
  vi.useFakeTimers()
  const player = await mountPlayer()
  player.video().props.onPlaying({ target: player.video() })
  player.video().props.onWaiting({ target: player.video() })
  await vi.advanceTimersByTimeAsync(21000)
  await Vue.nextTick()
  expect(player.busy()).toBe(false)
  const retry = player.elements.find(element => element.tag === 'button' && !element.removed)
  expect(retry?.text).toContain('重新播放')
  await retry.props.onClick()
  await Vue.nextTick()
  expect(player.busy()).toBe(false)
  expect(player.feedback()).toHaveLength(0)
})

it('自动播放被拒绝时结束加载并显示可手动播放的按钮', async () => {
  let blocked = true
  const player = await mountPlayer(() => blocked ? Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })) : Promise.resolve())
  expect(player.busy()).toBe(false)
  const button = player.elements.find(element => element.tag === 'button' && !element.removed)
  expect(button?.text).toContain('播放')
  blocked = false
  await button.props.onClick()
  await Vue.nextTick()
  expect(player.busy()).toBe(true)
  player.video().props.onPlaying({ target: player.video() })
  await Vue.nextTick()
  expect(player.busy()).toBe(false)
})

it('源切换后旧 play 拒绝不会覆盖新视频已播放状态', async () => {
  let rejectOld
  let calls = 0
  const player = await mountPlayer(() => ++calls === 1 ? new Promise((resolve, reject) => { rejectOld = reject }) : Promise.resolve())
  player.src.value = '/second.mp4'
  await Vue.nextTick()
  await Vue.nextTick()
  player.video().props.onPlaying?.({ target: player.video() })
  await Vue.nextTick()
  rejectOld(Object.assign(new Error('old denied'), { name: 'NotAllowedError' }))
  await Promise.resolve()
  await Vue.nextTick()
  expect(player.busy()).toBe(false)
  expect(player.elements.filter(element => element.tag === 'button' && !element.removed)).toHaveLength(0)
})

it('网络挂起只等待有限时间，重复 stalled 不会延后可重试反馈', async () => {
  vi.useFakeTimers()
  const player = await mountPlayer(() => new Promise(() => {}))
  await vi.advanceTimersByTimeAsync(15000)
  player.video().props.onStalled?.({ target: player.video() })
  await vi.advanceTimersByTimeAsync(6000)
  await Vue.nextTick()
  expect(player.busy()).toBe(false)
  expect(player.elements.find(element => element.tag === 'button' && !element.removed)?.text).toContain('重新播放')
  player.video().props.onPlaying?.({ target: player.video() })
  await Vue.nextTick()
  expect(player.elements.filter(element => element.tag === 'button' && !element.removed)).toHaveLength(0)
})

it('切换资源后旧媒体事件不能结束新资源的加载', async () => {
  const player = await mountPlayer()
  const oldVideo = player.video()
  player.src.value = '/new.mp4'
  await Vue.nextTick()
  await Vue.nextTick()
  oldVideo.props.onPlaying({ target: oldVideo })
  await Vue.nextTick()
  expect(player.busy()).toBe(true)
  player.video().props.onPlaying({ target: player.video() })
  await Vue.nextTick()
  expect(player.busy()).toBe(false)
})
