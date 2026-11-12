import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { useSearchSuggestions } from '../src/components/search/composables/useSearchSuggestions.js'
import { useFilterStore } from '../src/stores/filter.js'

const apps = []
const all = node => [node, ...(node.children || []).flatMap(all)]
const textOf = node => `${node.text || ''}${(node.children || []).map(textOf).join('')}`
const settle = async () => { for (let i = 0; i < 5; i++) await Vue.nextTick() }
const passThrough = { setup: (_, { slots }) => () => Vue.h('div', slots.default?.()) }
const runtime = { ...Vue, Teleport: 'div', Transition: passThrough }
const dependencies = {
  gsap: { fromTo: vi.fn(), to: vi.fn(), set: vi.fn(), killTweensOf: vi.fn() },
  trackSearch: vi.fn(), useSearchSuggestions, useMotionPreference: () => Vue.ref(true),
  SearchSuggestionsPanel: { props: ['visible', 'suggestions', 'query', 'listId'], setup: props => () => Vue.h('div', { role: 'listbox', id: props.listId }, props.visible ? props.query : '') },
  useScrollLock: () => ({ lock() {}, unlock() {} }),
  useDialogFocus: () => {},
  FilterPreviewAction: { props: ['preview'], setup: (_, { emit }) => () => Vue.h('button', { onClick: () => emit('confirm') }, '应用筛选') },
}
function compile(path) {
  const { descriptor } = parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  const { content } = compileScript(descriptor, { id: path, inlineTemplate: true })
  const source = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]vue['"]/g, (_, names) => `const {${names.replace(/\bas\b/g, ':')}} = Vue`)
    .replace(/^import[^\n]+$/gm, '').replace('export default', 'return')
  return new Function('Vue', ...Object.keys(dependencies), source)(runtime, ...Object.values(dependencies))
}
function mount(component, props = {}) {
  const make = (tag, text = '') => ({ tag, text, props: {}, children: [], parent: null, focus: vi.fn(), contains: () => false, getBoundingClientRect: () => ({ bottom: 40, left: 0, width: 200 }) })
  function insert(node, parent, anchor) {
    if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1)
    node.parent = parent
    const i = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(i < 0 ? parent.children.length : i, 0, node)
  }
  const renderer = Vue.createRenderer({
    createElement: tag => make(tag), createText: text => make('#text', text), createComment: () => make('#comment'), insert,
    remove(node) { if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1) },
    setText(node, text) { node.text = text }, setElementText(node, text) { node.text = text; node.children = [] },
    patchProp(node, key, _, value) { node.props[key] = value }, parentNode: node => node.parent,
    nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] || null,
    insertStaticContent(content, parent, anchor) { const node = make('#static', content); insert(node, parent, anchor); return [node, node] },
  })
  const root = make('root')
  const app = renderer.createApp(component, props)
  app.mount(root)
  apps.push(app)
  return root
}
beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} })
  vi.stubGlobal('document', Object.assign(new EventTarget(), { activeElement: null }))
  vi.stubGlobal('window', Object.assign(new EventTarget(), { innerWidth: 1200, innerHeight: 800 }))
  vi.stubGlobal('requestAnimationFrame', callback => { callback(); return 1 })
})
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.unstubAllGlobals() })

it('草稿过滤共用真实匹配规则，不改变已应用筛选', () => {
  const store = useFilterStore()
  store.currentSeriesId = 'desktop'
  store.formatFilter = 'jpg'
  const items = [{ filename: '风景.jpg', format: 'jpg', category: '风景' }, { filename: '动物.png', format: 'png', category: '动物' }]
  expect(store.applyFilters(items, { filters: { formatFilter: 'png', categoryFilter: '动物' } }).map(item => item.filename)).toEqual(['动物.png'])
  expect(store.formatFilter).toBe('jpg')
})

it('点击清除立即提交空搜索，不等待图标动画', async () => {
  const update = vi.fn()
  const search = vi.fn()
  const root = mount(compile('../src/components/search/index.vue'), { modelValue: '山', 'onUpdate:modelValue': update, onSearch: search })
  all(root).find(node => node.props['aria-label'] === '清除搜索').props.onClick()
  expect(update).toHaveBeenCalledWith('')
  expect(search).not.toHaveBeenCalled()
  await settle()
  expect(all(root).find(node => node.tag === 'input').props.value).toBe('')
})

