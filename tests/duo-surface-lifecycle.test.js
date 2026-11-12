import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as preview from '../src/utils/wallpaper/devicePreview.js'
import * as geometry from '../src/utils/wallpaper/duoFold.js'

const { descriptor } = parse(readFileSync(new URL('../src/components/wallpaper/device-preview/DuoFoldSurface.vue', import.meta.url), 'utf8'))
const { content } = compileScript(descriptor, { id: 'duo-surface-lifecycle', inlineTemplate: true })
const source = content
  .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (_, names, key) => `const {${names.replace(/\bas\b/g, ':')}} = dependencies[${JSON.stringify(key)}]`)
  .replace('export default', 'return')
// 仅执行仓库内 SFC 编译产物，将宿主 API 替换为可控测试环境。
// eslint-disable-next-line no-new-func
const DuoFoldSurface = new Function('dependencies', source)({
  'vue': Vue,
  '@/utils/wallpaper/devicePreview': preview,
  '@/utils/wallpaper/duoFold': geometry,
})

let app
let nodes
let images
let frames
let nextFrame
let canvasFilterWrites

function createNode(tag) {
  const classes = new Set()
  const node = Vue.markRaw({
    tag,
    props: {},
    style: { setProperty(key, value) { this[key] = value } },
    dataset: {},
    children: [],
    parent: null,
    clientWidth: 500,
    clientHeight: 350,
    width: 0,
    height: 0,
    classList: {
      add: value => classes.add(value),
      remove: value => classes.delete(value),
      contains: value => classes.has(value),
    },
    insertBefore(child, anchor) {
      child.remove()
      child.parent = this
      const index = anchor ? this.children.indexOf(anchor) : -1
      if (index < 0)
        this.children.push(child)
      else
        this.children.splice(index, 0, child)
      return child
    },
    appendChild(child) { return this.insertBefore(child, null) },
    prepend(child) { return this.insertBefore(child, this.children[0] || null) },
    remove() {
      if (this.parent) {
        this.parent.children.splice(this.parent.children.indexOf(this), 1)
        this.parent = null
      }
    },
    querySelectorAll(selector) {
      return this.children.flatMap((child) => {
        const matches = selector.startsWith('.') ? child.className === selector.slice(1) : child.tag === selector
        return [...matches ? [child] : [], ...child.querySelectorAll(selector)]
      })
    },
    // 仅替换宿主 Canvas API；组件的资源分配、插入和释放均执行真实实现。
    getContext: () => ({ drawImage() {}, save() {}, translate() {}, scale() {}, restore() {}, set filter(value) { canvasFilterWrites.push(value); throw new Error('Canvas filter unsupported') } }),
  })
  nodes.push(node)
  return node
}

async function flush() {
  await Promise.resolve()
  await Vue.nextTick()
  await Promise.resolve()
  await Vue.nextTick()
}

function mountSurface(axis = 'y') {
  const prepared = vi.fn()
  const finishProgress = vi.fn()
  const renderer = Vue.createRenderer({
    createElement: createNode,
    createText: text => Object.assign(createNode('#text'), { text }),
    createComment: text => Object.assign(createNode('#comment'), { text }),
    insert: (node, parent, anchor) => parent.insertBefore(node, anchor),
    remove: node => node.remove(),
    setText: (node, text) => { node.text = text },
    setElementText: (node, text) => { node.text = text },
    patchProp: (node, key, _old, value) => { node.props[key] = value },
    parentNode: node => node.parent,
    nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] || null,
  })
  const container = createNode('container')
  app = renderer.createApp(DuoFoldSurface, { src: '/preview.jpg', axis, onPrepared: prepared, onFinishProgress: finishProgress })
  const surface = app.mount(container)
  return { surface, container, prepared, finishProgress }
}

function unmount() {
  app?.unmount()
  app = null
}

