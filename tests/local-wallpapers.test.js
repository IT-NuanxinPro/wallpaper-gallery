import { readFile } from 'node:fs/promises'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalWallpaperState, deleteProtectionReason } from '../src/composables/useLocalWallpapers'
import { createLocalWallpaperService, thumbnailBlob } from '../src/services/localWallpaperService'

const id = n => `${String(n).padStart(64, '0')}.png`
const entry = (n = 1, extra = {}) => ({ cacheId: id(n), title: `图片 ${n}`, titleKnown: true, bytes: 1200, modifiedAt: 1700000000000, lastAppliedAt: null, isCurrent: false, isPrevious: false, inRotation: false, possiblyActive: false, canApply: true, deleteBlockedReason: null, ...extra })
const snapshot = (entries = [entry()], extra = {}) => ({ storagePath: '/test/cache/wallpapers', totalCount: entries.length, totalBytes: entries.reduce((total, item) => total + item.bytes, 0), readOnly: false, warning: null, status: { supported: true, enabled: false, intervalMinutes: 60, current: null, previous: null, lastError: null, cacheCount: entries.length }, entries, ...extra })
const capabilities = { version: 1, supported: true, cacheManagementVersion: 1, storageManagementVersion: 1, platform: 'macos' }
const png = () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
function fixture(options = {}) {
  const invoke = vi.fn(async (command) => {
    if (command === 'wallpaper_capabilities') return capabilities
    if (command === 'wallpaper_cache_thumbnail') return png()
    return snapshot()
  })
  const createObjectURL = vi.fn(() => `blob:test-${createObjectURL.mock.calls.length}`)
  const revokeObjectURL = vi.fn()
  const service = createLocalWallpaperService({ invoke, isNative: () => true })
  return { invoke, createObjectURL, revokeObjectURL, state: createLocalWallpaperState(service, { createObjectURL, revokeObjectURL, ...options }) }
}

describe('本地壁纸 IPC 边界', () => {
  it('浏览器无 IPC，旧能力或缺少命令明确降级，重试可恢复', async () => {
    const invoke = vi.fn()
    const state = createLocalWallpaperState(createLocalWallpaperService({ invoke, isNative: () => false }))
    await state.initialize()
    expect(state.phase.value).toBe('browser')
    expect(invoke).not.toHaveBeenCalled()
    const f = fixture()
    f.invoke.mockResolvedValueOnce({ version: 1, supported: true })
    await f.state.initialize()
    expect(f.state.phase.value).toBe('upgrade')
    expect(f.invoke).toHaveBeenCalledTimes(1)
    await f.state.initialize(true)
    expect(f.state.phase.value).toBe('ready')
    f.invoke.mockRejectedValueOnce('Command wallpaper_cache_list not found')
    await f.state.refresh()
    expect(f.state.phase.value).toBe('upgrade')
    expect(f.state.error.value).not.toContain('wallpaper_cache')
    f.state.dispose()
  })
  it('只传完整缓存标识，拒绝任意路径；缩略图只接受有界 PNG 二进制', async () => {
    const f = fixture()
    const service = createLocalWallpaperService({ invoke: f.invoke, isNative: () => true })
    await service.reveal(null)
    expect(f.invoke).toHaveBeenLastCalledWith('wallpaper_cache_reveal', { cacheId: null })
    await service.apply(id(1))
    expect(f.invoke).toHaveBeenLastCalledWith('wallpaper_cache_apply', { cacheId: id(1) })
    await expect(service.apply('../private.png')).rejects.toThrow()
    for (const value of [png(), png().buffer, [...png()], new DataView(png().buffer)])
      expect(thumbnailBlob(value).type).toBe('image/png')
    for (const value of ['data:image/png;base64,secret', [137, -1], new Uint8Array(262145), new Uint8Array([1, 2, 3])])
      expect(() => thumbnailBlob(value)).toThrow()
  })
  it('无效 DTO 不可作为可操作快照，错误不泄露原生细节', async () => {
    const f = fixture()
    f.invoke.mockImplementation(async command => command === 'wallpaper_capabilities' ? capabilities : { ...snapshot(), entries: [entry(1, { cacheId: '/Users/private/token.png' })] })
    await f.state.initialize()
    expect(f.state.library.value).toBeNull()
    expect(f.state.error.value).not.toContain('/Users')
    f.state.dispose()
  })
})

