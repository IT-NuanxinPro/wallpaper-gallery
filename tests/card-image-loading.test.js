import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, h, markRaw, nextTick, reactive } from 'vue'
import { useDecodedImage } from '../src/composables/useDecodedImage.js'

// 以真实客户端模板运行自定义renderer，避免Node测试环境将SFC编译为SSR。
const { descriptor } = parse(readFileSync(new URL('../src/components/wallpaper/card/shared/WallpaperCardMedia.vue', import.meta.url), 'utf8'))
const { content } = compileScript(descriptor, { id: 'card-media', inlineTemplate: true })
const componentSource = content
  .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (_, names, dependency) => `const {${names.replace(/\bas\b/g, ':')}} = dependencies[${JSON.stringify(dependency)}]`)
  .replace('export default', 'return')
const WallpaperCardMedia = new Function('dependencies', componentSource)({
  vue: Vue,
  '@/composables/useDecodedImage': { useDecodedImage },
})

const apps = []
afterEach(() => apps.splice(0).forEach(app => app.unmount()))

function mountMedia(imageOptions = {}) {
  const images = []
  const renderer = createRenderer({
    createElement(tag) {
      const el = markRaw({ tag, props: {}, complete: false, naturalWidth: 400, ...imageOptions })
      if (tag === 'img')
        images.push(el)
      return el
    },
    createText: () => ({}), createComment: () => ({}),
    insertStaticContent: () => [{}, {}],
    insert: () => {}, remove: () => {}, setText: () => {}, setElementText: () => {},
    patchProp: (el, key, _previous, value) => { el.props[key] = value },
    parentNode: () => null, nextSibling: () => null,
  })
  const props = reactive({ thumbnailUrl: '/first.webp', imageLoaded: false, index: 10 })
  const onLoad = vi.fn(() => { props.imageLoaded = true })
  const app = renderer.createApp({ render: () => h(WallpaperCardMedia, { ...props, onLoad }) })
  app.mount({})
  apps.push(app)
  return { images, props, onLoad, app }
}

describe('懒加载图片与卡片入场解耦', () => {
  it('保持原生懒加载，解码完成前保留占位，不提前触发图片淡入', async () => {
    const { images, onLoad } = mountMedia()
    const img = images[0]
    let finishDecode
    img.decode = () => new Promise(resolve => { finishDecode = resolve })
    const pending = img.props.onLoad({ target: img })
    expect(img.props.loading).toBe('lazy')
    expect(onLoad).not.toHaveBeenCalled()
    finishDecode()
    await pending
    expect(onLoad).toHaveBeenCalledOnce()
  })

  it('回退地址变化后，旧图片解码完成不能解除新图片的占位', async () => {
    const { images, props, onLoad } = mountMedia()
    const img = images[0]
    let finishDecode
    img.decode = () => new Promise(resolve => { finishDecode = resolve })
    const pending = img.props.onLoad({ target: img })
    props.thumbnailUrl = '/fallback.webp'
    await nextTick()
    finishDecode()
    await pending
    expect(onLoad).not.toHaveBeenCalled()
  })

  it('缓存图片也等待解码，多次load只发出一次就绪通知', async () => {
    let finishDecode
    const { images, onLoad } = mountMedia({ complete: true, decode: () => new Promise(resolve => { finishDecode = resolve }) })
    expect(onLoad).not.toHaveBeenCalled()
    finishDecode()
    await nextTick()
    await images[0].props.onLoad({ target: images[0] })
    expect(onLoad).toHaveBeenCalledOnce()
  })

  it('decode拒绝但原生图片可显示时正常完成', async () => {
    const { images, onLoad } = mountMedia({ decode: () => Promise.reject(new Error('unsupported')) })
    await images[0].props.onLoad({ target: images[0] })
    expect(onLoad).toHaveBeenCalledOnce()
  })

  it('卸载后不再处理待完成的解码结果', async () => {
    const { images, onLoad, app } = mountMedia()
    let finishDecode
    images[0].decode = () => new Promise(resolve => { finishDecode = resolve })
    const pending = images[0].props.onLoad({ target: images[0] })
    app.unmount()
    apps.splice(apps.indexOf(app), 1)
    finishDecode()
    await pending
    expect(onLoad).not.toHaveBeenCalled()
  })
})
import { readFileSync } from 'node:fs'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as Vue from 'vue'
