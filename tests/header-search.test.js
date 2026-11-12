import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia, storeToRefs } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { useFilterStore } from '../src/stores/filter.js'

let unmount
let filterStore
let series
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} })
  vi.stubGlobal('document', new EventTarget())
  vi.stubGlobal('window', new EventTarget())
  setActivePinia(createPinia())
  filterStore = useFilterStore()
  series = Vue.ref('desktop')
})
afterEach(() => { unmount?.(); vi.unstubAllGlobals() })

// 保留 Header 的真实 setup 与事件处理，隔离不相关导航和设备 UI。
function mountHeader() {
  const { descriptor } = parse(readFileSync(new URL('../src/components/layout/AppHeader.vue', import.meta.url), 'utf8'))
  descriptor.template.content = '<button @click="handleSearch({ mode: \'fuzzy\', query: \'山\' })">搜索</button>'
  descriptor.template.ast = undefined
  descriptor.template.ast = undefined
  const { content } = compileScript(descriptor, { id: 'header-search', inlineTemplate: true })
  const deps = {
    warmAccountViews: () => Promise.resolve(),
    storeToRefs, useFilterStore: () => filterStore,
    useRoute: () => Vue.reactive({ path: '/desktop', fullPath: '/desktop' }), useRouter: () => ({}),
    useVersionCheck: () => ({ isNativeClient: Vue.ref(false) }),
    useTheme: () => ({ theme: Vue.ref('light'), themeMode: Vue.ref('light'), themeOptions: [{ value: 'light', label: '浅色' }] }),
    useFullscreen: () => ({ isFullscreen: Vue.ref(false) }),
    useDevice: () => ({ isMobile: Vue.ref(false), isTablet: Vue.ref(false), windowWidth: Vue.ref(1200) }),
    useAuthStore: () => Vue.reactive({}), useWallpaperStore: () => Vue.reactive({ wallpapers: [] }),
    useWallpaperType: () => ({ availableSeriesOptions: Vue.ref([]), currentSeries: series }),
    useHeaderNavSlider: () => ({}), gsap: { killTweensOf() {} },
  }
  const source = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]vue['"]/g, (_, names) => `const {${names.replace(/\bas\b/g, ':')}} = Vue`).replace(/^import[^\n]+$/gm, '').replace('export default', 'return')
  const component = new Function('Vue', ...Object.keys(deps), source)(Vue, ...Object.values(deps))
  const root = { children: [] }
  const renderer = Vue.createRenderer({
    createElement: tag => ({ tag, props: {}, children: [] }), createText: text => ({ text }), createComment: () => ({}),
    insert: (node, parent) => parent.children.push(node), remove() {}, setText() {}, setElementText() {},
    patchProp: (node, key, _, value) => { node.props[key] = value }, parentNode: () => root, nextSibling: () => null,
  })
  const app = renderer.createApp(component)
  app.mount(root)
  unmount = () => app.unmount()
  return root.children[0]
}

it('确认搜索立即更新结果查询，保留既有 Bing 搜索跨月份规则', () => {
  series.value = 'bing'
  filterStore.categoryFilter = '2026-10'
  filterStore.subcategoryFilter = '其他'
  mountHeader().props.onClick()
  expect(filterStore.searchQuery).toBe('山')
  expect(filterStore.debouncedQuery).toBe('山')
  expect(filterStore.categoryFilter).toBe('all')
  expect(filterStore.subcategoryFilter).toBe('all')
})
