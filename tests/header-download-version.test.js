import { readFileSync } from 'node:fs'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as version from '../src/utils/update/version'

const downloads = [
  'https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/download/desktop/Wallpaper-Gallery-macOS-universal.dmg',
  'https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/download/desktop/Wallpaper-Gallery-Windows-x64.msi',
  'https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/download/desktop/Wallpaper-Gallery-linux-x86_64.AppImage',
]
const manifest = {
  available: true,
  version: '5.2.0',
  publishedAt: '2026-11-10T02:01:29Z',
  releaseUrl: 'https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/tag/desktop',
  notesUrl: 'https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/tag/v5.2.0',
  downloads: { macos: downloads[0], windows: downloads[1], linux: downloads[2] },
}
const mounted = []

function renderDownload() {
  const filename = '../src/components/layout/header/HeaderDesktopDownload.vue'
  const { descriptor } = parse(readFileSync(new URL(filename, import.meta.url), 'utf8'))
  const dependencies = { vue: Vue, '@/utils/update/version': version }
  const content = compileScript(descriptor, { id: filename, inlineTemplate: true }).content
    .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (_, names, dependency) => `const {${names.replace(/\bas\b/g, ':')}} = dependencies[${JSON.stringify(dependency)}]`)
    .replace('export default', 'return')
  const component = new Function('dependencies', content)(dependencies)
  const root = { children: [] }
  const renderer = Vue.createRenderer({
    createElement: type => ({ type, props: {}, children: [] }), createText: text => ({ text }), createComment: () => ({}),
    insert(el, parent, anchor) {
      if (el.parent) {
        const index = el.parent.children.indexOf(el)
        if (index >= 0) el.parent.children.splice(index, 1)
      }
      const index = anchor ? parent.children.indexOf(anchor) : -1
      if (index < 0) parent.children.push(el)
      else parent.children.splice(index, 0, el)
      el.parent = parent
    },
    remove(el) { const siblings = el.parent?.children || []; const index = siblings.indexOf(el); if (index >= 0) siblings.splice(index, 1) },
    setText(el, text) { el.text = text }, setElementText(el, text) { el.text = text; el.children = [] },
    patchProp(el, key, _previous, value) { el.props[key] = value }, parentNode: el => el.parent,
    nextSibling: el => el.parent?.children?.[el.parent.children.indexOf(el) + 1] || null,
  })
  const app = renderer.createApp(component)
  app.component('el-dropdown', {
    inheritAttrs: false,
    emits: ['visible-change'],
    setup: (_props, { emit, slots }) => () => Vue.h('section', { onOpen: () => emit('visible-change', true), onClose: () => emit('visible-change', false) }, [slots.default?.(), slots.dropdown?.()]),
  })
  app.mount(root)
  mounted.push(app)
  const nodes = () => {
    const result = []
    const visit = el => { result.push(el); el.children?.forEach(visit) }
    visit(root)
    return result
  }
  const textOf = el => (el.text || '') + (el.children?.map(textOf).join('') || '')
  return {
    app, nodes, textOf,
    open: () => nodes().find(el => el.type === 'section').props.onOpen(),
    close: () => nodes().find(el => el.type === 'section').props.onClose(),
    text: () => textOf(root),
    links: () => nodes().filter(el => el.type === 'a'),
  }
}

async function settle() {
  for (let index = 0; index < 15; index++) await Vue.nextTick()
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-10T03:00:00Z')) })
afterEach(() => { mounted.splice(0).forEach(app => app.unmount()); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('客户端下载发布版本', () => {
  it('首次展开才读取发布清单，三个平台显示发布版本并缓存五分钟', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => manifest })
    vi.stubGlobal('fetch', fetch)
    const view = renderDownload()
    expect(fetch).not.toHaveBeenCalled()
    expect(view.links().map(el => el.props.href)).toEqual(downloads)
    view.open()
    await Vue.nextTick()
    expect(view.text()).toContain('正在读取版本')
    await settle()
    expect(fetch).toHaveBeenCalledWith('/api/desktop-release', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    for (const [index, name] of ['macOS', 'Windows', 'Linux'].entries()) {
      expect(view.textOf(view.links()[index])).toContain(`${name} 客户端`)
      expect(view.textOf(view.links()[index])).toContain('v5.2.0')
    }
    expect(view.text()).toMatch(/更新于.*2026.*11.*10/)
    view.close()
    view.open()
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(300000)
    view.close()
    view.open()
    await settle()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['未发布', { ok: true, json: async () => ({ ...manifest, available: false }) }],
    ['HTTP 失败', { ok: false, status: 503, json: async () => manifest }],
    ['无效清单', { ok: true, json: async () => ({ ...manifest, version: '5.2.0-beta' }) }],
  ])('%s 不伪造版本、保留下载链接，下次展开可重试', async (_label, response) => {
    const fetch = vi.fn().mockResolvedValueOnce(response).mockResolvedValue({ ok: true, json: async () => manifest })
    vi.stubGlobal('fetch', fetch)
    const view = renderDownload()
    view.open()
    await settle()
    expect(view.text()).toContain('版本信息暂不可用')
    expect(view.text()).not.toContain('v5.2.0')
    expect(view.links().map(el => el.props.href)).toEqual(downloads)
    view.close()
    view.open()
    await settle()
    expect(view.links().every(el => view.textOf(el).includes('v5.2.0'))).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('缓存过期刷新失败时清除旧版本，下次展开重新读取发布版本', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => manifest })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ ok: true, json: async () => ({ ...manifest, version: '5.2.1' }) })
    vi.stubGlobal('fetch', fetch)
    const view = renderDownload()
    view.open()
    await settle()
    expect(view.text()).toContain('v5.2.0')
    await vi.advanceTimersByTimeAsync(300000)
    view.close()
    view.open()
    await settle()
    expect(view.text()).toContain('版本信息暂不可用')
    expect(view.text()).not.toContain('v5.2.0')
    expect(view.links().map(el => el.props.href)).toEqual(downloads)
    view.close()
    view.open()
    await settle()
    expect(view.links().every(el => view.textOf(el).includes('v5.2.1'))).toBe(true)
  })

  it('八秒后结束悬挂响应，保留链接且允许重试', async () => {
    let signal
    const fetch = vi.fn().mockImplementationOnce((_url, options) => { signal = options.signal; return new Promise(() => {}) })
      .mockResolvedValue({ ok: true, json: async () => manifest })
    vi.stubGlobal('fetch', fetch)
    const view = renderDownload()
    view.open()
    await vi.advanceTimersByTimeAsync(8000)
    await settle()
    expect(signal.aborted).toBe(true)
    expect(view.text()).toContain('版本信息暂不可用')
    expect(view.links().map(el => el.props.href)).toEqual(downloads)
    view.close()
    view.open()
    await settle()
    expect(view.text()).toContain('v5.2.0')
  })

  it('卸载取消请求，忽略迟到结果且不遗留定时器', async () => {
    let finish
    let signal
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options) => { signal = options.signal; return new Promise(resolve => { finish = resolve }) }))
    const view = renderDownload()
    view.open()
    await Vue.nextTick()
    const menu = view.nodes().find(el => el.props?.class === 'desktop-download-menu')
    view.app.unmount()
    mounted.splice(mounted.indexOf(view.app), 1)
    expect(signal.aborted).toBe(true)
    finish({ ok: true, json: async () => manifest })
    await settle()
    expect(view.textOf(menu)).not.toContain('v5.2.0')
    expect(vi.getTimerCount()).toBe(0)
  })
})
