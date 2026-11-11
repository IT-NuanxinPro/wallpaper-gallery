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
  const app = renderer.createApp({ render: () => Vue.h(Player, { src: src.value, controls: false }) })
  app.mount({ children: [] })
  apps.push(app)
  await Vue.nextTick()
  await Promise.resolve()
  await Vue.nextTick()
  return { elements, src, video: () => elements.findLast(element => element.tag === 'video' && !element.removed), busy: () => elements.find(element => element.tag === 'section')?.props['aria-busy'] }
}

it('canplay 不代表已播放；playing 才隐藏加载，缓冲后恢复加载', async () => {
  const player = await mountPlayer()
  expect(player.busy()).toBe(true)
  player.video().props.onCanplay({ target: player.video() })
  await Vue.nextTick()
  expect(player.busy()).toBe(true)
  expect(player.video().props.onPlaying).toBeTypeOf('function')
  player.video().props.onPlaying({ target: player.video() })
  await Vue.nextTick()
  expect(player.busy()).toBe(false)
  player.video().props.onWaiting({ target: player.video() })
  await Vue.nextTick()
  expect(player.busy()).toBe(true)
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