describe('本地壁纸状态与保护', () => {
  it('删除和清理确认取消不调用 IPC；受保护图片不可删', async () => {
    const f = fixture()
    await f.state.initialize()
    f.invoke.mockClear()
    expect(await f.state.remove(id(1), () => Promise.reject('cancel'))).toBe(false)
    expect(await f.state.clearUnused(() => false)).toBe(false)
    expect(f.invoke).not.toHaveBeenCalled()
    f.invoke.mockResolvedValue(snapshot([entry(1, { isCurrent: true, deleteBlockedReason: 'protected' })]))
    await f.state.refresh()
    f.invoke.mockClear()
    expect(await f.state.remove(id(1), () => true)).toBe(false)
    expect(deleteProtectionReason(f.state.library.value.entries[0], false)).toContain('最近应用')
    expect(f.invoke).not.toHaveBeenCalled()
    f.state.dispose()
  })
  it('只读保留预览与定位，并阻止所有变更；确认后再次核验状态', async () => {
    const f = fixture()
    await f.state.initialize()
    let confirm
    const pending = f.state.remove(id(1), () => new Promise(resolve => { confirm = resolve }))
    f.invoke.mockResolvedValueOnce(snapshot([entry()], { readOnly: true }))
    await f.state.refresh()
    f.invoke.mockClear()
    confirm(true)
    expect(await pending).toBe(false)
    expect(await f.state.apply(id(1))).toBe(false)
    expect(await f.state.stopRotation()).toBe(false)
    expect(await f.state.changeLocation()).toBe(false)
    expect(await f.state.clearUnused(() => true)).toBe(false)
    expect(f.invoke).not.toHaveBeenCalled()
    expect(await f.state.reveal(id(1))).toBe(true)
    expect(f.invoke).toHaveBeenLastCalledWith('wallpaper_cache_reveal', { cacheId: id(1) })
    f.state.dispose()
  })
  it('应用完成前不改标记，防止重复；停止轮换再刷新列表', async () => {
    const f = fixture()
    await f.state.initialize()
    let complete
    f.invoke.mockImplementation(command => command === 'wallpaper_cache_apply' ? new Promise(resolve => { complete = resolve }) : Promise.resolve(snapshot()))
    const pending = f.state.apply(id(1))
    expect(f.state.library.value.entries[0].isCurrent).toBe(false)
    expect(await f.state.apply(id(1))).toBe(false)
    complete(snapshot([entry(1, { isCurrent: true })]))
    expect(await pending).toBe(true)
    expect(f.state.library.value.entries[0].isCurrent).toBe(true)
    f.invoke.mockResolvedValueOnce(snapshot([entry()], { status: { ...snapshot().status, enabled: true, intervalMinutes: 30 } }))
    await f.state.refresh()
    f.invoke.mockClear()
    expect(await f.state.stopRotation()).toBe(true)
    expect(f.invoke).toHaveBeenNthCalledWith(1, 'wallpaper_configure_rotation', { config: { enabled: false, intervalMinutes: 30, items: [] } })
    expect(f.invoke.mock.calls[1][0]).toBe('wallpaper_cache_list')
    f.state.dispose()
  })
  it('原生失败不算成功，离页后的结果不更新列表', async () => {
    const f = fixture()
    await f.state.initialize()
    f.invoke.mockRejectedValueOnce('private stack /Users/token')
    expect(await f.state.apply(id(1))).toBe(false)
    expect(f.state.error.value).not.toContain('/Users')
    let complete
    f.invoke.mockImplementation(() => new Promise(resolve => { complete = resolve }))
    const pending = f.state.apply(id(1))
    f.state.dispose()
    complete(snapshot([entry(1, { isCurrent: true })]))
    expect(await pending).toBe(false)
    expect(f.state.library.value.entries[0].isCurrent).toBe(false)
  })
  it('确认后删除及清理使用原生新快照和实际释放统计', async () => {
    const f = fixture()
    await f.state.initialize()
    f.invoke.mockImplementation(async command => command === 'wallpaper_cache_delete' ? snapshot([]) : command === 'wallpaper_cache_thumbnail' ? png() : snapshot())
    expect(await f.state.remove(id(1), () => true)).toBe(true)
    expect(f.state.library.value.totalCount).toBe(0)
    await f.state.refresh()
    f.invoke.mockResolvedValueOnce({ removedCount: 1, freedBytes: 1200, library: snapshot([]) })
    const result = await f.state.clearUnused(() => true)
    expect(result).toMatchObject({ removedCount: 1, freedBytes: 1200 })
    expect(f.state.library.value.entries).toEqual([])
    expect(f.invoke).toHaveBeenLastCalledWith('wallpaper_cache_clear_unused')
    f.state.dispose()
  })
})

