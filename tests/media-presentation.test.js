import { readFile } from 'node:fs/promises'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as Vue from 'vue'
import { createRenderer, effectScope, h, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useLoadingSurface } from '../src/components/common/feedback/useLoadingSurface.js'
import { getMediaAspectRatio, useDecodedImage } from '../src/composables/useDecodedImage.js'

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
  it('严格解码失败不会替换已成功缩略图，旧图片的失败也不能污染新图片', async () => {
    const scope = effectScope()
    const source = ref('/large.webp')
    const state = scope.run(() => useDecodedImage(source, { strictDecode: true }))
    expect(await state.handleLoad({ target: { naturalWidth: 400, decode: async () => { throw new Error('decode failed') } } })).toBe(false)
    expect(state.ready.value).toBe(false)
    expect(state.failed.value).toBe(true)
    source.value = '/retry.webp'
    let reject
    const stale = state.handleLoad({ target: { naturalWidth: 400, decode: () => new Promise((_, fail) => { reject = fail }) } })
    source.value = '/current.webp'
    reject(new Error('stale decode'))
    expect(await stale).toBe(false)
    expect(state.failed.value).toBe(false)
    expect(await state.handleLoad({ target: { naturalWidth: 400 } })).toBe(true)
    scope.stop()
  })
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

describe('共享图片舞台事件集成', () => {
  async function createImageStage() {
    const Empty = { render: () => null }
    const dependencies = {
      vue: { ...Vue, Transition: Vue.BaseTransition },
      '@/composables/useDecodedImage': { getMediaAspectRatio, useDecodedImage },
      './useLoadingSurface': { useLoadingSurface },
      './SoftLoading.vue': { default: Empty },
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
    return compileComponent('../src/components/wallpaper/shared/WallpaperImageStage.vue', '@/components/wallpaper/shared/WallpaperImageStage.vue')
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

  it('成功缩略图立即可见，大图解码前不盖loading，失败保留缩略图并通知重试', async () => {
    const WallpaperImageStage = await createImageStage()
    const { elements, renderer } = createTestRenderer()
    let failed = false
    const app = renderer.createApp({ render: () => h(WallpaperImageStage, {
      src: '/large.webp', placeholderSrc: '/thumb.webp', onError: () => { failed = true },
    }) })
    app.mount({})
    const thumbnail = elements.find(element => element.type === 'img' && element.props.src === '/thumb.webp')
    expect(thumbnail).toBeTruthy()
    const stage = elements.find(element => element.props.class?.includes('wallpaper-image-stage') && element.type === 'div')
    expect(stage.props['aria-busy']).toBe(false)
    const large = elements.find(element => element.type === 'img' && element.props.src === '/large.webp')
    await large.props.onLoad({ target: { naturalWidth: 800, decode: async () => { throw new Error('broken') } } })
    await nextTick()
    expect(failed).toBe(true)
    expect(thumbnail.parent.children).toContain(thumbnail)
    expect(large.props.class).not.toContain('is-ready')
    app.unmount()
  })

  it('详情共享图片舞台跨LoadingSurface透传解码后的尺寸事件', async () => {
    const WallpaperImageStage = await createImageStage()
    const { elements, renderer } = createTestRenderer()
    let loaded
    const app = renderer.createApp({
      render: () => h(WallpaperImageStage, { src: '/image.webp', onLoad: event => { loaded = event } }),
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
    const WallpaperImageStage = await createImageStage()
    const { elements, renderer } = createTestRenderer()
    let loaded
    let finishDecode
    const app = renderer.createApp({ render: () => h(WallpaperImageStage, { src: '/event.webp', onLoad: value => { loaded = value } }) })
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
})
