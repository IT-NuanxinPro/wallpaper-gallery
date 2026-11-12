import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as VueRouter from 'vue-router'
import { useDevice } from '../src/composables/useDevice.js'
import * as format from '../src/utils/common/format.js'
import * as constants from '../src/utils/config/constants.js'
import * as displayTitle from '../src/utils/wallpaper/displayTitle.js'
import * as mediaPresentation from '../src/utils/wallpaper/mediaPresentation.js'
import * as share from '../src/utils/wallpaper/share.js'
import { vCardReveal } from '../src/components/wallpaper/WallpaperGrid/composables/cardReveal.js'
import * as detailService from '../src/services/wallpaperDetailService.js'
import * as detailTransition from '../src/utils/wallpaper/detailTransition.js'
import * as identity from '../src/utils/wallpaper/identity.js'

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
  '@/router/wallpaperDetailRoute': { loadWallpaperDetailView: async () => ({ default: { render: () => null } }) },
  '@/services/wallpaperDetailService': detailService,
  '@/utils/common/format': format,
  '@/utils/config/constants': constants,
  '@/utils/wallpaper/displayTitle': displayTitle,
  '@/utils/wallpaper/detailTransition': detailTransition,
  '@/utils/wallpaper/identity': identity,
  '@/utils/wallpaper/mediaPresentation': mediaPresentation,
  '@/utils/wallpaper/share': share,
  '../WallpaperGrid/composables/cardReveal': { vCardReveal },
  './shared/WallpaperCardMedia.vue': media,
  './shared/WallpaperCardInfo.vue': info,
})

const apps = []
afterEach(() => apps.splice(0).forEach(app => app.unmount()))

async function mountCard(wallpaper, props = {}) {
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
  const navigate = vi.fn()
  const app = renderer.createApp({ render: () => Vue.h(card, { wallpaper, onNavigate: navigate, ...props }) })
  app.use(router)
  app.mount({ children: [] })
  apps.push(app)
  return { elements, router, navigate }
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

describe('卡片仅保留详情入口', () => {
  it('卡片携带稳定资源身份供返回定位，整张链接获得焦点时响应', async () => {
    const { elements } = await mountCard(wallpaper, { series: 'desktop' })
    const link = elements.find(element => element.tag === 'a')
    expect(link.props['data-wallpaper-asset-key']).toBe(identity.buildWallpaperAssetKey(wallpaper, 'desktop'))
    link.props.onFocus()
    await Vue.nextTick()
    expect(elements.find(element => element.props.class?.includes?.('wallpaper-card'))?.props.class).toContain('is-media-hovered')
    link.props.onBlur()
    await Vue.nextTick()
    expect(elements.find(element => element.props.class?.includes?.('wallpaper-card'))?.props.class).not.toContain('is-media-hovered')
  })
  it.each(['desktop', 'mobile', 'avatar', 'video'])('%s 卡片的标题与替代文本不残留文件后缀', async (series) => {
    const item = { ...wallpaper, _series: series, displayTitle: '山间__晨光.custom123', mediaType: series === 'video' ? 'video' : 'image' }
    const { elements } = await mountCard(item)
    expect(elements.some(element => element.tag === 'span' && element.text === '山间 晨光')).toBe(true)
    expect(elements.find(element => element.tag === 'img')?.props.alt).toContain('山间 晨光')
    expect(elements.find(element => element.tag === 'img')?.props.alt).not.toContain('.custom123')
  })
  it('静态卡片保留显式自定义比例，视频继续按用途使用横竖比例', async () => {
    const staticCard = await mountCard(wallpaper, { aspectRatio: '4/3' })
    expect(staticCard.elements.some(element => element.props.style?.aspectRatio === '4 / 3')).toBe(true)
    const mobileVideo = await mountCard({ ...wallpaper, mediaType: 'video', usage: 'mobile' }, { aspectRatio: '4/3' })
    expect(mobileVideo.elements.some(element => element.props.style?.aspectRatio === '9 / 16')).toBe(true)
    const desktopVideo = await mountCard({ ...wallpaper, mediaType: 'video', usage: 'desktop' }, { aspectRatio: '4/3' })
    expect(desktopVideo.elements.some(element => element.props.style?.aspectRatio === '16 / 9')).toBe(true)
  })
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
    const { elements, router, navigate } = await mountCard(wallpaper)
    const link = elements.find(element => element.tag === 'a')
    expect(link?.props.href).toBe(detailPath)
    const image = elements.find(element => element.tag === 'img')
    expect(image.parent.parent).toBe(link)
    expect(elements.some(element => element.props.class === 'card-info' && element.parent === link)).toBe(true)
    await click(link)
    expect(router.currentRoute.value.path).toBe(detailPath)
    expect(detailService.readReadyWallpaperDetail(detailPath.split('/').at(-1))).toMatchObject({ displayTitle: '湖光', _series: 'desktop' })
    expect(navigate).toHaveBeenCalledOnce()
  })

  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])('修饰键或非主按键保留浏览器默认行为 %j', async (modifiers) => {
    const { elements, router, navigate } = await mountCard(wallpaper)
    const link = elements.find(element => element.tag === 'a')
    expect(link?.props.href).toBe(detailPath)
    const event = await click(link, modifiers)
    expect(event.defaultPrevented).toBe(false)
    expect(router.currentRoute.value.path).toBe('/desktop')
    expect(navigate).not.toHaveBeenCalled()
  })

  it.each(['desktop', 'mobile', 'avatar', 'video', 'bing'])('%s 卡片没有快速预览按钮，点击只有真实详情路由', async (series) => {
    const item = series === 'bing'
      ? { filename: 'bing-2026-11-12.jpg', _series: 'bing', isBing: true, date: '2026-11-12', urlbase: '/th?id=OHR.Lake' }
      : { ...wallpaper, _series: series, path: `/wallpaper/${series}/lake.${series === 'video' ? 'mp4' : 'jpg'}`, mediaType: series === 'video' ? 'video' : 'image' }
    const { elements, router } = await mountCard(item, { series })
    expect(elements.filter(element => element.tag === 'button' || element.props.role === 'button')).toHaveLength(0)
    const link = elements.find(element => element.tag === 'a')
    expect(link?.props.href).toBe(share.buildWallpaperSharePath(item, series))
    await click(link)
    expect(router.currentRoute.value.path).toBe(link.props.href)
  })

  it('无稳定资源身份时不伪造详情href或保留退役预览入口', async () => {
    const { elements } = await mountCard({ filename: 'unknown.jpg', url: 'https://example.com/unknown.jpg' })
    expect(elements.filter(element => element.tag === 'a')).toHaveLength(0)
    expect(elements.filter(element => element.tag === 'button')).toHaveLength(0)
  })
})