describe('缩略图生命周期', () => {
  it('最多两路并发，刷新撤销 URL，迟到旧图不污染新列表，卸载释放', async () => {
    const f = fixture()
    const requests = []
    let active = 0
    let maximum = 0
    let current = snapshot([entry(1), entry(2), entry(3), entry(4)])
    f.invoke.mockImplementation(async (command, payload) => {
      if (command === 'wallpaper_capabilities') return capabilities
      if (command === 'wallpaper_cache_list') return current
      if (command === 'wallpaper_cache_thumbnail') {
        maximum = Math.max(maximum, ++active)
        return new Promise(resolve => requests.push({ cacheId: payload.cacheId, finish: () => { active--; resolve(png()) } }))
      }
    })
    await f.state.initialize()
    expect(requests).toHaveLength(2)
    requests[0].finish()
    await settle()
    expect(requests).toHaveLength(3)
    expect(f.createObjectURL).toHaveBeenCalledTimes(1)
    current = snapshot([entry(4)])
    await f.state.refresh()
    expect(f.revokeObjectURL).toHaveBeenCalledWith('blob:test-1')
    requests[1].finish()
    await settle()
    expect(requests).toHaveLength(4)
    requests[2].finish()
    requests[3].finish()
    await settle()
    expect(maximum).toBe(2)
    expect(Object.keys(f.state.thumbnails.value)).toEqual([id(4)])
    expect(f.createObjectURL).toHaveBeenCalledTimes(2)
    f.state.dispose()
    expect(f.revokeObjectURL).toHaveBeenCalledWith('blob:test-2')
  })
  it('缩略图错误可单张重试，离页不创建 URL', async () => {
    const f = fixture()
    f.invoke.mockImplementation(async command => command === 'wallpaper_capabilities' ? capabilities : command === 'wallpaper_cache_thumbnail' ? new Uint8Array([1, 2]) : snapshot())
    await f.state.initialize()
    await settle()
    expect(f.state.thumbnails.value[id(1)].error).toBe(true)
    let complete
    f.invoke.mockImplementation(() => new Promise(resolve => { complete = resolve }))
    f.state.retryThumbnail(id(1))
    f.state.dispose()
    complete(png())
    await settle()
    expect(f.createObjectURL).not.toHaveBeenCalled()
  })
})

