import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

const { descriptor } = parse(readFileSync(new URL('../src/components/wallpaper/card/shared/WallpaperCardActions.vue', import.meta.url), 'utf8'))
const { content } = compileScript(descriptor, { id: 'action-feedback', inlineTemplate: true })
const source = content
  .replaceAll('import.meta.env.BASE_URL', JSON.stringify('/'))
  .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (_, names, dependency) => `const {${names.replace(/\bas\b/g, ':')}} = dependencies[${JSON.stringify(dependency)}]`)
  .replace('export default', 'return')
const reducedMotion = Vue.ref(false)
const component = new Function('dependencies', source)({
  'vue': { ...Vue, defineAsyncComponent: () => ({ render: () => null }) },
  '@/utils/common/format': { formatNumber: value => String(value) },
  '@/composables/useMotionPreference': { useMotionPreference: () => reducedMotion },
})
const apps = []
afterEach(() => apps.splice(0).forEach(app => app.unmount()))

function mountActions(overrides = {}) {
  const elements = []
  const props = Vue.reactive({ isAuthenticated: true, likeCount: 3, collectCount: 2, ...overrides })
  const renderer = Vue.createRenderer({
    createElement(tag) {
      const element = Vue.markRaw({ tag, props: {}, children: [], parent: null })
      elements.push(element)
      return element
    },
    createText: text => ({ text }), createComment: text => ({ text }), insertStaticContent: () => [{}, {}],
    insert(element, parent) { element.parent = parent; parent.children?.push(element) },
    remove(element) { element.removed = true },
    setText: (element, text) => { element.text = text },
    setElementText: (element, text) => { element.text = text },
    patchProp: (element, key, _previous, value) => { element.props[key] = value },
    parentNode: element => element.parent, nextSibling: () => null,
  })
  const like = vi.fn(), collect = vi.fn()
  const app = renderer.createApp({ render: () => Vue.h(component, { ...props, onToggleLike: like, onToggleCollect: collect }) })
  app.mount({ children: [] })
  apps.push(app)
  const find = label => elements.find(element => !element.removed && element.props['aria-label'] === label)
  return { props, elements, find, like, collect }
}

it('动画不锁定业务操作，图标与计数持续可见', async () => {
  const state = mountActions()
  const button = state.find('喜欢壁纸')
  button.props.onClick({ stopPropagation() {} })
  await Vue.nextTick()
  button.props.onClick({ stopPropagation() {} })
  expect(state.like).toHaveBeenCalledTimes(2)
  expect(state.elements.find(element => !element.removed && element.text === '3')).toBeTruthy()
  expect(state.elements.some(element => !element.removed && element.props.class?.includes('is-hidden'))).toBe(false)
})

it('真实pending只禁用对应操作，结束后立即可再次操作', async () => {
  const state = mountActions({ likePending: true })
  expect(state.find('喜欢壁纸').props.disabled).toBe(true)
  expect(state.find('喜欢壁纸').props['aria-busy']).toBe(true)
  state.find('喜欢壁纸').props.onClick({ stopPropagation() {} })
  state.find('收藏壁纸').props.onClick({ stopPropagation() {} })
  expect(state.like).not.toHaveBeenCalled()
  expect(state.collect).toHaveBeenCalledOnce()
  state.props.likePending = false
  await Vue.nextTick()
  state.find('喜欢壁纸').props.onClick({ stopPropagation() {} })
  expect(state.like).toHaveBeenCalledOnce()
})

it('错误就近展示，重试仍指向失败的操作', () => {
  const state = mountActions({ collectError: '网络连接异常，请检查网络后重试' })
  expect(state.elements.some(element => element.text === state.props.collectError)).toBe(true)
  state.find('重试收藏').props.onClick({ stopPropagation() {} })
  expect(state.collect).toHaveBeenCalledOnce()
  expect(state.like).not.toHaveBeenCalled()
})