it('清空已应用搜索立即恢复结果，不等待防抖计时', async () => {
  const store = useFilterStore()
  store.searchQuery = '山'
  store.debouncedQuery = '山'
  await settle()
  store.searchQuery = ''
  await settle()
  expect(store.debouncedQuery).toBe('')
})

it('输入法确认候选不会触发搜索，普通 Enter 才提交', () => {
  const search = vi.fn()
  const root = mount(compile('../src/components/search/index.vue'), { modelValue: '山', onSearch: search })
  const input = all(root).find(node => node.tag === 'input')
  input.props.onKeydown({ key: 'Enter', isComposing: true, preventDefault() {} })
  expect(search).not.toHaveBeenCalled()
  input.props.onKeydown({ key: 'Enter', isComposing: false, preventDefault() {} })
  expect(search).toHaveBeenCalledOnce()
})

it('没有建议时仍保留搜索出口，输入有 combobox 关联语义', async () => {
  const root = mount(compile('../src/components/search/index.vue'))
  const input = all(root).find(node => node.tag === 'input')
  input.props.onFocus()
  input.props.onInput({ target: { value: '无匹配' } })
  await settle()
  expect(input.props.role).toBe('combobox')
  expect(input.props['aria-expanded']).toBe(true)
  expect(all(root).find(node => node.props.role === 'listbox').props.id).toBe(input.props['aria-controls'])
})

it('分类抽屉打开保持全部，重置只改草稿，确认才提交', async () => {
  const props = Vue.reactive({ show: false, categoryFilter: 'all', categoryOptions: [{ value: 'all', label: '全部分类' }, { value: '风景', label: '风景' }] })
  const update = vi.fn()
  const Drawer = compile('../src/components/common/navigation/MobileCategoryDrawer.vue')
  const root = mount({ setup: () => () => Vue.h(Drawer, { ...props, 'onUpdate:categoryFilter': update }) })
  props.show = true
  await settle()
  const allButton = all(root).find(node => node.tag === 'button' && textOf(node).trim() === '全部分类')
  expect(allButton).toBeTruthy()
  expect(allButton.props['aria-pressed']).toBe(true)
  all(root).find(node => node.tag === 'button' && textOf(node).trim() === '重置').props.onClick()
  expect(update).not.toHaveBeenCalled()
  all(root).find(node => node.tag === 'button' && textOf(node).trim() === '应用筛选').props.onClick()
  expect(update).toHaveBeenCalledWith('all')
})

it('取消分类草稿后再次打开仍显示已应用条件', async () => {
  const props = Vue.reactive({ show: false, categoryFilter: 'all', categoryOptions: [{ value: 'all', label: '全部分类' }, { value: '风景', label: '风景' }] })
  const update = vi.fn()
  const Drawer = compile('../src/components/common/navigation/MobileCategoryDrawer.vue')
  const root = mount({ setup: () => () => Vue.h(Drawer, { ...props, 'onUpdate:show': value => { props.show = value }, 'onUpdate:categoryFilter': update }) })
  props.show = true
  await settle()
  all(root).find(node => node.tag === 'button' && textOf(node).trim() === '风景').props.onClick()
  all(root).find(node => node.props['aria-label'] === '取消分类筛选').props.onClick()
  expect(update).not.toHaveBeenCalled()
  props.show = true
  await settle()
  expect(all(root).find(node => node.tag === 'button' && textOf(node).trim() === '全部分类').props['aria-pressed']).toBe(true)
})

it('目录未完整或失败时不展示虚假数量，完整零结果仍可应用', async () => {
  const preview = Vue.reactive({ status: 'loading', count: 0 })
  const confirm = vi.fn()
  const Preview = compile('../src/components/wallpaper/filter/shared/FilterPreviewAction.vue')
  const root = mount({ setup: () => () => Vue.h(Preview, { preview, onConfirm: confirm }) })
  expect(textOf(root)).toContain('壁纸目录加载中，结果数量待确认')
  expect(textOf(root)).not.toContain('查看 0 张')
  preview.status = 'error'
  await settle()
  expect(textOf(root)).toContain('结果数量暂不可用')
  preview.status = 'ready'
  await settle()
  const apply = all(root).find(node => node.tag === 'button')
  expect(textOf(apply)).toContain('查看 0 张壁纸')
  apply.props.onClick()
  expect(confirm).toHaveBeenCalledOnce()
})