describe('持久图片保存位置', () => {
  it('旧客户端保持管理可用，更改位置没有能力时不调用 IPC', async () => {
    const f = fixture()
    f.invoke.mockResolvedValueOnce({ ...capabilities, storageManagementVersion: undefined })
    await f.state.initialize()
    f.invoke.mockClear()
    expect(f.state.phase.value).toBe('ready')
    expect(f.state.canChangeLocation.value).toBe(false)
    expect(await f.state.changeLocation()).toBe(false)
    expect(f.invoke).not.toHaveBeenCalled()
    f.state.dispose()
  })
  it('系统选择取消不改变快照、路径或缩略图，也不传网页路径', async () => {
    const f = fixture()
    await f.state.initialize()
    await settle()
    const before = f.state.library.value
    const url = f.state.thumbnails.value[id(1)].url
    f.invoke.mockResolvedValueOnce({ cancelled: true, library: snapshot([], { storagePath: '/unused/path' }) })
    expect(await f.state.changeLocation()).toMatchObject({ cancelled: true })
    expect(f.state.library.value).toBe(before)
    expect(f.state.thumbnails.value[id(1)].url).toBe(url)
    expect(f.revokeObjectURL).not.toHaveBeenCalled()
    expect(f.state.error.value).toBe('')
    expect(f.invoke).toHaveBeenLastCalledWith('wallpaper_storage_choose')
    f.state.dispose()
  })
  it('选择和复制期间锁住变更，成功后使用原生实际路径并释放旧图', async () => {
    const f = fixture()
    await f.state.initialize()
    await settle()
    let complete
    f.invoke.mockImplementation(command => command === 'wallpaper_storage_choose' ? new Promise(resolve => { complete = resolve }) : Promise.resolve(png()))
    const pending = f.state.changeLocation()
    expect(f.state.busy.value).toBe(true)
    expect(f.state.operation.value.kind).toBe('storage')
    expect(await f.state.changeLocation()).toBe(false)
    expect(await f.state.apply(id(1))).toBe(false)
    const storagePath = 'D:\\OneDrive\\图片\\Wallpaper Gallery'
    complete({ cancelled: false, library: snapshot([entry()], { storagePath }) })
    expect(await pending).toMatchObject({ cancelled: false })
    expect(f.state.library.value.storagePath).toBe(storagePath)
    expect(f.revokeObjectURL).toHaveBeenCalledWith('blob:test-1')
    expect(f.state.busy.value).toBe(false)
    f.state.dispose()
  })
  it('选择失败与不合法响应保留旧路径，可重试且不泄露原生错误', async () => {
    const f = fixture()
    await f.state.initialize()
    const before = f.state.library.value
    for (const failure of [new Error('copy failure D:\\private\\token'), new Error('Permission denied D:\\private'), { cancelled: 'no', library: snapshot([]) }]) {
      if (failure instanceof Error) f.invoke.mockRejectedValueOnce(failure)
      else f.invoke.mockResolvedValueOnce(failure)
      expect(await f.state.changeLocation()).toBe(false)
      expect(f.state.library.value).toBe(before)
      expect(f.state.error.value).not.toMatch(/private|token|copy failure/)
      expect(f.state.phase.value).toBe('ready')
      expect(f.state.canChangeLocation.value).toBe(true)
      expect(f.state.busy.value).toBe(false)
    }
    f.invoke.mockResolvedValueOnce({ cancelled: true, library: snapshot() })
    expect(await f.state.changeLocation()).toMatchObject({ cancelled: true })
    expect(f.state.error.value).toBe('')
    f.state.dispose()
  })
  it('缺少选择命令只降级更改位置，保留现有本地图库；只读和离页拒绝变更', async () => {
    const f = fixture()
    await f.state.initialize()
    f.invoke.mockRejectedValueOnce('Command wallpaper_storage_choose not found')
    expect(await f.state.changeLocation()).toBe(false)
    expect(f.state.phase.value).toBe('ready')
    expect(f.state.canChangeLocation.value).toBe(false)
    expect(f.state.error.value).toContain('升级')
    f.invoke.mockResolvedValueOnce(snapshot([entry()], { readOnly: true }))
    await f.state.refresh()
    f.invoke.mockClear()
    expect(await f.state.changeLocation()).toBe(false)
    expect(f.invoke).not.toHaveBeenCalled()
    f.state.dispose()
    const late = fixture()
    await late.state.initialize()
    let complete
    late.invoke.mockImplementation(() => new Promise(resolve => { complete = resolve }))
    const pending = late.state.changeLocation()
    late.state.dispose()
    complete({ cancelled: false, library: snapshot([], { storagePath: '/late/path' }) })
    expect(await pending).toBe(false)
    expect(late.state.library.value.storagePath).not.toBe('/late/path')
  })
})

