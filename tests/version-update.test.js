import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVersionChecker } from '../src/composables/useVersionCheck'
import { compareVersions, fetchUpdateJson, parseVersion, validateDesktopRelease } from '../src/utils/update/version'

const releaseUrl = 'https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/tag/v5.2.0'
const manifest = () => ({ available: true, version: '5.2.0', releaseUrl, notesUrl: releaseUrl, downloads: { windows: 'https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/download/v5.2.0/app.msi', macos: 'https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/download/v5.2.0/app.dmg' } })
let win, doc, fetchImpl, invoke, store
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  const windowHandlers = new Map(), documentHandlers = new Map()
  win = { location: { href: 'https://wallpaper.061129.xyz/desktop?q=山' }, addEventListener: (name, handler) => windowHandlers.set(name, handler), removeEventListener: name => windowHandlers.delete(name), handlers: windowHandlers }
  doc = { visibilityState: 'visible', addEventListener: (name, handler) => documentHandlers.set(name, handler), removeEventListener: name => documentHandlers.delete(name), handlers: documentHandlers }
  store = new Map()
  invoke = vi.fn(async () => ({ appVersion: '5.1.2' }))
  fetchImpl = vi.fn(async url => ({ ok: true, json: async () => url.startsWith('/api') ? manifest() : { version: '5.2.0' } }))
})
afterEach(() => { vi.useRealTimers() })
function checker(options = {}) {
  return createVersionChecker({ currentVersion: '5.1.2', fetchImpl, getWindow: () => win, getDocument: () => doc, getNavigator: () => ({ userAgent: 'Windows' }), getStorage: () => ({ getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) }), ...options })
}
function native() { win.__TAURI__ = { core: { invoke } } }

