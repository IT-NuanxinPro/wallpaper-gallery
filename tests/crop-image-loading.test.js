import { readFileSync } from 'node:fs'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as Vue from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCropOutputSizeError } from '../src/utils/wallpaper/cropOutput.js'
import { resizePreviewCanvas } from '../src/utils/wallpaper/previewCanvas.js'

const apps = []
const fetchImage = vi.fn()
const cropperCreate = vi.fn()
const cropperExport = vi.fn()

function compile(path, dependencies) {
  const { descriptor } = parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  const { content } = compileScript(descriptor, { id: path, inlineTemplate: true })
  const source = content
    .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (_, names, key) => `const {${names.replace(/\bas\b/g, ':')}} = dependencies[${JSON.stringify(key)}]`)
    .replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (_, name, key) => `const ${name} = dependencies[${JSON.stringify(key)}].default`)
    .replace(/import ['"][^'"]+['"];?/g, '')
    .replace('export default', 'return')
  return new Function('dependencies', source)(dependencies)
}

async function settle() {
  await Promise.resolve()
  await Vue.nextTick()
  await Promise.resolve()
  await Vue.nextTick()
}

function mountCrop() {
  const empty = { render: () => null }
  const dependencies = {
    vue: { ...Vue, Transition: Vue.BaseTransition },
    'cropperjs': { default: class {
      constructor(image, options) { cropperCreate(image, options) }
      destroy() {}
      setAspectRatio() {}
      getCroppedCanvas(...args) { return cropperExport(...args) }
    } },
    'gsap': { gsap: { timeline: () => ({ fromTo() { return this }, to() { return this } }), to() {} } },
    '@/utils/common/analytics': { trackImageCrop() {} },
    '@/utils/common/format': { buildRawImageUrl: url => url },
    '@/utils/wallpaper/imageFetch': { fetchWallpaperImage: fetchImage },
    '@/utils/wallpaper/cropOutput': { getCropOutputSizeError },
    '@/utils/wallpaper/previewCanvas': { resizePreviewCanvas },
    '@/components/common/feedback/LoadingSpinner.vue': { default: empty },
  }
  for (const name of ['CropBatchExportSection', 'CropModalHeader', 'CropOutputSection', 'CropPreviewSection', 'CropRatioSection', 'CropSizeInfoSection', 'CropZoomSection']) {
    dependencies[`./shared/${name}.vue`] = { default: { inheritAttrs: false, setup: (_, { attrs }) => () => Vue.h(name, attrs) } }
  }
  dependencies['./shared/CropImageStage.vue'] = { default: compile('../src/components/wallpaper/crop/shared/CropImageStage.vue', dependencies) }
  const component = compile('../src/components/wallpaper/crop/index.vue', dependencies)
  const elements = []
  const renderer = Vue.createRenderer({
    createElement(tag) {
      const el = Vue.markRaw({ tag, props: {}, style: {}, naturalWidth: 3840, naturalHeight: 2160, getAttribute(key) { return this.props[key] } })
      elements.push(el)
      return el
    },
    createText: () => ({}), createComment: () => ({}),
    insertStaticContent: () => [{}, {}], insert() {}, remove() {}, setText() {},
    setElementText(el, text) { el.text = text },
    patchProp(el, key, _previous, value) { el.props[key] = value },
    parentNode: () => null, nextSibling: () => null, querySelector: () => ({}),
  })
  const props = Vue.reactive({ imageUrl: '/a.jpg', filename: 'a.jpg', isOpen: false })
  const app = renderer.createApp({ render: () => Vue.h(component, props) })
  app.mount({})
  apps.push(app)
  props.isOpen = true
  const node = tag => elements.findLast(el => el.tag === tag)
  return { props, elements, node, app }
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchImage.mockReset()
  vi.stubGlobal('window', { screen: { width: 1920, height: 1080 }, devicePixelRatio: 1 })
  vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {} })
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => `blob:${blob.size}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('裁剪原图生命周期', () => {
  it('超限自定义输出禁用导出并明确提示，不调用画布导出', async () => {
    fetchImage.mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
    const { node, elements } = mountCrop()
    await settle()
    node('CropOutputSection').props['onUpdate:exactOutputEnabled'](true)
    node('CropOutputSection').props['onUpdate:outputWidth']('16384')
    node('CropOutputSection').props['onUpdate:outputHeight']('16384')
    await settle()
    node('img').props.onLoad({ target: node('img') })
    await settle()
    expect(node('CropOutputSection').props['exact-output-valid']).toBe(false)
    expect(node('CropOutputSection').props['output-error']).toContain('8192')
    expect(node('CropOutputSection').props['output-width']).toBe('16384')
    expect(node('CropOutputSection').props['output-height']).toBe('16384')
    const exportButton = elements.find(el => el.tag === 'button' && String(el.props.class).includes('action-btn--primary'))
    expect(exportButton.props.disabled).toBe(true)
    await exportButton.props.onClick()
    expect(cropperExport).not.toHaveBeenCalled()
  })

  it('当前图片加载完成后初始化裁剪器，卸载会取消正在读取的原图', async () => {
    fetchImage.mockResolvedValueOnce(new Blob(['image'], { type: 'image/png' }))
    const first = mountCrop()
    await settle()
    first.node('img').props.onLoad({ target: first.node('img') })
    await settle()
    expect(cropperCreate).toHaveBeenCalledOnce()
    first.app.unmount()
    apps.splice(apps.indexOf(first.app), 1)
    let signal
    fetchImage.mockImplementationOnce((_url, options) => {
      signal = options.signal
      return new Promise(() => {})
    })
    const next = mountCrop()
    await settle()
    next.app.unmount()
    apps.splice(apps.indexOf(next.app), 1)
    expect(signal.aborted).toBe(true)
  })

  it('失败可重试，重试保留选定比例、自定义尺寸及输出格式', async () => {
    fetchImage.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Blob(['next'], { type: 'image/png' }))
    const { node, elements } = mountCrop()
    await settle()
    const ratio = node('CropRatioSection')
    ratio.props.onSelectRatio('9:16')
    ratio.props['onUpdate:customWidth']('1080')
    ratio.props['onUpdate:customHeight']('1920')
    const output = node('CropOutputSection')
    output.props['onUpdate:outputFormat']('png')
    output.props['onUpdate:outputWidth']('1080')
    output.props['onUpdate:outputHeight']('1920')
    await settle()
    const retry = elements.find(el => el.tag === 'button' && el.text?.trim() === '重新加载')
    expect(retry).toBeDefined()
    retry.props.onClick()
    await settle()
    expect(ratio.props['selected-ratio']).toBe('9:16')
    expect(ratio.props['custom-width']).toBe('1080')
    expect(ratio.props['custom-height']).toBe('1920')
    expect(output.props['output-format']).toBe('png')
    expect(output.props['output-width']).toBe('1080')
    expect(output.props['output-height']).toBe('1920')
    expect(node('img').props.src).toBe('blob:4')
  })

  it('切换图片取消旧加载，即使旧请求忽略取消也不能覆盖新图', async () => {
    let finishA
    let signalA
    fetchImage.mockImplementationOnce((_url, { signal }) => {
      signalA = signal
      return new Promise(resolve => { finishA = resolve })
    }).mockResolvedValueOnce(new Blob(['new-image'], { type: 'image/png' }))
    const { props, node } = mountCrop()
    await settle()
    props.imageUrl = '/b.jpg'
    await settle()
    expect(signalA.aborted).toBe(true)
    expect(node('img').props.src).toBe('blob:9')
    finishA(new Blob(['old'], { type: 'image/png' }))
    await settle()
    expect(node('img').props.src).toBe('blob:9')
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
  })

  it('旧图片的load与error事件不会覆盖当前裁剪状态，关闭时释放Blob', async () => {
    fetchImage.mockResolvedValueOnce(new Blob(['first'], { type: 'image/png' }))
      .mockResolvedValueOnce(new Blob(['second'], { type: 'image/png' }))
    const { props, node } = mountCrop()
    await settle()
    const old = node('img')
    props.imageUrl = '/b.jpg'
    await settle()
    old.props.onLoad({ target: old })
    old.props.onError({ target: old })
    await settle()
    expect(cropperCreate).not.toHaveBeenCalled()
    expect(node('img').props.src).toBe('blob:6')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:5')
    props.isOpen = false
    await settle()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:6')
  })

  it('已销毁裁剪器的延迟回调不会写入下一张图片', async () => {
    fetchImage.mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
    const { props, node } = mountCrop()
    await settle()
    node('img').props.onLoad({ target: node('img') })
    await settle()
    const options = cropperCreate.mock.calls[0][1]
    props.imageUrl = '/b.jpg'
    await settle()
    expect(() => options.ready()).not.toThrow()
    options.crop({ detail: { width: 800, height: 600 } })
    await settle()
    expect(node('CropSizeInfoSection').props['crop-info']).toEqual({ width: 0, height: 0 })
  })

  it('切图清除图片派生尺寸，加载失败也不沿用旧图尺寸且保留输出选择', async () => {
    let failNext
    fetchImage.mockResolvedValueOnce(new Blob(['image'], { type: 'image/png' }))
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { failNext = reject }))
    const { props, node } = mountCrop()
    await settle()
    node('img').props.onLoad({ target: node('img') })
    await settle()
    cropperCreate.mock.calls[0][1].crop({ detail: { width: 3840, height: 2160 } })
    const ratio = node('CropRatioSection')
    ratio.props.onSelectRatio('9:16')
    node('CropOutputSection').props['onUpdate:outputWidth']('1080')
    node('CropOutputSection').props['onUpdate:outputHeight']('1920')
    await settle()
    expect(node('CropSizeInfoSection').props['crop-info']).toEqual({ width: 3840, height: 2160 })
    props.imageUrl = '/b.jpg'
    await settle()
    expect(node('CropSizeInfoSection').props['crop-info']).toEqual({ width: 0, height: 0 })
    expect(node('CropPreviewSection').props['current-aspect-ratio']).toBe(9 / 16)
    expect(node('CropRatioSection').props['selected-ratio']).toBe('9:16')
    expect(node('CropOutputSection').props['output-width']).toBe('1080')
    expect(node('CropOutputSection').props['output-height']).toBe('1920')
    failNext(new Error('offline'))
    await settle()
    expect(node('CropSizeInfoSection').props['crop-info']).toEqual({ width: 0, height: 0 })
    expect(node('CropPreviewSection').props['current-aspect-ratio']).toBe(9 / 16)
  })
})
