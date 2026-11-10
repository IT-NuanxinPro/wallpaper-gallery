import { buildWallpaperShareUrl } from '../src/utils/wallpaper/share.js'
import { readFile } from 'node:fs/promises'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as Vue from 'vue'
import { createRenderer, effectScope, h, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useLoadingSurface } from '../src/components/common/feedback/useLoadingSurface.js'
import { getMediaAspectRatio, useDecodedImage } from '../src/composables/useDecodedImage.js'
import { useImageFallback } from '../src/composables/useImageFallback.js'

describe('媒体预览几何', () => {
  it.each([
    [{ width: 3840, height: 2160 }, '16 / 10', '3840 / 2160'],
    [{ width: 1080, height: 2400 }, '9 / 16', '1080 / 2400'],
    [{ width: 0, height: 1080 }, '1 / 1', '1 / 1'],
    [{ width: Number.POSITIVE_INFINITY, height: 1080 }, '9 / 16', '9 / 16'],
    [undefined, '9 / 16', '9 / 16'],
  ])('由元数据预留尺寸，缺少有效尺寸时保留系列比例', (resolution, fallback, expected) => {
    expect(getMediaAspectRatio(resolution, fallback)).toBe(expected)
  })
})

describe('图片解码展示', () => {
  it('解码完成后才展示，切换图片时旧解码不能解除新图片的loading', async () => {
    const scope = effectScope()
    const source = ref('/first.webp')
    const state = scope.run(() => useDecodedImage(source))
    let finish
    const pending = state.handleLoad({ target: { decode: () => new Promise(resolve => { finish = resolve }), naturalWidth: 400 } })
    expect(state.ready.value).toBe(false)
    source.value = '/next.webp'
    finish()
    expect(await pending).toBe(false)
    expect(state.ready.value).toBe(false)
    expect(await state.handleLoad({ target: { decode: async () => {}, naturalWidth: 500 } })).toBe(true)
    expect(state.ready.value).toBe(true)
    scope.stop()
  })

  it('错误结束loading并在切换回退图时清除，已加载但不支持decode的浏览器可显示', async () => {
    const scope = effectScope()
    const source = ref('/first.webp')
    const state = scope.run(() => useDecodedImage(source))
    state.handleError()
    expect(state.failed.value).toBe(true)
    source.value = '/fallback.webp'
    expect(state.failed.value).toBe(false)
    expect(await state.handleLoad({ target: { naturalWidth: 300 } })).toBe(true)
    expect(state.ready.value).toBe(true)
    scope.stop()
  })
})

