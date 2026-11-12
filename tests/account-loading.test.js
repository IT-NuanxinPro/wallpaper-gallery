import { readFileSync } from 'node:fs'
import { createPinia, defineStore, setActivePinia, storeToRefs } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as avatars from '../src/utils/auth/avatarAppearance.js'
import * as errors from '../src/utils/auth/errors.js'
import * as providers from '../src/utils/auth/providers.js'
import * as profiles from '../src/utils/auth/providerProfile.js'
import { SERIES_CONFIG } from '../src/utils/config/constants.js'
import { resolveWallpaperSeries } from '../src/utils/wallpaper/identity.js'
import { restoreWallpaperFromAssetKey } from '../src/utils/wallpaper/transformers.js'

const context = { auth: null, interaction: null, route: null, resolver: vi.fn(), replace: vi.fn() }
const componentStub = { setup: (_, { slots }) => () => Vue.h('div', slots.default?.()) }
const deps = {
  storeToRefs, ...avatars, ...errors, ...providers, ...profiles, SERIES_CONFIG, resolveWallpaperSeries, restoreWallpaperFromAssetKey,
  useDevice: () => ({ isMobile: Vue.ref(false) }), useRoute: () => context.route, useRouter: () => ({ replace: context.replace }),
  useAuthStore: () => context.auth, useInteractionStore: () => context.interaction,
  useWallpaperStore: () => ({ resolveWallpapersByAssetKeys: context.resolver }),
  linuxdoIcon: '', ElMessage: { warning() {}, error() {}, success() {} }, ElMessageBox: {},
  PageLoadingScene: { setup: () => () => Vue.h('div', '整页加载') },
  RemoteAvatar: componentStub, ProfileTabs: componentStub, PublicProfileSettings: componentStub, AccountConnections: componentStub,
  ContentEmpty: { props: ['description'], setup: props => () => Vue.h('p', props.description) },
  LoadingSpinner: componentStub, WallpaperRotationPanel: componentStub,
  WallpaperCard: { props: ['wallpaper'], setup: props => () => Vue.h('article', props.wallpaper.filename) },
}
function compile(path, extras = {}) {
  const { descriptor } = parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  const { content } = compileScript(descriptor, { id: path, inlineTemplate: true })
  const source = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]vue['"]/g, (_, names) => `const {${names.replace(/\bas\b/g, ':')}} = Vue`)
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*'[^']+'\n/g, '').replace(/^import[^\n]+$/gm, '').replace('export default', 'return')
  const dependencies = { ...deps, ...extras }
  return new Function('Vue', ...Object.keys(dependencies), source)(Vue, ...Object.values(dependencies))
}
const Library = compile('../src/views/Library.vue')
const Account = compile('../src/views/Account.vue', { Library })
const apps = []
const all = node => [node, ...(node.children || []).flatMap(all)]
const text = node => `${node.text || ''}${(node.children || []).map(text).join('')}`.replace(/<[^>]+>/g, '')
const settle = async () => { for (let i = 0; i < 10; i++) { await Promise.resolve(); await Vue.nextTick() } }
function mount(component, props = {}) {
  const make = (tag, value = '') => Vue.markRaw({ tag, text: value, props: {}, style: {}, children: [], parent: null, addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {} })
  const insert = (node, parent, anchor) => {
    if (node.parent) { const index = node.parent.children.indexOf(node); if (index >= 0) node.parent.children.splice(index, 1) }
    node.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node)
  }
  const renderer = Vue.createRenderer({
    createElement: tag => make(tag), createText: value => make('#text', value), createComment: () => make('#comment'), insert,
    remove(node) { const index = node.parent?.children.indexOf(node); if (index >= 0) node.parent.children.splice(index, 1) },
    setText: (node, value) => { node.text = value }, setElementText: (node, value) => { node.text = value; node.children = [] },
    patchProp: (node, key, _old, value) => { node.props[key] = value }, parentNode: node => node.parent,
    nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] || null,
    insertStaticContent(value, parent, anchor) { const node = make('#static', value); insert(node, parent, anchor); return [node, node] },
  })
  const root = make('root')
  const app = renderer.createApp({ render: () => Vue.h(component, props) })
  app.component('RouterLink', componentStub)
  app.component('el-dialog', { render: () => null })
  app.component('el-tabs', componentStub)
  app.component('el-tab-pane', componentStub)
  app.mount(root)
  apps.push(app)
  return root
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  context.route = Vue.reactive({ path: '/account', query: {}, fullPath: '/account' })
  context.auth = defineStore('test-account-auth', () => ({
    user: Vue.ref({ id: 'user-a' }), isAuthenticated: Vue.ref(true), isConfigured: Vue.ref(true), isInitialized: Vue.ref(true), isInitializing: Vue.ref(false),
    displayName: Vue.ref('测试用户'), avatarCandidates: Vue.ref([]), avatarUrl: Vue.ref(''), primaryEmail: Vue.ref('test@example.com'),
    activeAuthProvider: Vue.ref('email'), accountHandleText: Vue.ref('@test'), linkedIdentities: Vue.ref([]), initialize: vi.fn(),
  }))()
  context.interaction = Vue.reactive({
    stats: { likes: 1, collections: 1, downloads: 0 }, allLikes: [], allCollectionItems: [], likesBySeries: {}, collectionsBySeries: {},
    libraryLoading: true, libraryLoaded: false, libraryError: '', libraryOwner: 'user-a',
    loadLibraryData: vi.fn(() => new Promise(() => {})), $reset: vi.fn(),
  })
  context.resolver.mockResolvedValue([])
})
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.unstubAllGlobals() })