beforeEach(() => {
  nodes = []
  images = []
  frames = new Map()
  nextFrame = 0
  canvasFilterWrites = []
  vi.stubGlobal('window', { devicePixelRatio: 1.5 })
  vi.stubGlobal('document', { createElement: createNode })
  vi.stubGlobal('getComputedStyle', () => ({ borderTopLeftRadius: '20px' }))
  vi.stubGlobal('performance', { now: () => 0 })
  vi.stubGlobal('requestAnimationFrame', (callback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.stubGlobal('cancelAnimationFrame', frame => frames.delete(frame))
  // 所有解码由测试手动完成，不访问网络；清空 src 不自动完成 decode，
  // 以验证组件自己的取消 promise 确实可以终止准备阶段。
  vi.stubGlobal('Image', class {
    constructor() {
      this.src = ''
      this.naturalWidth = 1000
      this.naturalHeight = 700
      this.decoded = new Promise((resolve, reject) => {
        this.resolve = resolve
        this.reject = reject
      })
      images.push(this)
    }

    decode() { return this.decoded }
  })
})

afterEach(() => {
  unmount()
  vi.unstubAllGlobals()
})

describe('双折叠 Duo 纹理与动画生命周期', () => {
  it('解码尚未结束时取消会完成 play，晚到的解码不会绘制', async () => {
    const { surface, container, prepared } = mountSurface()
    const settled = vi.fn()
    const playing = surface.play().then(settled)
    surface.cancel()
    await flush()
    expect(settled).toHaveBeenCalledWith(false)
    expect(images[0].src).toBe('')
    images[0].resolve()
    await playing
    await flush()
    expect(prepared).not.toHaveBeenCalled()
    expect(container.querySelectorAll('canvas')).toHaveLength(0)
    expect(frames.size).toBe(0)
  })

  it('连续准备两轮后卸载会取消全部 Image 并完成两轮 promise', async () => {
    const { surface, prepared } = mountSurface()
    const settled = [vi.fn(), vi.fn()]
    const first = surface.play().then(settled[0])
    const second = surface.play().then(settled[1])
    await flush()
    expect(settled[0]).toHaveBeenCalledWith(false)
    expect(images.map(image => image.src)).toEqual(['', '/preview.jpg'])
    unmount()
    await flush()
    expect(settled[1]).toHaveBeenCalledWith(false)
    expect(images.map(image => image.src)).toEqual(['', ''])
    images.forEach(image => image.reject(new Error('解码已取消')))
    await Promise.all([first, second])
    await flush()
    expect(prepared).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })

  it('解码失败返回原媒体降级结果，不启动动画或生成纹理', async () => {
    const { surface, container, prepared } = mountSurface()
    const playing = surface.play()
    images[0].reject(new Error('无效图片'))
    await expect(playing).resolves.toBe(true)
    expect(prepared).not.toHaveBeenCalled()
    expect(container.querySelectorAll('canvas')).toHaveLength(0)
    expect(frames.size).toBe(0)
    unmount()
    expect(images[0].src).toBe('')
  })

  it('播放中重播替换纹理与磨砂层，不累积节点或帧任务', async () => {
    const { surface, container } = mountSurface()
    const first = surface.play()
    images[0].resolve()
    await flush()
    const oldCanvases = container.querySelectorAll('canvas')
    const oldLayers = container.querySelectorAll('.duo-surface__blur')
    expect(oldCanvases).toHaveLength(5)
    expect(oldLayers).toHaveLength(5)
    expect(frames.size).toBe(1)

    const second = surface.play()
    images[1].resolve()
    await flush()
    await expect(first).resolves.toBe(false)
    expect(images[0].src).toBe('')
    expect(container.querySelectorAll('canvas')).toHaveLength(oldCanvases.length)
    expect(container.querySelectorAll('.duo-surface__blur')).toHaveLength(oldLayers.length)
    expect(oldLayers.every(layer => layer.parent === null)).toBe(true)
    expect(oldCanvases.every(canvas => canvas.width === 0 && canvas.height === 0)).toBe(true)
    expect(frames.size).toBe(1)
    unmount()
    await expect(second).resolves.toBe(false)
    expect(frames.size).toBe(0)
    expect(nodes.filter(node => node.tag === 'canvas').every(canvas => canvas.width === 0 && canvas.height === 0)).toBe(true)
  })

  it.each(['y', 'x'])('轴 %s 完成播放后移交完整媒体，卸载释放全部 Canvas', async (axis) => {
    const { surface, container, prepared, finishProgress } = mountSurface(axis)
    const playing = surface.play()
    images[0].resolve()
    await flush()
    expect(prepared).toHaveBeenCalledOnce()
    expect(container.querySelectorAll('canvas').every(canvas => canvas.width > 0 && canvas.height > 0)).toBe(true)
    expect(frames.size).toBe(1)
    const scheduled = [...frames.values()]
    frames.clear()
    scheduled.forEach(callback => callback(preview.FOLD_TIMING.delay + preview.FOLD_TIMING.fold2 + 1))
    await expect(playing).resolves.toBe(true)
    expect(finishProgress.mock.lastCall[0]).toBeCloseTo(1)
    expect(frames.size).toBe(0)
    unmount()
    expect(container.querySelectorAll('canvas')).toHaveLength(0)
    expect(images[0].src).toBe('')
    expect(nodes.filter(node => node.tag === 'canvas').every(canvas => canvas.width === 0 && canvas.height === 0)).toBe(true)
  })

  it.each(['y', 'x'])('轴 %s 在无 Canvas 滤镜的客户端仍通过CSS分层磨砂，沿铰链开盖而变化', async (axis) => {
    const { surface, container } = mountSurface(axis)
    const playing = surface.play()
    images[0].resolve()
    await flush()
    const layers = container.querySelectorAll('.duo-surface__blur')
    expect(canvasFilterWrites).toEqual([])
    expect(layers).toHaveLength(5)
    const amounts = layers.map(layer => Number.parseFloat(layer.children[0].style.filter.match(/blur\(([^p]+)px/)[1]))
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b))
    expect(amounts[4]).toBeGreaterThan(10)
    const tick = (phase) => {
      const scheduled = [...frames.values()]
      frames.clear()
      scheduled.forEach(callback => callback(preview.FOLD_TIMING.delay + preview.FOLD_TIMING.fold2 * phase))
    }
    expect(layers.every(layer => layer.style.visibility === 'hidden')).toBe(true)
    tick(.3)
    const backMask = layers[0].style.maskImage
    expect(layers.filter(layer => layer.style.visibility === 'visible').length).toBeGreaterThan(0)
    expect(backMask).toContain(axis === 'y' ? 'to right' : 'to bottom')
    tick(.7)
    expect(layers[0].style.maskImage).not.toBe(backMask)
    const findClass = name => nodes.find(node => String(node.props.class).includes(name))
    const imagePoints = [...findClass('duo-surface__window').style.clipPath.matchAll(/(-?[\d.]+)px (-?[\d.]+)px/g)].map(match => [Number(match[1]), Number(match[2])])
    const metalPoints = [...findClass('duo-surface__bezel').style.clipPath.matchAll(/(-?[\d.]+)px (-?[\d.]+)px/g)].map(match => [Number(match[1]), Number(match[2])])
    const dimension = axis === 'y' ? 0 : 1
    expect(Math.max(...imagePoints.map(p => p[dimension]))).toBeGreaterThan(Math.max(...metalPoints.map(p => p[dimension])))
    tick(1)
    await expect(playing).resolves.toBe(true)
    expect(layers.every(layer => layer.style.visibility === 'hidden')).toBe(true)
  })

})
