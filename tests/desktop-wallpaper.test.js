import { readFile } from 'node:fs/promises'
import * as Vue from 'vue'
import { createRenderer, h, nextTick, ref } from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDesktopWallpaperState, useDesktopWallpaper } from '../src/composables/useDesktopWallpaper'
import { buildDesktopWallpaperItem, createDesktopWallpaperService } from '../src/services/desktopWallpaperService'

const picture = (name = 'a.jpg') => ({ _series: 'desktop', path: `/wallpaper/desktop/自然/${name}`, filename: name, title: name, url: `/images/v1.2.63/wallpaper/desktop/%E8%87%AA%E7%84%B6/${name}` })
const capabilities = { supported: true, platform: 'macos', reason: null, version: 1, supportedFormats: ['jpg', 'jpeg', 'png'], supportsBing: false }
const status = () => ({ supported: true, enabled: false, intervalMinutes: 60, current: null, previous: null, lastError: null, cacheCount: 0 })
let invoke
beforeEach(() => {
  vi.useFakeTimers()
  invoke = vi.fn(async command => command === 'wallpaper_capabilities' ? capabilities : status())
  vi.stubGlobal('window', { __TAURI__: { core: { invoke } } })
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('原生壁纸边界', () => {
  it('浏览器不调用 IPC，旧客户端缺命令显示升级，探测缓存且可重试', async () => {
    window.__TAURI__ = undefined
    const state = createDesktopWallpaperState(createDesktopWallpaperService())
    await state.initialize()
    expect(invoke).not.toHaveBeenCalled()
    expect(state.phase.value).toBe('browser')
    window.__TAURI__ = { core: { invoke } }
    invoke.mockRejectedValue('Command wallpaper_capabilities not found')
    await state.initialize(true)
    expect(state.phase.value).toBe('upgrade')
    expect(state.error.value).toContain('升级')
    await state.initialize()
    expect(invoke).toHaveBeenCalledTimes(1)
    invoke.mockResolvedValue(capabilities)
    await state.initialize(true)
    expect(state.phase.value).toBe('ready')
  })
  it('只接受真实可信原图、规范完整身份及 JPG/PNG，拒绝身份不匹配和任意 URL', () => {
    expect(buildDesktopWallpaperItem(picture()).item).toMatchObject({ assetKey: 'desktop:path:/wallpaper/desktop/%E8%87%AA%E7%84%B6/a.jpg', url: 'https://wallpaper.061129.xyz/images/v1.2.63/wallpaper/desktop/%E8%87%AA%E7%84%B6/a.jpg' })
    for (const value of [
      { ...picture(), url: 'https://evil.example/a.jpg' },
      { ...picture(), url: '/images/v1.2.63/wallpaper/desktop/other.jpg' },
      { ...picture(), url: '/images/main/wallpaper/desktop/a.jpg' },
      { ...picture(), url: picture().url + '?token=secret' },
      { ...picture(), url: '/images/v1.2.63/wallpaper/desktop/%252e%252e/a.jpg' },
      { ...picture(), mediaType: 'video' },
      { ...picture(), _series: 'bing', isBing: true },
      picture('a.webp'), picture('a.gif'),
    ]) expect(buildDesktopWallpaperItem(value).item).toBeNull()
    expect(buildDesktopWallpaperItem(picture('a.webp')).reason).toContain('JPG')
    for (const filename of ['wallhaven壁纸_#7743.jpg', 'question?.png']) {
      const value = picture(filename)
      value.url = `/images/v1.2.63/wallpaper/desktop/%E8%87%AA%E7%84%B6/${encodeURIComponent(filename)}`
      expect(buildDesktopWallpaperItem(value).item).not.toBeNull()
    }
  })
  it('预检格式和 capability，操作防重复，仅 native apply 完成才返回成功', async () => {
    const state = createDesktopWallpaperState(createDesktopWallpaperService())
    expect(await state.apply(picture())).toBe(false)
    await state.initialize()
    let resolve
    invoke.mockImplementation(command => command === 'wallpaper_apply' ? new Promise(done => { resolve = done }) : Promise.resolve(status()))
    const pending = state.apply(picture())
    expect(state.busy.value).toBe(true)
    expect(state.message.value).toBe('')
    expect(await state.apply(picture())).toBe(false)
    resolve({ ...status(), current: buildDesktopWallpaperItem(picture()).item })
    expect(await pending).toBe(true)
    expect(state.message.value).toContain('已设置')
    expect(invoke.mock.calls.filter(([command]) => command === 'wallpaper_apply')).toHaveLength(1)
    expect(invoke.mock.calls.every(([command]) => command.startsWith('wallpaper_'))).toBe(true)
  })
  it('原生拒绝不报成功，旧 status 不覆盖更新操作；启用只报告计划保存', async () => {
    const state = createDesktopWallpaperState(createDesktopWallpaperService())
    await state.initialize()
    let finishStatus
    invoke.mockImplementation(command => command === 'wallpaper_rotation_status' ? new Promise(done => { finishStatus = done }) : Promise.resolve({ ...status(), enabled: true }))
    const poll = state.refreshStatus()
    await state.configure({ enabled: true, intervalMinutes: 60, items: [picture()] })
    expect(state.message.value).toContain('客户端运行时按计划更换')
    finishStatus(status())
    await poll
    expect(state.status.value.enabled).toBe(true)
    invoke.mockRejectedValue('private stack trace /Users/test/token')
    expect(await state.apply(picture())).toBe(false)
    expect(state.message.value).toBe('')
    expect(state.error.value).not.toContain('/Users')
  })
  it('停止不需要登录和队列，恢复必须有 previous，启用去重且有界', async () => {
    const state = createDesktopWallpaperState(createDesktopWallpaperService())
    await state.initialize()
    expect(await state.restore()).toBe(false)
    expect(await state.configure({ enabled: false, intervalMinutes: 60, items: [] })).toBe(true)
    expect(invoke).toHaveBeenLastCalledWith('wallpaper_configure_rotation', { config: { enabled: false, intervalMinutes: 60, items: [] } })
    expect(await state.configure({ enabled: true, intervalMinutes: 1, items: [picture()] })).toBe(false)
    expect(await state.configure({ enabled: true, intervalMinutes: 60, items: [] })).toBe(false)
    expect(await state.configure({ enabled: true, intervalMinutes: 60, items: [picture(), picture()] })).toBe(true)
    expect(invoke.mock.calls.at(-1)[1].config.items).toHaveLength(1)
  })
  it('状态读取恢复成功仅清读取错误，不清除其他操作错误', async () => {
    const state = createDesktopWallpaperState(createDesktopWallpaperService())
    await state.initialize()
    invoke.mockRejectedValueOnce('read failed')
    expect(await state.refreshStatus()).toBe(false)
    expect(state.error.value).toContain('暂时无法读取')
    expect(await state.refreshStatus()).toBe(true)
    expect(state.error.value).toBe('')
    invoke.mockRejectedValueOnce('apply failed')
    expect(await state.apply(picture())).toBe(false)
    const actionError = state.error.value
    expect(actionError).toContain('客户端操作未完成')
    expect(await state.refreshStatus()).toBe(true)
    expect(state.error.value).toBe(actionError)
  })
  it('不支持平台保留原因，不暴露可用操作；损坏 DTO 不算支持', async () => {
    invoke.mockResolvedValue({ ...capabilities, supported: false, reason: '当前桌面环境暂不支持' })
    const state = createDesktopWallpaperState(createDesktopWallpaperService())
    await state.initialize()
    expect(state.phase.value).toBe('unsupported')
    expect(state.error.value).toContain('当前桌面环境暂不支持')
    expect(await state.apply(picture())).toBe(false)
    invoke.mockResolvedValue({ supported: true })
    await state.initialize(true)
    expect(state.phase.value).not.toBe('ready')
  })
})

describe('轮换状态轮询生命周期', () => {
  it('仅面板可见且页面前台时轮询，隐藏和卸载释放定时器', async () => {
    const listeners = new Map()
    vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: name => listeners.delete(name) })
    const visible = ref(true)
    const state = createDesktopWallpaperState(createDesktopWallpaperService())
    const renderer = createRenderer({ createComment: () => ({}), createText: () => ({}), createElement: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode() {}, nextSibling() {} })
    const app = renderer.createApp({ setup() { useDesktopWallpaper({ visible, poll: true, state }); return () => null } })
    app.mount({})
    for (let i = 0; i < 8; i++) await nextTick()
    await vi.advanceTimersByTimeAsync(10000)
    expect(invoke.mock.calls.filter(([command]) => command === 'wallpaper_rotation_status').length).toBeGreaterThan(0)
    document.visibilityState = 'hidden'
    listeners.get('visibilitychange')()
    const count = invoke.mock.calls.length
    await vi.advanceTimersByTimeAsync(30000)
    expect(invoke).toHaveBeenCalledTimes(count)
    document.visibilityState = 'visible'
    listeners.get('visibilitychange')()
    visible.value = false
    await nextTick()
    expect(vi.getTimerCount()).toBe(0)
    app.unmount()
    expect(listeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('原生控件实际组件', () => {
  async function render(componentPath, props) {
    vi.resetModules()
    const feedback = { success: vi.fn(), error: vi.fn() }
    const wrapper = { inheritAttrs: false, setup: (_props, { slots }) => () => slots.default?.() }
    const dependencies = {
      vue: { ...Vue, Teleport: wrapper, Transition: Vue.BaseTransition },
      'element-plus': { ElMessage: feedback },
      'vue-router': { RouterLink: { render: () => null } },
      '@/components/common/feedback/SoftLoading.vue': { default: { props: ['label'], setup: props => () => h('span', { role: 'status' }, props.label) } },
      '@/components/common/feedback/useLoadingSurface': await import('../src/components/common/feedback/useLoadingSurface'),
      '@/composables/useDesktopWallpaper': await import('../src/composables/useDesktopWallpaper'),
      '@/services/desktopWallpaperService': await import('../src/services/desktopWallpaperService'),
    }
    const { descriptor } = parse(await readFile(new URL(componentPath, import.meta.url), 'utf8'))
    const compiled = compileScript(descriptor, { id: componentPath, inlineTemplate: true }).content
      .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (_, names, dependency) => `const {${names.replace(/\bas\b/g, ':')}} = dependencies[${JSON.stringify(dependency)}]`)
      .replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (_, name, dependency) => `const ${name} = dependencies[${JSON.stringify(dependency)}].default`)
      .replace('export default', 'return')
    const component = new Function('dependencies', compiled)(dependencies)
    const elements = []
    const renderer = createRenderer({
      createElement(type) { const el = { type, props: {}, children: [], options: [], tagName: type.toUpperCase(), focus: vi.fn(), addEventListener() {}, removeEventListener() {} }; elements.push(el); return el },
      createText: text => ({ text }), createComment: () => ({}),
      insert(el, parent, anchor) {
        const previous = el.parent?.children
        const previousIndex = previous?.indexOf(el)
        if (previousIndex >= 0) previous.splice(previousIndex, 1)
        parent.children ||= []
        const index = anchor ? parent.children.indexOf(anchor) : -1
        if (index < 0) parent.children.push(el)
        else parent.children.splice(index, 0, el)
        el.parent = parent
      },
      remove(el) { const index = el?.parent?.children?.indexOf(el); if (index >= 0) el.parent.children.splice(index, 1); if (el) el.removed = true },
      setText(el, text) { el.text = text }, setElementText(el, text) { el.text = text },
      patchProp(el, name, oldValue, value) { el.props[name] = value },
      parentNode: el => el.parent,
      nextSibling: el => el.parent?.children?.[el.parent.children.indexOf(el) + 1] || null,
    })
    const app = renderer.createApp({ render: () => h(component, props.value || props) })
    app.config.warnHandler = message => {
      if (!message.includes('Non-function value encountered for default slot'))
        throw new Error(message)
    }
    app.component('RouterLink', { render() { return null } })
    app.mount({})
    const settle = async () => { for (let i = 0; i < 12; i++) await nextTick() }
    await settle()
    return { elements, app, settle, feedback }
  }
  it('普通浏览器仅显示客户端下载入口，没有设置按钮', async () => {
    window.__TAURI__ = undefined
    const { elements, app } = await render('../src/components/wallpaper/desktop/WallpaperDesktopActions.vue', { wallpaper: picture() })
    expect(elements.some(el => el.type === 'button')).toBe(false)
    expect(elements.some(el => el.type === 'a' && el.text === '下载客户端')).toBe(true)
    expect(invoke).not.toHaveBeenCalled()
    app.unmount()
  })
  it('设置时显示居中进度、阻止重复请求，完成只提示一次并移除持久状态文字', async () => {
    let finish
    invoke.mockImplementation(command => command === 'wallpaper_capabilities' ? Promise.resolve(capabilities) : command === 'wallpaper_apply' ? new Promise(resolve => { finish = resolve }) : Promise.resolve(status()))
    const { elements, app, settle, feedback } = await render('../src/components/wallpaper/desktop/WallpaperDesktopActions.vue', { wallpaper: picture() })
    const apply = elements.find(el => el.type === 'button' && (el.text === '设为桌面壁纸' || el.props.class?.includes('desktop-wallpaper-actions__apply')))
    const pending = apply.props.onClick()
    await settle()
    expect(elements.some(el => el.props.class?.includes('desktop-wallpaper-progress') && !el.removed)).toBe(true)
    expect(apply.props.disabled).toBe(true)
    await apply.props.onClick()
    expect(invoke.mock.calls.filter(([command]) => command === 'wallpaper_apply')).toHaveLength(1)
    finish({ ...status(), current: buildDesktopWallpaperItem(picture()).item })
    await pending
    await settle()
    await vi.advanceTimersByTimeAsync(500)
    await settle()
    expect(feedback.success).toHaveBeenCalledTimes(1)
    expect(elements.some(el => el.type === 'p' && /当前应用|已设置/.test(el.text || '') && !el.removed)).toBe(false)
    expect(elements.some(el => /收藏轮换/.test(el.text || '') && !el.removed)).toBe(false)
    expect(elements.some(el => el.props.role === 'dialog' && !el.removed)).toBe(false)
    app.unmount()
  })

  it('原生失败结束进度并反馈，关闭后的迟到成功不污染下一次打开', async () => {
    const props = ref({ wallpaper: picture(), visible: true })
    const { elements, app, settle, feedback } = await render('../src/components/wallpaper/desktop/WallpaperDesktopActions.vue', props)
    const apply = elements.find(el => el.type === 'button' && (el.text === '设为桌面壁纸' || el.props.class?.includes('desktop-wallpaper-actions__apply')))
    invoke.mockRejectedValueOnce('native failed')
    await apply.props.onClick()
    expect(feedback.success).not.toHaveBeenCalled()
    expect(feedback.error).toHaveBeenCalledTimes(1)
    let finish
    invoke.mockImplementation(command => command === 'wallpaper_apply' ? new Promise(resolve => { finish = resolve }) : Promise.resolve(status()))
    const pending = apply.props.onClick()
    await settle()
    props.value = { ...props.value, visible: false }
    await settle()
    props.value = { wallpaper: picture('b.jpg'), visible: true }
    await settle()
    finish({ ...status(), current: buildDesktopWallpaperItem(picture()).item })
    await pending
    await settle()
    expect(feedback.success).not.toHaveBeenCalled()
    app.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('轮换面板明确启用，删除收藏不改已保存配置且空列表仍可停止', async () => {
    const props = ref({ wallpapers: [picture(), picture('b.png'), picture('c.webp')], totalCount: 3 })
    const { elements, app, settle } = await render('../src/components/wallpaper/desktop/WallpaperRotationPanel.vue', props)
    expect(invoke.mock.calls.every(([command]) => command === 'wallpaper_capabilities')).toBe(true)
    elements.find(el => el.type === 'details').props.onToggle({ target: { open: true } })
    await settle()
    const enable = elements.find(el => el.type === 'button' && el.text === '开启轮换')
    expect(enable.props.disabled).toBe(false)
    expect(elements.filter(el => el.type === 'input')).toHaveLength(2)
    await enable.props.onClick()
    await settle()
    const configureCalls = () => invoke.mock.calls.filter(([command]) => command === 'wallpaper_configure_rotation')
    expect(configureCalls()).toHaveLength(1)
    expect(configureCalls()[0][1].config.items).toHaveLength(2)
    props.value = { wallpapers: [], totalCount: 0 }
    await settle()
    expect(configureCalls()).toHaveLength(1)
    const stop = elements.find(el => el.type === 'button' && el.text?.trim() === '停止轮换')
    expect(stop.props.disabled).toBe(false)
    await stop.props.onClick()
    expect(configureCalls().at(-1)[1].config).toMatchObject({ enabled: false, items: [] })
    app.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
