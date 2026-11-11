import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as preview from '../src/utils/wallpaper/devicePreview.js'

const { createRenderer, h, nextTick, onBeforeUnmount, onMounted, ref } = Vue
let app
let elements
let animations
let controls
let windowListeners
let motionQuery
let mediaMounts
let mediaUnmounts
let foldStarts
let foldCancels
let entryShape
let stageScale

const { descriptor } = parse(readFileSync(new URL('../src/components/wallpaper/device-preview/DevicePreviewStage.vue', import.meta.url), 'utf8'))
const { content } = compileScript(descriptor, { id: 'device-test', inlineTemplate: true })
const source = content
  .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (_m, names, key) => `const {${names.replace(/\bas\b/g, ':')}}=dependencies[${JSON.stringify(key)}]`)
  .replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (_m, name, key) => `const ${name}=dependencies[${JSON.stringify(key)}]`)
  .replace('export default', 'return')
const FoldSurface = {
  emits: ['prepared'],
  setup: (_props, { expose, emit }) => {
    let settle
    const cancel = () => { foldCancels++; settle?.(false); settle = null }
    expose({
      async play(beforeOpen) {
        foldStarts++
        emit('prepared')
        if (beforeOpen)
          await beforeOpen()
        return new Promise(resolve => { settle = resolve })
      },
      cancel,
      getEntryShape: () => entryShape,
    })
    onBeforeUnmount(cancel)
    return () => h('div', { class: 'test-fold-surface' })
  },
}
const Toolbar = {
  props: ['selected'], emits: ['select', 'replay', 'layout', 'follow'],
  setup: (_props, { emit }) => {
    controls = Object.fromEntries(['select', 'replay', 'layout', 'follow'].map(event => [event, value => emit(event, value)]))
    return () => h('button', 'devices')
  },
}
const DevicePreviewStage = new Function('dependencies', source)({
  vue: Vue,
  '@/utils/wallpaper/devicePreview': preview,
  './TriFoldSurface.vue': FoldSurface,
  './DuoFoldSurface.vue': FoldSurface,
  './DevicePreviewToolbar.vue': Toolbar,
})
const Media = { setup() {
  onMounted(() => mediaMounts++)
  onBeforeUnmount(() => mediaUnmounts++)
  return () => h('video', { src: '/preview.mp4' })
} }
const settle = async () => { for (let i = 0; i < 8; i++) { await nextTick(); await Promise.resolve() } }
const isPrimary = node => String(node.props.class || '').startsWith('preview-frame ') && !String(node.props.class).includes('secondary')
const root = () => elements.find(node => Object.hasOwn(node.props, 'data-device'))
const primary = () => elements.find(isPrimary)
const activeAnimations = () => animations.filter(animation => !animation.cancelled)

beforeEach(() => {
  elements = []
  animations = []
  controls = null
  stageScale = 1
  entryShape = { x: 304, y: 130, width: 352, height: 452, radii: [4, 24, 24, 4], inset: 7 }
  mediaMounts = mediaUnmounts = foldStarts = foldCancels = 0
  windowListeners = new Map()
  motionQuery = { matches: false, addEventListener: (_event, callback) => { motionQuery.callback = callback }, removeEventListener: () => { motionQuery.callback = null } }
  vi.stubGlobal('window', {
    screen: { width: 1440, height: 900, orientation: { addEventListener() {}, removeEventListener() {} } },
    matchMedia: () => motionQuery,
    addEventListener: (event, callback) => windowListeners.set(event, callback),
    removeEventListener: event => windowListeners.delete(event),
  })
  vi.stubGlobal('getComputedStyle', node => ({ width: '800px', height: '512px', borderRadius: '12px', borderTopWidth: '4px', borderRightWidth: '4px', borderBottomWidth: '4px', borderLeftWidth: '4px', ...node.visualStyle }))
})
afterEach(() => { app?.unmount(); app = null; vi.unstubAllGlobals() })