describe('本地壁纸实际控件', () => {
  async function renderPage(state) {
    vi.useFakeTimers()
    vi.stubGlobal('document', { activeElement: null })
    const feedback = { success: vi.fn(), error: vi.fn() }
    const messageBox = { confirm: vi.fn().mockRejectedValue('cancel') }
    const passThrough = { inheritAttrs: false, setup: (_props, { slots }) => () => slots.default?.() }
    const button = { inheritAttrs: false, setup: (_props, { attrs, slots }) => () => Vue.h('button', { ...attrs, type: 'button' }, slots.default?.()) }
    const dependencies = {
      vue: { ...Vue, Teleport: passThrough, Transition: Vue.BaseTransition },
      'element-plus': { ElButton: button, ElTag: { setup: (_props, { slots }) => () => Vue.h('span', slots.default?.()) }, ElMessage: feedback, ElMessageBox: messageBox },
      '@/components/common/feedback/SoftLoading.vue': { default: { props: ['label'], setup: props => () => Vue.h('span', { role: 'status' }, props.label) } },
      '@/components/common/feedback/useLoadingSurface': await import('../src/components/common/feedback/useLoadingSurface'),
      '@/composables/useLocalWallpapers': { ...await import('../src/composables/useLocalWallpapers'), useLocalWallpapers: () => { Vue.onBeforeUnmount(state.dispose); return state } },
      '@/services/desktopWallpaperService': await import('../src/services/desktopWallpaperService'),
    }
    async function compile(path) {
      const { descriptor } = parse(await readFile(new URL(path, import.meta.url), 'utf8'))
      const compiled = compileScript(descriptor, { id: path, inlineTemplate: true }).content
        .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (_, names, dependency) => `const {${names.replace(/\bas\b/g, ':')}} = dependencies[${JSON.stringify(dependency)}]`)
        .replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (_, name, dependency) => `const ${name} = dependencies[${JSON.stringify(dependency)}].default`)
        .replace('export default', 'return')
      return new Function('dependencies', compiled)(dependencies)
    }
    dependencies['@/components/wallpaper/local/LocalWallpaperCard.vue'] = { default: await compile('../src/components/wallpaper/local/LocalWallpaperCard.vue') }
    const component = await compile('../src/views/LocalWallpapers.vue')
    const elements = []
    const renderer = Vue.createRenderer({
      createElement(type) { const el = { type, props: {}, children: [], focus: vi.fn() }; elements.push(el); return el },
      createText: text => ({ text }), createComment: () => ({}),
      insert(el, parent, anchor) {
        if (el.parent) {
          const oldIndex = el.parent.children.indexOf(el)
          if (oldIndex >= 0) el.parent.children.splice(oldIndex, 1)
        }
        parent.children ||= []
        const index = anchor ? parent.children.indexOf(anchor) : -1
        if (index < 0) parent.children.push(el)
        else parent.children.splice(index, 0, el)
        el.parent = parent
        el.removed = false
      },
      remove(el) { const index = el?.parent?.children?.indexOf(el); if (index >= 0) el.parent.children.splice(index, 1); if (el) el.removed = true },
      setText(el, text) { el.text = text }, setElementText(el, text) { el.text = text; el.children = [] },
      patchProp(el, name, _old, value) { el.props[name] = value },
      parentNode: el => el.parent, nextSibling: el => el.parent?.children?.[el.parent.children.indexOf(el) + 1] || null,
    })
    const app = renderer.createApp(component)
    app.config.warnHandler = message => { if (!message.includes('Non-function value encountered for default slot')) throw new Error(message) }
    app.component('RouterLink', { inheritAttrs: false, setup: (_props, { slots }) => () => Vue.h('a', slots.default?.()) })
    app.mount({})
    const textOf = el => (el.text || '') + (el.children?.map(textOf).join('') || '')
    const tick = async () => { for (let i = 0; i < 15; i++) await Vue.nextTick() }
    await tick()
    return { elements, app, tick, textOf, feedback, messageBox, button: label => elements.find(el => el.type === 'button' && !el.removed && textOf(el).trim() === label) }
  }
  it('普通浏览器没有工作按钮；损坏记录只读但显示实际目录并可定位', async () => {
    const state = createLocalWallpaperState(createLocalWallpaperService({ isNative: () => false }))
    await state.initialize()
    const browser = await renderPage(state)
    expect(browser.elements.some(el => el.type === 'button')).toBe(false)
    expect(browser.elements.some(el => el.type === 'a' && browser.textOf(el).includes('下载桌面客户端'))).toBe(true)
    browser.app.unmount()
    const f = fixture()
    f.invoke.mockImplementation(async command => command === 'wallpaper_capabilities' ? capabilities : command === 'wallpaper_cache_thumbnail' ? png() : snapshot([entry()], { readOnly: true }))
    await f.state.initialize()
    const view = await renderPage(f.state)
    expect(view.elements.some(el => el.type === 'code' && view.textOf(el) === '/test/cache/wallpapers')).toBe(true)
    expect(view.button('在访达中打开').props.disabled).toBe(false)
    expect(view.button('设为壁纸').props.disabled).toBe(true)
    expect(view.button('删除').props.disabled).toBe(true)
    view.app.unmount()
  })
  it('保护卡明确禁删，取消清理没有 IPC，失败缩略图仍可应用和定位', async () => {
    const f = fixture()
    f.invoke.mockImplementation(async command => command === 'wallpaper_capabilities' ? capabilities : command === 'wallpaper_cache_thumbnail' ? [] : snapshot([entry(1, { isCurrent: true }), entry(2)]))
    await f.state.initialize()
    await settle()
    const view = await renderPage(f.state)
    const deletes = view.elements.filter(el => el.type === 'button' && view.textOf(el).trim() === '删除')
    expect(deletes.map(el => el.props.disabled)).toEqual([true, false])
    expect(view.elements.some(el => el.type === 'p' && view.textOf(el).includes('最近应用的壁纸受保护'))).toBe(false)
    expect(view.elements.some(el => el.props.tabindex === 0 && el.props.title?.includes('最近应用的壁纸受保护'))).toBe(true)
    expect(view.button('设为壁纸').props.disabled).toBe(false)
    expect(view.button('在访达中显示').props.disabled).toBe(false)
    expect(view.button('重新加载')).toBeDefined()
    f.invoke.mockClear()
    await view.button('清理未使用').props.onClick()
    expect(view.messageBox.confirm).toHaveBeenCalledTimes(1)
    expect(f.invoke).not.toHaveBeenCalled()
    view.app.unmount()
  })
  it('应用时中央加载并防重，完成一次成功提示；卸载后不提示成功', async () => {
    const f = fixture()
    await f.state.initialize()
    const view = await renderPage(f.state)
    let complete
    f.invoke.mockImplementation(command => command === 'wallpaper_cache_apply' ? new Promise(resolve => { complete = resolve }) : Promise.resolve(png()))
    const apply = view.button('设为壁纸')
    const pending = apply.props.onClick()
    await view.tick()
    expect(apply.props.disabled).toBe(true)
    expect(view.elements.some(el => el.props.role === 'dialog' && !el.removed)).toBe(true)
    await apply.props.onClick()
    expect(f.invoke.mock.calls.filter(([command]) => command === 'wallpaper_cache_apply')).toHaveLength(1)
    complete(snapshot([entry(1, { isCurrent: true })]))
    await pending
    await view.tick()
    await vi.advanceTimersByTimeAsync(300)
    await view.tick()
    expect(view.feedback.success).toHaveBeenCalledTimes(1)
    const again = view.button('设为壁纸').props.onClick()
    await view.tick()
    view.app.unmount()
    complete(snapshot([entry(1, { isCurrent: true })]))
    await again
    expect(view.feedback.success).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('按客户端平台显示文件管理器文案，旧存储能力仅提供升级提示', async () => {
    for (const [platform, open, show] of [['macos', '在访达中打开', '在访达中显示'], ['windows', '在文件资源管理器中打开', '在文件资源管理器中显示'], ['linux', '打开文件夹', '在文件夹中显示']]) {
      const f = fixture()
      f.invoke.mockResolvedValueOnce({ ...capabilities, platform, storageManagementVersion: undefined })
      await f.state.initialize()
      const view = await renderPage(f.state)
      expect(view.button(open)).toBeDefined()
      expect(view.button(show)).toBeDefined()
      expect(view.button('更改位置').props.disabled).toBe(true)
      expect(view.elements.some(el => el.props.tabindex === 0 && el.props.title?.includes('升级'))).toBe(true)
      expect(view.elements.some(el => /256 MB|自动清理/.test(view.textOf(el)))).toBe(false)
      view.app.unmount()
    }
  })
  it('更改位置使用中央加载，取消不弹成功，成功显示新目录', async () => {
    const f = fixture()
    await f.state.initialize()
    const view = await renderPage(f.state)
    let complete
    f.invoke.mockImplementation(command => command === 'wallpaper_storage_choose' ? new Promise(resolve => { complete = resolve }) : Promise.resolve(png()))
    const pending = view.button('更改位置').props.onClick()
    await view.tick()
    expect(view.button('更改位置').props.disabled).toBe(true)
    expect(view.elements.some(el => el.props.role === 'dialog' && el.props['aria-label']?.includes('保存位置') && !el.removed)).toBe(true)
    complete({ cancelled: true, library: snapshot() })
    await pending
    await vi.advanceTimersByTimeAsync(300)
    await view.tick()
    expect(view.feedback.success).not.toHaveBeenCalled()
    expect(view.feedback.error).not.toHaveBeenCalled()
    const again = view.button('更改位置').props.onClick()
    await view.tick()
    complete({ cancelled: false, library: snapshot([entry()], { storagePath: '/Pictures/Wallpaper Gallery' }) })
    await again
    await view.tick()
    expect(view.feedback.success).toHaveBeenCalledTimes(1)
    expect(view.elements.some(el => el.type === 'code' && view.textOf(el) === '/Pictures/Wallpaper Gallery')).toBe(true)
    view.app.unmount()
  })
})