describe('桌面预览事件集成', () => {
  async function createComponents(copyText = () => {}) {
    const Empty = { render: () => null }
    const slotWrapper = { inheritAttrs: false, setup: (_props, { slots }) => () => slots.default?.() }
    const dependencies = {
      vue: { ...Vue, Transition: Vue.BaseTransition, Teleport: slotWrapper },
      '@/composables/useDecodedImage': { getMediaAspectRatio, useDecodedImage },
      '@/composables/useImageFallback': { useImageFallback },
      '@/composables/usePreviewTracking': { usePreviewTracking() {} },
      '@/composables/useWallpaperDownload': { useWallpaperDownload: () => ({ downloading: ref(false), handleDownload() {} }) },
      './useLoadingSurface': { useLoadingSurface },
      './SoftLoading.vue': { default: Empty },
      'element-plus': { ElMessage: { success() {}, error() {} } },
      '@/components/common/feedback/LoadingSpinner.vue': { default: Empty },
      '@/components/wallpaper/card/shared/WallpaperCardActions.vue': { default: Empty },
      '@/components/wallpaper/desktop/WallpaperDesktopActions.vue': { default: Empty },
      '@/composables/useWallpaperType': { useWallpaperType: () => ({ currentSeries: ref('desktop') }) },
      '@/stores/popularity': { usePopularityStore: () => ({ getDownloadCount: () => 0, getViewCount: () => 0 }) },
      '@/utils/common/analytics': { trackWallpaperDownload() {}, trackWallpaperPreview() {} },
      '@/utils/common/clipboard': { copyText },
      '@/utils/common/format': new Proxy({}, { get: () => () => '' }),
      '@/utils/integrations/supabase': { recordDownload() {}, recordView() {} },
      '@/utils/wallpaper/share': { buildWallpaperShareUrl },
      '@/utils/wallpaper/identity': { resolveWallpaperSeries: () => 'desktop' },
    }
    async function compileComponent(path, key) {
      const source = await readFile(new URL(path, import.meta.url), 'utf8')
      const { descriptor } = parse(source)
      const result = compileScript(descriptor, { id: path, inlineTemplate: true })
      const content = result.content
        .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (_, names, dependency) => `const {${names.replace(/\bas\b/g, ':')}} = dependencies[${JSON.stringify(dependency)}]`)
        .replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (_, name, dependency) => `const ${name} = dependencies[${JSON.stringify(dependency)}].default`)
        .replace('export default', 'return')
      const component = new Function('dependencies', content)(dependencies)
      dependencies[key] = { default: component }
      return component
    }
    await compileComponent('../src/components/common/feedback/LoadingSurface.vue', '@/components/common/feedback/LoadingSurface.vue')
    await compileComponent('../src/components/wallpaper/shared/WallpaperImageStage.vue', '@/components/wallpaper/shared/WallpaperImageStage.vue')
    const DesktopImageStage = await compileComponent('../src/components/wallpaper/WallpaperModal/desktop/DesktopImageStage.vue', './DesktopImageStage.vue')
    const DesktopModal = await compileComponent('../src/components/wallpaper/WallpaperModal/desktop/DesktopModal.vue', 'DesktopModal')
    return { DesktopImageStage, DesktopModal }
  }

  function createTestRenderer() {
    const elements = []
    const renderer = createRenderer({
      createElement(type) { const el = { type, props: {}, children: [] }; elements.push(el); return el },
      createText: () => ({}), createComment: () => ({}),
      insert(el, parent, anchor) {
        parent.children ||= []
        el.parent = parent
        const index = anchor ? parent.children.indexOf(anchor) : -1
        if (index === -1) parent.children.push(el)
        else parent.children.splice(index, 0, el)
      },
      remove(el) {
        const siblings = el.parent?.children || []
        const index = siblings.indexOf(el)
        if (index >= 0) siblings.splice(index, 1)
      },
      setText() {}, setElementText(el, text) { el.text = text },
      parentNode: el => el.parent,
      nextSibling: el => el.parent?.children?.[el.parent.children.indexOf(el) + 1] || null,
      patchProp(el, key, _old, value) { el.props[key] = value },
    })
    return { elements, renderer }
  }

  it('真实组件跨LoadingSurface和DesktopImageStage透传解码后的尺寸事件', async () => {
    const { DesktopImageStage } = await createComponents()
    const { elements, renderer } = createTestRenderer()
    let loaded
    const app = renderer.createApp({
      render: () => h(DesktopImageStage, { imageSrc: '/image.webp', onLoad: event => { loaded = event } }),
    })
    app.mount({})
    const image = elements.find(element => element.type === 'img')
    const event = { target: { naturalWidth: 1920, naturalHeight: 1080, decode: async () => {} } }
    await image.props.onLoad(event)
    await nextTick()
    expect(loaded?.target.naturalWidth).toBe(1920)
    expect(loaded?.target.naturalHeight).toBe(1080)
    expect(loaded?.dimensions).toEqual({ width: 1920, height: 1080 })
    app.unmount()
  })

  it('异步解码期间事件target被清空仍用原图片传递真实尺寸', async () => {
    const { DesktopImageStage } = await createComponents()
    const { elements, renderer } = createTestRenderer()
    let loaded
    let finishDecode
    const app = renderer.createApp({ render: () => h(DesktopImageStage, { imageSrc: '/event.webp', onLoad: value => { loaded = value } }) })
    app.mount({})
    let target = { naturalWidth: 2560, naturalHeight: 1440, decode: () => new Promise(resolve => { finishDecode = resolve }) }
    const original = target
    const event = { get target() { return target } }
    const pending = elements.find(element => element.type === 'img').props.onLoad(event)
    target = null
    finishDecode()
    await pending
    expect(loaded.target).toBe(original)
    expect(loaded.dimensions).toEqual({ width: 2560, height: 1440 })
    app.unmount()
  })

  it('复制按钮提供独立详情站内链接，下载仍保留原始URL', async () => {
    let copied
    const { DesktopModal } = await createComponents(value => { copied = value })
    const { elements, renderer } = createTestRenderer()
    const wallpaper = { _series: 'desktop', filename: 'same.jpg', path: '/wallpaper/desktop/风景/same.jpg', url: 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.63/wallpaper/desktop/image.jpg' }
    const app = renderer.createApp({ render: () => h(DesktopModal, { wallpaper, isOpen: true }) })
    app.config.warnHandler = () => {}
    app.mount({})
    await elements.find(element => element.props.class === 'copy-url-btn').props.onClick()
    expect(copied).toBe(buildWallpaperShareUrl(wallpaper))
    expect(copied).toContain('/wallpaper/')
    expect(copied).not.toContain('cdn.jsdelivr.net')
    expect(wallpaper.url).toContain('cdn.jsdelivr.net')
    app.unmount()
  })

  it('裁剪独立加载原图，预览未完成或失败时仍可打开，有效原图缺失才禁用', async () => {
    const { DesktopModal } = await createComponents()
    const { elements, renderer } = createTestRenderer()
    const wallpaper = ref({ id: 'crop-image', filename: 'image.jpg', url: 'https://example.com/original.jpg', previewUrl: 'https://example.com/preview.webp' })
    let cropRequests = 0
    const app = renderer.createApp({ render: () => h(DesktopModal, {
      wallpaper: wallpaper.value,
      isOpen: true,
      onOpenCrop: () => { cropRequests++ },
    }) })
    app.config.warnHandler = (message) => {
      if (!message.includes('Non-function value encountered for default slot'))
        throw new Error(message)
    }
    app.mount({})
    const button = elements.find(element => element.props.class === 'crop-btn')
    expect(button.props.disabled).toBe(false)
    button.props.onClick()
    expect(cropRequests).toBe(1)
    elements.find(element => element.type === 'img').props.onError()
    await nextTick()
    expect(button.props.disabled).toBe(false)
    button.props.onClick()
    expect(cropRequests).toBe(2)
    wallpaper.value = { ...wallpaper.value, url: '' }
    await nextTick()
    expect(button.props.disabled).toBe(true)
    app.unmount()
  })

  it('同一图片完成回退并解码后，元数据引用替换不能清空尺寸或恢复裁剪禁用', async () => {
    const { DesktopModal } = await createComponents()
    const { elements, renderer } = createTestRenderer()
    const wallpaper = ref({ id: 'image', filename: 'image.jpg', url: 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.63/wallpaper/desktop/image.jpg', previewUrl: '/images/v1.2.63/preview/desktop/image.webp' })
    const app = renderer.createApp({ render: () => h(DesktopModal, { wallpaper: wallpaper.value, isOpen: true }) })
    app.config.warnHandler = (message) => {
      if (!message.includes('Non-function value encountered for default slot'))
        throw new Error(message)
    }
    app.mount({})
    const initialImage = elements.find(element => element.type === 'img')
    initialImage.props.onError()
    await nextTick()
    const fallbackImage = elements.filter(element => element.type === 'img').at(-1)
    await fallbackImage.props.onLoad({ target: { naturalWidth: 1920, naturalHeight: 1080, decode: async () => {} } })
    await nextTick()
    expect(elements.some(element => element.text === '1920 × 1080')).toBe(true)
    wallpaper.value = { ...wallpaper.value, category: '更新后的分类元数据' }
    await nextTick()
    expect(elements.some(element => element.text === '1920 × 1080')).toBe(true)
    expect(elements.find(element => element.props.class === 'crop-btn')?.props.disabled).toBe(false)
    app.unmount()
  })
})