function mount(mode = 'desktop') {
  const ready = ref(true)
  const src = ref('/preview.jpg')
  const make = (tag, text = '') => {
    const node = {
      tag, text, style: {}, props: {}, children: [], clientWidth: 800, clientHeight: 512,
      getBoundingClientRect() {
        if (node.visualRect)
          return node.visualRect
        if (isPrimary(node)) {
          return root()?.props['data-device'] === 'tablet'
            ? { x: 104, y: 252, width: 424, height: 296 }
            : { x: 128, y: 136, width: 704, height: 440 }
        }
        return { x: 80, y: 100, width: 800 * stageScale, height: 512 * stageScale }
      },
      animate(frames, options) {
        let resolve
        const animation = { node, frames, options, cancelled: false, finished: new Promise(r => { resolve = r }), finish: () => resolve() }
        animation.cancel = vi.fn(() => { animation.cancelled = true; node.visualRect = null; resolve() })
        animations.push(animation)
        return animation
      },
    }
    elements.push(node)
    return node
  }
  const renderer = createRenderer({
    createElement: make, createText: text => make('#text', text), createComment: () => make('#comment'),
    insert(node, parent) { node.parent = parent; parent?.children?.push(node) },
    remove(node) { const index = node.parent?.children.indexOf(node); if (index >= 0) node.parent.children.splice(index, 1) },
    setText(node, text) { node.text = text }, setElementText(node, text) { node.text = text },
    patchProp(node, key, _old, value) { node.props[key] = value }, parentNode: node => node.parent, nextSibling() {},
  })
  app = renderer.createApp({ setup: () => () => h(DevicePreviewStage, { src: src.value, mode, ready: ready.value }, { default: () => h(Media) }) })
  app.mount({ children: [] })
  return { ready, src }
}

it('切换后立即卸载不重新启动异步动画', async () => {
  mount()
  controls.select('fold2')
  app.unmount()
  app = null
  await settle()
  expect(foldStarts).toBe(0)
  expect(animations).toHaveLength(0)
  expect(mediaUnmounts).toBe(1)
})

it('媒体进入等待时立即清除折叠遮罩与收缩动画', async () => {
  const state = mount()
  controls.select('fold2')
  await settle()
  expect(root().props.class).toContain('is-folding')
  expect(activeAnimations()).toHaveLength(2)
  state.ready.value = false
  await settle()
  expect(root().props.class).not.toContain('is-folding')
  expect(root().props.class).not.toContain('is-changing')
  expect(activeAnimations()).toHaveLength(0)
  expect(foldCancels).toBeGreaterThan(0)
})

it('笔记本变平板从旧屏幕坐标开始，完成后释放动画且媒体不重挂', async () => {
  mount()
  controls.select('tablet')
  await settle()
  const animation = animations.find(item => item.node === primary())
  expect(animation.frames[0]).toMatchObject({ left: '48px', top: '36px', width: '704px', height: '440px', transform: 'none' })
  expect(animation.frames[1]).toMatchObject({ left: '24px', top: '152px', width: '424px', height: '296px', transform: 'none' })
  animations.forEach(item => item.finish())
  await settle()
  expect(activeAnimations()).toHaveLength(0)
  expect(primary().props.class).toContain('preview-frame--tablet')
  expect(mediaMounts).toBe(1)
  expect(mediaUnmounts).toBe(0)
})

it('中途快切从屏幕当前实际矩形接续，迟到完成不能撤销新动画', async () => {
  mount()
  controls.select('tablet')
  await settle()
  const previous = [...animations]
  primary().visualRect = { x: 112, y: 196, width: 500, height: 340 }
  controls.select('laptop')
  await settle()
  const current = animations.filter(item => !previous.includes(item))
  const frameAnimation = current.find(item => item.node === primary())
  expect(frameAnimation.frames[0]).toMatchObject({ left: '32px', top: '96px', width: '500px', height: '340px' })
  previous.forEach(item => item.finish())
  await settle()
  expect(previous.every(item => item.cancelled)).toBe(true)
  expect(current.every(item => !item.cancelled)).toBe(true)
  expect(mediaMounts).toBe(1)
})