it('已有登录身份立即展示个人中心身份和标签，不等待壁纸库网络请求', async () => {
  const root = mount(Account)
  await settle()
  expect(text(root)).toContain('测试用户')
  expect(text(root)).not.toContain('整页加载')
})

it('壁纸库切空标签会取消旧解析，迟到内容不能出现在新标签', async () => {
  context.interaction.libraryLoaded = true
  context.interaction.libraryLoading = false
  context.interaction.loadLibraryData.mockResolvedValue()
  context.interaction.allCollectionItems = [{ asset_key: 'desktop:path:/wallpaper/desktop/a.jpg' }]
  let finish
  context.resolver.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const props = Vue.reactive({ embedded: true, contentTab: 'collections' })
  const root = mount(Library, props)
  await settle()
  props.contentTab = 'likes'
  await settle()
  finish([{ filename: '私人收藏.jpg', _assetKey: 'desktop:path:/wallpaper/desktop/a.jpg' }])
  await settle()
  expect(text(root)).not.toContain('私人收藏.jpg')
  expect(text(root)).toContain('还没有喜欢的壁纸')
})

it('个人中心收藏喜欢切换后复用已解析列表，不闪整块加载', async () => {
  context.interaction.libraryLoaded = true
  context.interaction.libraryLoading = false
  context.interaction.loadLibraryData.mockResolvedValue()
  context.interaction.allCollectionItems = [{ asset_key: 'desktop:path:/wallpaper/desktop/a.jpg' }]
  context.interaction.allLikes = [{ asset_key: 'desktop:path:/wallpaper/desktop/b.jpg' }]
  context.resolver.mockImplementation(async keys => keys.map(key => ({ filename: key.endsWith('a.jpg') ? '收藏A' : '喜欢B', _assetKey: key })))
  const props = Vue.reactive({ embedded: true, contentTab: 'collections' })
  const root = mount(Library, props)
  await settle()
  props.contentTab = 'likes'
  await settle()
  props.contentTab = 'collections'
  await settle()
  expect(text(root)).toContain('收藏A')
  expect(context.resolver).toHaveBeenCalledTimes(2)
  expect(all(root).some(node => node.props.class === 'library-loading')).toBe(false)
})

it('已取得的壁纸追加在下一次DOM更新立即显示，不人为等待loading定时器', async () => {
  vi.stubGlobal('window', { setTimeout: vi.fn() })
  context.interaction.libraryLoaded = true
  context.interaction.libraryLoading = false
  context.interaction.loadLibraryData.mockResolvedValue()
  context.interaction.allCollectionItems = Array.from({ length: 30 }, (_, i) => ({ asset_key: `desktop:path:/wallpaper/desktop/${i}.jpg` }))
  context.resolver.mockImplementation(async keys => keys.map(key => ({ filename: key, _assetKey: key })))
  const root = mount(Library, { embedded: true, contentTab: 'collections' })
  await settle()
  expect(all(root).filter(node => node.tag === 'article')).toHaveLength(24)
  const more = all(root).find(node => node.tag === 'button' && text(node).trim() === '加载更多壁纸')
  more.props.onClick()
  more.props.onClick()
  await settle()
  expect(all(root).filter(node => node.tag === 'article')).toHaveLength(30)
  expect(window.setTimeout).not.toHaveBeenCalled()
})

it('鉴权未初始化不能提前渲染私有壁纸，登出立刻卸载身份内容', async () => {
  context.auth.isInitialized = false
  context.auth.initialize = vi.fn(() => new Promise(() => {}))
  const root = mount(Account)
  await settle()
  expect(text(root)).not.toContain('测试用户')
  context.auth.isInitialized = true
  await settle()
  expect(text(root)).toContain('测试用户')
  context.auth.isAuthenticated = false
  context.auth.user = null
  await settle()
  expect(text(root)).not.toContain('测试用户')
  expect(context.interaction.$reset).toHaveBeenCalled()
})

it('公开设置核对变更后只重建关系列表，保留身份和其他已打开标签', async () => {
  let notifyVisibility
  let connectionsMounted = 0
  let librariesMounted = 0
  const AccountWithPanels = compile('../src/views/Account.vue', {
    Library: { setup() { librariesMounted++; return () => Vue.h('div', '我的收藏') } },
    AccountConnections: { setup() { connectionsMounted++; return () => Vue.h('div', '关系列表') } },
    PublicProfileSettings: { emits: ['visibilityChanged'], setup(_, { emit }) { notifyVisibility = actor => emit('visibilityChanged', actor); return () => Vue.h('div', '公开设置') } },
  })
  const root = mount(AccountWithPanels)
  await settle()
  const identity = all(root).find(node => node.tag === 'header')
  context.route.query.tab = 'following'
  await settle()
  context.route.query.tab = 'settings'
  await settle()
  notifyVisibility('user-a')
  await settle()
  expect(connectionsMounted).toBe(2)
  expect(librariesMounted).toBe(1)
  expect(all(root).find(node => node.tag === 'header') === identity).toBe(true)
  notifyVisibility('old-user')
  await settle()
  expect(connectionsMounted).toBe(2)
})