describe('版本和发布数据边界', () => {
  it('只接受严格 x.y.z，拒绝预发布、坏格式、不安全数字和假下载地址', () => {
    for (const value of ['5.2', 'v5.2.0', '5.2.0-beta', '05.2.0', '1.2.NaN', '9007199254740992.1.1', null]) expect(parseVersion(value)).toBeNull()
    expect(compareVersions('5.2.0', '5.1.12')).toBe(1)
    expect(compareVersions('5.2.0', '5.2.0')).toBe(0)
    expect(compareVersions('bad', '5.2.0')).toBeNull()
    expect(validateDesktopRelease({ ...manifest(), available: false })).toBeNull()
    expect(validateDesktopRelease({ ...manifest(), releaseUrl: 'https://evil.example/a' })).toBeNull()
    expect(validateDesktopRelease({ ...manifest(), downloads: { windows: 'javascript:alert(1)' } }, 'Windows').downloadUrl).toBe(releaseUrl)
    expect(validateDesktopRelease(manifest(), 'Macintosh').downloadUrl).toContain('app.dmg')
    expect(validateDesktopRelease(manifest(), 'Unknown').downloadUrl).toBe(releaseUrl)
  })
  it('8秒超时覆盖响应体且支持取消，晚响应不会成为成功', async () => {
    const promise = fetchUpdateJson('/version.json', { fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }) })
    const assertion = expect(promise).rejects.toThrow('UPDATE_CANCELLED')
    await vi.advanceTimersByTimeAsync(8000)
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('网页和客户端更新状态', () => {
  it('立即区分浏览器与native，安装版本独立于网页版本，失败不假报最新', async () => {
    const browser = checker()
    expect(browser.isNativeClient.value).toBe(false)
    native()
    const state = checker({ currentVersion: '5.2.0' })
    expect(state.isNativeClient.value).toBe(true)
    expect(state.clientVersion.value).toBe('')
    invoke.mockResolvedValue({ appVersion: '5.1.2' })
    fetchImpl.mockImplementation(async url => ({ ok: !url.startsWith('/api'), json: async () => ({ version: '5.2.0' }) }))
    await state.checkForUpdates({ manual: true })
    expect(state.clientVersion.value).toBe('5.1.2')
    expect(state.currentVersion).toBe('5.2.0')
    expect(state.clientState.value).toBe('current')
    expect(state.clientCheckResult.value).toBe('error')
    expect(state.latestClientInfo.value).toBeNull()
    expect(state.hasNewVersion.value).toBe(false)
  })
  it('手动检查重新展示同版本更新，且区分current与available=false', async () => {
    native()
    const state = checker({ currentVersion: '5.2.0' })
    await state.checkForUpdates()
    state.dismissUpdate()
    expect(state.hasNewVersion.value).toBe(false)
    await state.checkForUpdates({ manual: true })
    expect(state.newVersionInfo.value.kind).toBe('desktop')
    expect(state.clientCheckResult.value).toBe('update')
    state.dismissUpdate()
    await state.checkForUpdates()
    expect(state.hasNewVersion.value).toBe(false)
    fetchImpl.mockImplementation(async url => ({ ok: true, json: async () => url.startsWith('/api') ? { available: false } : { version: '5.2.0' } }))
    await state.checkForUpdates({ manual: true })
    expect(state.clientCheckResult.value).toBe('unavailable')
    const current = checker({ currentVersion: '5.2.0' })
    invoke.mockResolvedValue({ appVersion: '5.2.0' })
    fetchImpl.mockImplementation(async url => ({ ok: true, json: async () => url.startsWith('/api') ? manifest() : { version: '5.2.0' } }))
    await current.checkForUpdates({ manual: true })
    expect(current.clientCheckResult.value).toBe('current')
    expect(current.clientVersion.value).toBe('5.2.0')
    expect(current.hasNewVersion.value).toBe(false)
  })
  it('网页仅请求version，不请求native manifest；更新通过用户按钮刷新', async () => {
    const state = checker()
    await state.checkForUpdates()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(invoke).not.toHaveBeenCalled()
    expect(state.newVersionInfo.value).toMatchObject({ kind: 'web', latest: '5.2.0' })
    expect(win.location.href).not.toContain('_t=')
    state.forceRefresh()
    expect(win.location.href).toContain('_t=')
  })
  it.each(['5.1.2', '5.2.0', '5.3.0'])('原生已知版本%s只在安装版本较旧时提示', async version => {
    native()
    invoke.mockResolvedValue({ appVersion: version })
    const state = checker({ currentVersion: '5.2.0' })
    await state.checkForUpdates()
    expect(state.hasNewVersion.value).toBe(version === '5.1.2')
    if (version === '5.1.2') expect(state.newVersionInfo.value.downloadUrl).toContain('app.msi')
  })
  it.each(['Command wallpaper_capabilities not found', 'wallpaper_capabilities not allowed', 'permission denied'])('旧壳明确拒绝%s才显示建议安装', async error => {
    native()
    invoke.mockRejectedValue(error)
    const state = checker({ currentVersion: '5.2.0' })
    await state.checkForUpdates()
    expect(state.newVersionInfo.value).toMatchObject({ kind: 'desktop', legacy: true })
    expect(state.clientState.value).toBe('legacy')
    expect(state.clientVersion.value).toBe('')
  })
  it('generic错误/超时/缺桥不误判旧客户端，available=false不提醒安装', async () => {
    native()
    invoke.mockRejectedValue('temporary failure')
    const state = checker({ currentVersion: '5.2.0' })
    await state.checkForUpdates()
    expect(state.hasNewVersion.value).toBe(false)
    invoke.mockImplementation(() => new Promise(() => {}))
    const pending = state.checkForUpdates()
    await vi.advanceTimersByTimeAsync(8000)
    await pending
    expect(state.hasNewVersion.value).toBe(false)
    invoke.mockRejectedValue('Command not found')
    fetchImpl.mockResolvedValue({ ok: true, json: async () => ({ ...manifest(), available: false }) })
    await state.checkForUpdates()
    expect(state.hasNewVersion.value).toBe(false)
  })
  it('native桥尚未初始化或appVersion无效时等待下一次检查，不建议安装', async () => {
    win.__TAURI_INTERNALS__ = {}
    const state = checker({ currentVersion: '5.2.0' })
    await state.checkForUpdates()
    expect(state.hasNewVersion.value).toBe(false)
    native()
    invoke.mockResolvedValue({ appVersion: '5.2.0-beta' })
    await state.checkForUpdates()
    expect(state.hasNewVersion.value).toBe(false)
    invoke.mockResolvedValue({ appVersion: '5.1.2' })
    await state.checkForUpdates()
    expect(state.newVersionInfo.value.kind).toBe('desktop')
  })
  it('desktop优先，按kind/version忽略后显示web，同版本不重弹且存储失败安全', async () => {
    native()
    const state = checker()
    await state.checkForUpdates()
    expect(state.newVersionInfo.value.kind).toBe('desktop')
    state.dismissUpdate()
    expect(state.newVersionInfo.value.kind).toBe('web')
    state.dismissUpdate()
    await state.checkForUpdates()
    expect(state.hasNewVersion.value).toBe(false)
    const restored = checker()
    await restored.checkForUpdates()
    expect(restored.hasNewVersion.value).toBe(false)
    const restricted = checker({ getStorage() { throw new Error('blocked') } })
    await restricted.checkForUpdates()
    restricted.dismissUpdate()
    restricted.dismissUpdate()
    expect(restricted.hasNewVersion.value).toBe(false)
    fetchImpl.mockImplementation(async url => ({ ok: true, json: async () => url.startsWith('/api') ? { ...manifest(), version: '5.2.1' } : { version: '5.2.1' } }))
    await state.checkForUpdates()
    expect(state.newVersionInfo.value).toMatchObject({ kind: 'desktop', latest: '5.2.1' })
  })
  it('无效/网络失败版本静默，旧legacy发布低于5.2不提醒', async () => {
    fetchImpl.mockResolvedValue({ ok: true, json: async () => ({ version: '5.2.0-beta' }) })
    const state = checker()
    await state.checkForUpdates()
    expect(state.hasNewVersion.value).toBe(false)
    fetchImpl.mockRejectedValue(new Error('offline'))
    await state.checkForUpdates()
    expect(state.isChecking.value).toBe(false)
    native()
    invoke.mockRejectedValue('Command not found')
    fetchImpl.mockImplementation(async url => ({ ok: true, json: async () => url.startsWith('/api') ? { ...manifest(), version: '5.1.9' } : { version: '5.1.2' } }))
    await state.checkForUpdates()
    expect(state.hasNewVersion.value).toBe(false)
  })
})

describe('头部安装版本组件', () => {
  function renderHeader(state) {
    const filename = '../src/components/layout/header/HeaderClientVersion.vue'
    const { descriptor } = parse(readFileSync(new URL(filename, import.meta.url), 'utf8'))
    const dependencies = {
      vue: Vue,
      'element-plus': {
        ElPopover: { setup: (_props, { slots }) => () => h('section', [slots.reference?.(), slots.default?.()]) },
        ElButton: { setup: (_props, { attrs, slots }) => () => h('button', attrs, slots.default?.()) },
      },
      '@/composables/useVersionCheck': { useVersionCheck: () => state },
    }
    const content = compileScript(descriptor, { id: filename, inlineTemplate: true }).content
      .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (_, names, dependency) => `const {${names.replace(/\bas\b/g, ':')}} = dependencies[${JSON.stringify(dependency)}]`)
      .replace('export default', 'return')
    const component = new Function('dependencies', content)(dependencies)
    const root = { children: [] }
    const renderer = createRenderer({
      createElement: type => ({ type, props: {}, children: [] }), createText: text => ({ text }), createComment: () => ({}),
      insert(el, parent) { parent.children ||= []; parent.children.push(el); el.parent = parent },
      remove(el) { const siblings = el.parent?.children || []; const index = siblings.indexOf(el); if (index >= 0) siblings.splice(index, 1) },
      setText(el, text) { el.text = text }, setElementText(el, text) { el.children = []; el.text = text },
      patchProp(el, key, previous, value) { el.props[key] = value }, parentNode: el => el.parent, nextSibling: () => null,
    })
    const app = renderer.createApp(component)
    app.mount(root)
    const nodes = () => { const result = []; const visit = el => { result.push(el); (el.children || []).forEach(visit) }; visit(root); return result }
    return { app, nodes, text: () => nodes().map(el => el.text || '').join(' ') }
  }
  it('浏览器隐藏版本入口，native分别展示安装版本和网页版本并提供手动检查', async () => {
    const browser = renderHeader(checker())
    expect(browser.nodes().some(el => el.type === 'button')).toBe(false)
    browser.app.unmount()
    native()
    const state = checker({ currentVersion: '5.2.0' })
    const header = renderHeader(state)
    expect(header.text()).toContain('读取客户端版本')
    expect(header.text()).not.toContain('客户端 v5.2.0')
    await state.checkForUpdates()
    await nextTick()
    expect(header.text()).toContain('客户端 v5.1.2')
    expect(header.text()).toContain('网页 v5.2.0')
    expect(header.nodes().some(el => el.type === 'a' && el.props.href?.includes('app.msi'))).toBe(true)
    state.dismissUpdate()
    const check = header.nodes().find(el => el.type === 'button' && el.props.class === 'client-version-check')
    await check.props.onClick()
    expect(state.hasNewVersion.value).toBe(true)
    header.app.unmount()
  })
  it('legacy显示未知安装版本；检查503显示失败且不展示最新或下载链接', async () => {
    native()
    invoke.mockRejectedValue('Command wallpaper_capabilities not found')
    const state = checker({ currentVersion: '5.2.0' })
    const header = renderHeader(state)
    await state.checkForUpdates()
    await nextTick()
    expect(header.text()).toContain('旧版客户端')
    expect(header.text()).not.toContain('客户端 v5.2.0')
    fetchImpl.mockImplementation(async url => ({ ok: !url.startsWith('/api'), status: 503, json: async () => ({ version: '5.2.0' }) }))
    await state.checkForUpdates({ manual: true })
    await nextTick()
    expect(header.text()).toContain('检查未完成')
    expect(header.text()).not.toContain('已是最新')
    expect(header.nodes().some(el => el.type === 'a')).toBe(false)
    expect(state.hasNewVersion.value).toBe(false)
    header.app.unmount()
  })
})

describe('可见性和引用计数', () => {
  it('初始pageshow/focus不抢占或推迟5秒首次检查', async () => {
    const state = checker()
    state.retain()
    win.handlers.get('pageshow')()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchImpl).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(3000)
    win.handlers.get('focus')()
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    state.release()
  })
  it('共享保留仅一个5秒任务，10分钟检查，前台事件1分钟节流，最后释放清理', async () => {
    const state = checker()
    state.retain()
    state.retain()
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(4999)
    expect(fetchImpl).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    win.handlers.get('focus')()
    win.handlers.get('pageshow')()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(600000)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    doc.visibilityState = 'hidden'
    doc.handlers.get('visibilitychange')()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(600000)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    doc.visibilityState = 'visible'
    doc.handlers.get('visibilitychange')()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    state.release()
    expect(win.handlers.size).toBe(2)
    state.release()
    expect(win.handlers.size).toBe(0)
    expect(doc.handlers.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('最后卸载取消悬挂请求且迟到结果不更新状态', async () => {
    let finish
    fetchImpl.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const state = checker()
    state.retain()
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.isChecking.value).toBe(true)
    state.release()
    finish({ ok: true, json: async () => ({ version: '5.2.0' }) })
    await vi.advanceTimersByTimeAsync(0)
    expect(state.isChecking.value).toBe(false)
    expect(state.hasNewVersion.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('最后卸载也取消native探测超时定时器，不留下轮询', async () => {
    native()
    invoke.mockImplementation(() => new Promise(() => {}))
    const state = checker()
    state.retain()
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.isChecking.value).toBe(true)
    state.release()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.isChecking.value).toBe(false)
    expect(state.hasNewVersion.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
import { readFileSync } from 'node:fs'
import * as Vue from 'vue'
import { createRenderer, h, nextTick } from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