it.each(['resize', 'reduce', 'source', 'unmount'])('%s中止正在进行的尺寸动画，不留下固定几何', async (event) => {
  const state = mount()
  controls.select('tablet')
  await settle()
  expect(activeAnimations().length).toBeGreaterThan(0)
  if (event === 'resize')
    windowListeners.get('resize')()
  else if (event === 'reduce') {
    motionQuery.matches = true
    motionQuery.callback()
  }
  else if (event === 'source')
    state.src.value = '/another.jpg'
  else {
    app.unmount()
    app = null
  }
  await settle()
  expect(activeAnimations()).toHaveLength(0)
  if (event === 'reduce') {
    const count = animations.length
    controls.select('laptop')
    await settle()
    expect(animations).toHaveLength(count)
  }
})


it.each([
  ['desktop', 'fold2', [4, 24, 24, 4], 1],
  ['desktop', 'fold3', [2, 22, 22, 2], 1],
  ['mobile', 'fold2', [4, 4, 24, 24], 1],
  ['desktop', 'fold2', [4, 24, 24, 4], 1.5],
  ['mobile', 'fold2', [4, 4, 24, 24], 0.8],
])('%s进入%s的位移和四角%s在同一时间收敛，舞台缩放%s', async (mode, device, corners, scale) => {
  stageScale = scale
  entryShape = {
    x: 80 + 224 * scale, y: 100 + 30 * scale,
    width: 352 * scale, height: 452 * scale,
    radii: corners.map(value => value * scale), inset: 7 * scale,
  }
  mount(mode)
  controls.select(device)
  await settle()
  const outer = animations.find(item => item.node.props.class === 'device-transition-cover')
  const inner = animations.find(item => item.node.parent === outer.node)
  for (const [property, expected] of Object.entries({ left: 224, top: 30, width: 352, height: 452 }))
    expect(Number.parseFloat(outer.frames[1][property])).toBeCloseTo(expected)
  const outerRadii = outer.frames[1].borderRadius.split(' ').map(Number.parseFloat)
  const innerRadii = inner.frames[1].borderRadius.split(' ').map(Number.parseFloat)
  corners.forEach((value, index) => {
    expect(outerRadii[index]).toBeCloseTo(value)
    expect(innerRadii[index]).toBeCloseTo(Math.max(0, value - 7))
  })
  expect(Number.parseFloat(inner.frames[1].inset)).toBeCloseTo(7)
  expect(inner.frames[1].width).toBe('calc(100% - 14px)')
  expect(inner.frames[1].height).toBe('calc(100% - 14px)')
  expect(inner.options).toEqual(outer.options)
  expect(outer.options).toMatchObject({ duration: 420, fill: 'both' })
  // 外框完成而图像还没完成时，不应先移除过渡层露出新的角。
  outer.finish()
  await settle()
  expect(root().props.class).toContain('is-changing')
  inner.finish()
  await settle()
  expect(root().props.class).not.toContain('is-changing')
  expect(root().props.class).toContain('is-folding')
  expect(mediaMounts).toBe(1)
})

it('收角中途切换从当前外框和内图圆角继续，旧动画不能提前交接', async () => {
  mount()
  controls.select('fold2')
  await settle()
  const old = [...animations]
  const cover = elements.find(node => node.props.class === 'device-transition-cover')
  const image = cover.children.find(node => node.tag === 'img')
  cover.visualRect = { x: 250, y: 170, width: 400, height: 320 }
  cover.visualStyle = { borderRadius: '8px 18px 18px 8px' }
  image.visualStyle = { borderRadius: '1px 11px 11px 1px' }
  entryShape = { x: 340, y: 130, width: 220, height: 452, radii: [2, 22, 22, 2], inset: 9 }
  controls.select('fold3')
  await settle()
  const latest = animations.filter(item => !old.includes(item))
  expect(latest.find(item => item.node === cover).frames[0]).toMatchObject({ left: '170px', top: '70px', width: '400px', height: '320px', borderRadius: '8px 18px 18px 8px' })
  expect(latest.find(item => item.node === image).frames[0].borderRadius).toBe('1px 11px 11px 1px')
  old.forEach(animation => animation.finish())
  await settle()
  expect(root().props.class).toContain('is-changing')
  expect(latest.every(animation => !animation.cancelled)).toBe(true)
})
