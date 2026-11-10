import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as VueRouter from 'vue-router'
import { useDevice } from '../src/composables/useDevice.js'
import * as format from '../src/utils/common/format.js'
import * as constants from '../src/utils/config/constants.js'
import * as share from '../src/utils/wallpaper/share.js'
import { vCardReveal } from '../src/components/wallpaper/WallpaperGrid/composables/cardReveal.js'

function compileComponent(filename, dependencies) {
  const { descriptor } = parse(readFileSync(new URL(filename, import.meta.url), 'utf8'))
  const { content } = compileScript(descriptor, { id: filename, inlineTemplate: true })
  const source = content
    .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (_, names, dependency) => `const {${names.replace(/\bas\b/g, ':')}} = dependencies[${JSON.stringify(dependency)}]`)
    .replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (_, name, dependency) => `const ${name} = dependencies[${JSON.stringify(dependency)}]`)
    .replace('export default', 'return')
  return new Function('dependencies', source)({ vue: Vue, 'vue-router': VueRouter, ...dependencies })
}

const media = compileComponent('../src/components/wallpaper/card/shared/WallpaperCardMedia.vue')
const info = compileComponent('../src/components/wallpaper/card/shared/WallpaperCardInfo.vue', { '@/utils/common/format': format })
const card = compileComponent('../src/components/wallpaper/card/index.vue', {
  '@/composables/useDevice': { useDevice },
  '@/utils/common/format': format,
  '@/utils/config/constants': constants,
  '@/utils/wallpaper/share': share,
  '../WallpaperGrid/composables/cardReveal': { vCardReveal },
  './shared/WallpaperCardMedia.vue': media,
  './shared/WallpaperCardInfo.vue': info,
})

const apps = []
afterEach(() => apps.splice(0).forEach(app => app.unmount()))

async function mountCard(wallpaper) {
  const elements = []
  const renderer = Vue.createRenderer({
    createElement(tag) {
      const element = Vue.markRaw({ tag, props: {}, children: [], parent: null })
      elements.push(element)
      return element
    },
    createText: text => ({ text }),
    createComment: text => ({ text }),
    insertStaticContent: () => [{}, {}],
    insert(element, parent) { element.parent = parent; parent.children?.push(element) },
    remove: () => {},
    setText: (element, text) => { element.text = text },
    setElementText: (element, text) => { element.text = text },
    patchProp: (element, key, _previous, value) => { element.props[key] = value },
    parentNode: element => element.parent,
    nextSibling: () => null,
  })
  const router = VueRouter.createRouter({ history: VueRouter.createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  await router.push('/desktop?q=lake')
  const preview = vi.fn()
  const navigate = vi.fn()
  const app = renderer.createApp({ render: () => Vue.h(card, { wallpaper, onClick: preview, onNavigate: navigate }) })
  app.use(router)
  app.mount({ children: [] })
  apps.push(app)
  return { elements, router, preview, navigate }
}

async function click(element, overrides = {}) {
  const event = { button: 0, defaultPrevented: false, currentTarget: { getAttribute: () => null }, preventDefault() { this.defaultPrevented = true }, stopPropagation() {}, ...overrides }
  for (const handler of [element.props.onClick].flat().filter(Boolean))
    await handler(event)
  await Vue.nextTick()
  return event
}

const wallpaper = { filename: 'lake.jpg', path: '/wallpaper/desktop/lake.jpg', displayTitle: '湖光', previewUrl: '/images/v1.0.0/preview/desktop/lake.webp' }
const detailPath = '/wallpaper/ZGVza3RvcDpwYXRoOi93YWxscGFwZXIvZGVza3RvcC9sYWtlLmpwZw'

describe('卡片详情入口与快速预览', () => {
  it('动态卡片按真实上传日期显示相对时间，无日期不伪造刚刚上传', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'))
    try {
      const dated = await mountCard({ ...wallpaper, mediaType: 'video', createdAt: '2026-11-07T10:00:00Z' })
      const time = dated.elements.find(element => element.props.class === 'meta-item meta-time')
      expect(time?.text).toBe('3 天前')
      const missing = await mountCard({ ...wallpaper, mediaType: 'video' })
      expect(missing.elements.some(element => element.props.class === 'meta-item meta-time')).toBe(false)
    }
    finally { vi.useRealTimers() }
  })
  it('图像和标题包含真实详情链接，普通点击进入详情且不打开预览', async () => {
    const { elements, router, preview, navigate } = await mountCard(wallpaper)
    const link = elements.find(element => element.tag === 'a')
    expect(link?.props.href).toBe(detailPath)
    const image = elements.find(element => element.tag === 'img')
    expect(image.parent.parent).toBe(link)
    expect(elements.some(element => element.props.class === 'card-info' && element.parent === link)).toBe(true)
    await click(link)
    expect(router.currentRoute.value.path).toBe(detailPath)
    expect(preview).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledOnce()
  })

  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])('修饰键或非主按键保留浏览器默认行为 %j', async (modifiers) => {
    const { elements, router, preview, navigate } = await mountCard(wallpaper)
    const link = elements.find(element => element.tag === 'a')
    expect(link?.props.href).toBe(detailPath)
    const event = await click(link, modifiers)
    expect(event.defaultPrevented).toBe(false)
    expect(router.currentRoute.value.path).toBe('/desktop')
    expect(preview).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('预览按钮不嵌套在链接内，仍将原资源发给现有弹窗调用方', async () => {
    const { elements, router, preview } = await mountCard(wallpaper)
    const button = elements.find(element => element.tag === 'button')
    expect(button?.props.type).toBe('button')
    expect(button.parent.tag).not.toBe('a')
    await click(button)
    expect(preview).toHaveBeenCalledExactlyOnceWith(wallpaper)
    expect(router.currentRoute.value.path).toBe('/desktop')
    expect(elements.filter(element => element.props.role === 'button')).toHaveLength(0)
  })

  it('无稳定资源身份时不伪造详情href，快速预览仍可使用', async () => {
    const { elements, preview } = await mountCard({ filename: 'unknown.jpg', url: 'https://example.com/unknown.jpg' })
    expect(elements.filter(element => element.tag === 'a')).toHaveLength(0)
    const button = elements.find(element => element.tag === 'button')
    expect(button).toBeDefined()
    await click(button)
    expect(preview).toHaveBeenCalledOnce()
  })
})
