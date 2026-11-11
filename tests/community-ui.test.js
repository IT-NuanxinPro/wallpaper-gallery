import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { compileScript, compileStyle, parse } from 'vue/compiler-sfc'
import { publicProfileName } from '../src/utils/community/profile.js'
import { useCommunityRequest } from '../src/utils/community/useCommunityRequest.js'

const { createRenderer, h, nextTick, reactive } = Vue

const context = vi.hoisted(() => ({ route: null, auth: null, push: vi.fn(), api: {
  getProfile: vi.fn(), getWallpapers: vi.fn(), getConnections: vi.fn(), setFollowing: vi.fn(),
  getSettings: vi.fn(), getMyCollections: vi.fn(), saveSettings: vi.fn(), setCollectionVisibility: vi.fn(),
  getRelatedCollections: vi.fn(),
} }))
const RouterLink = { props: ['to'], setup: (props, { slots }) => () => h('a', { to: props.to }, slots.default?.()) }
// 仅隔离Element Plus的浮层/DOM；保留modelValue、disabled和真实组件事件合同。
const ElSwitch = {
  props: ['modelValue', 'disabled', 'ariaLabel'], emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('button', { role: 'switch', 'aria-label': props.ariaLabel, 'aria-checked': props.modelValue, disabled: props.disabled, onClick: () => { if (!props.disabled) emit('update:modelValue', !props.modelValue) } }),
}
const ElSelect = {
  props: ['modelValue', 'disabled', 'ariaLabel'], emits: ['change'],
  setup: (props, { emit, slots }) => () => h('div', { role: 'combobox', 'aria-label': props.ariaLabel, value: props.modelValue, disabled: props.disabled, onSelect: value => { if (!props.disabled) emit('change', value) } }, slots.default?.()),
}
const ElOption = { props: ['value', 'label'], setup: props => () => h('span', { role: 'option', value: props.value }, props.label) }
const dependencies = {
  ContentLoading: { props: ['label'], setup: props => () => h('div', {class: 'content-loading'}, props.label) },
  ContentEmpty: { props: ['description'], setup: (props, {slots}) => () => h('div', [props.description, slots.default?.()]) },
  ProfileTabs: { props: ['tabs', 'modelValue'], emits: ['update:modelValue'], setup: (props, { emit }) => () => h('nav', props.tabs.map(tab => h('button', { onClick: () => emit('update:modelValue', tab.key) }, tab.label))) },
  ElSwitch, ElSelect, ElOption,
  communityService: context.api, useAuthStore: () => context.auth, useRoute: () => context.route, useRouter: () => ({ push: context.push }),
  publicProfileName, useCommunityRequest, getAvatarInitial: () => '甲', getAvatarStyle: () => ({}), sanitizePublicAvatarUrl: () => '',
  SoftLoading: { props: ['label'], setup: props => () => h('span', props.label) },
  RemoteAvatar: { setup: () => () => h('span') }, PublicCollectionCard: { setup: () => () => h('div') }, PublicProfileCard: { setup: () => () => h('div') }, WallpaperCard: { setup: () => () => h('div') },
}
// 编译页面真实setup与模板，仅隔离视觉子组件；网络边界由可控RPC响应代替。
function compile(path) {
  const { descriptor } = parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  const { content } = compileScript(descriptor, { id: path, inlineTemplate: true })
  const source = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]vue['"]/g, (_, names) => `const {${names.replace(/\bas\b/g, ':')}} = Vue`)
    .replace(/^import[^\n]+$/gm, '').replace('export default', 'return')
  return new Function('Vue', ...Object.keys(dependencies), source)(Vue, ...Object.values(dependencies))
}
const PublicProfile = compile('../src/views/PublicProfile.vue')
const PublicProfileSettings = compile('../src/components/community/PublicProfileSettings.vue')
const AccountConnections = compile('../src/components/community/AccountConnections.vue')
const RelatedCollections = compile('../src/components/community/RelatedCollections.vue')

const profile = { id: '11111111-1111-4111-8111-111111111111', display_name: '公开甲', username: null, avatar_url: null, bio: null, show_likes: false, collection_count: 0, likes_count: null, followers_count: 0, following_count: 0, is_following: false }
const apps = []
const all = node => [node, ...(node.children || []).flatMap(all)]
const textOf = node => `${node.text || ''}${(node.children || []).map(textOf).join('')}`.replace(/<[^>]+>/g, '')
const button = (root, text) => all(root).find(node => node.tag === 'button' && textOf(node).trim() === text)
const settle = async () => { for (let i = 0; i < 12; i++) { await Promise.resolve(); await nextTick() } }

function mount(component) {
  const make = (tag, text = '') => ({ tag, tagName: tag.toUpperCase(), text, props: {}, children: [], parent: null, addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {} })
  function insert(node, parent, anchor) {
    if (node.parent) {
      const index = node.parent.children.indexOf(node)
      if (index >= 0) node.parent.children.splice(index, 1)
    }
    node.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node)
  }
  const renderer = createRenderer({
    createElement: tag => make(tag), createText: text => make('#text', text), createComment: () => make('#comment'),
    insert, remove(node) { const index = node.parent?.children.indexOf(node); if (index >= 0) node.parent.children.splice(index, 1) },
    setText(node, text) { node.text = text }, setElementText(node, text) { node.text = text; node.children = [] }, patchProp(node, key, old, value) { node.props[key] = value },
    parentNode: node => node.parent, nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] || null,
    insertStaticContent(content, parent, anchor) { const node = make('#static', content); insert(node, parent, anchor); return [node, node] },
  })
  const root = make('root')
  const app = renderer.createApp(component)
  app.component('RouterLink', RouterLink)
  app.mount(root)
  apps.push(app)
  return root
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false, visibilityState: 'visible' }))
  context.route = reactive({ params: { id: profile.id }, query: {}, path: `/people/${profile.id}`, fullPath: `/people/${profile.id}` })
  context.auth = reactive({ user: null, isAuthenticated: false })
  context.api.getProfile.mockResolvedValue({ ...profile })
  context.api.getWallpapers.mockResolvedValue({ items: [], has_more: false })
  context.api.getConnections.mockResolvedValue({ items: [], has_more: false })
  context.api.getSettings.mockResolvedValue({ enabled: false, show_likes: false })
  context.api.getMyCollections.mockResolvedValue({ items: [], has_more: false })
  context.api.getRelatedCollections.mockResolvedValue([])
})
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.unstubAllGlobals() })

it('游客关注进入现有登录流程并保留主页地址', async () => {
  const root = mount(PublicProfile)
  await settle()
  expect(textOf(root)).toContain('公开甲')
  await button(root, '关注').props.onClick()
  expect(context.push).toHaveBeenCalledWith({ path: '/login', query: { redirect: `/people/${profile.id}` } })
  expect(context.api.setFollowing).not.toHaveBeenCalled()
})

it('路由切换立刻清除旧主页，迟到响应不能重新显示已关闭用户', async () => {
  const pending = []
  context.api.getProfile.mockImplementation(id => new Promise(resolve => pending.push({ id, resolve })))
  const root = mount(PublicProfile)
  context.route.params.id = '22222222-2222-4222-8222-222222222222'
  await settle()
  pending.at(-1).resolve(null)
  await settle()
  expect(textOf(root)).toContain('尚未公开')
  pending[0].resolve({ ...profile })
  await settle()
  expect(textOf(root)).not.toContain('公开甲')
})

it('真实关注成功后刷新当前粉丝列表和计数，重复点击禁用', async () => {
  context.auth.user = { id: '22222222-2222-4222-8222-222222222222' }
  context.auth.isAuthenticated = true
  context.route.query.tab = 'followers'
  let resolveFollow
  context.api.setFollowing.mockImplementation(() => new Promise(resolve => { resolveFollow = resolve }))
  const root = mount(PublicProfile)
  await settle()
  const following = button(root, '关注').props.onClick()
  await settle()
  expect(button(root, '处理中…').props.disabled).toBe(true)
  context.api.getProfile.mockResolvedValue({ ...profile, is_following: true, followers_count: 1 })
  resolveFollow({ following: true, followers_count: 1, following_count: 0 })
  await following
  await settle()
  expect(context.api.getConnections).toHaveBeenCalledTimes(2)
  expect(button(root, '已关注 · 取消')).toBeTruthy()
})

it('设置保存期间切换账号不会显示旧账号结果，初始不自动发布', async () => {
  context.auth.user = { id: profile.id }
  let finish
  context.api.saveSettings.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const root = mount(PublicProfileSettings)
  await settle()
  expect(context.api.saveSettings).not.toHaveBeenCalled()
  const form = all(root).find(node => node.tag === 'form')
  const save = form.props.onSubmit({ preventDefault() {} })
  context.auth.user = { id: '22222222-2222-4222-8222-222222222222' }
  await settle()
  finish({ enabled: true, show_likes: true })
  await save
  await settle()
  expect(textOf(root)).not.toContain('公开设置已保存')
  expect(textOf(root)).not.toContain('查看我的主页')
})

it('写超时不宣称未更新，重新读取服务端最新设置后才允许再保存', async () => {
  context.auth.user = { id: profile.id }
  context.api.saveSettings.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
  const root = mount(PublicProfileSettings)
  await settle()
  const submit = () => all(root).find(node => node.tag === 'form').props.onSubmit({ preventDefault() {} })
  await submit()
  await settle()
  expect(textOf(root)).toContain('保存结果未确认')
  expect(textOf(root)).not.toContain('设置未更新')
  expect(button(root, '保存公开设置').props.disabled).toBe(true)
  await submit()
  expect(context.api.saveSettings).toHaveBeenCalledTimes(1)
  context.api.getSettings.mockResolvedValue({ enabled: true, show_likes: true })
  await button(root, '重新读取设置').props.onClick()
  await settle()
  expect(textOf(root)).toContain('查看我的主页')
  expect(textOf(root)).toContain('已重新读取最新设置')
  expect(button(root, '保存公开设置').props.disabled).toBe(false)
  context.api.saveSettings.mockResolvedValue({ enabled: true, show_likes: true })
  await submit()
  await settle()
  expect(context.api.saveSettings).toHaveBeenCalledTimes(2)
  expect(textOf(root)).toContain('公开设置已保存')
})

it('写入或随后核对读取失败时不显示保存成功，核对失败仍禁止再次写入', async () => {
  context.auth.user = { id: profile.id }
  context.api.saveSettings.mockResolvedValue({ enabled: true, show_likes: false })
  const root = mount(PublicProfileSettings)
  await settle()
  context.api.getSettings.mockRejectedValueOnce(new Error('network'))
  await all(root).find(node => node.tag === 'form').props.onSubmit({ preventDefault() {} })
  await settle()
  expect(textOf(root)).not.toContain('公开设置已保存')
  expect(textOf(root)).toContain('保存结果未确认')
  context.api.getSettings.mockRejectedValueOnce(new Error('network'))
  await button(root, '重新读取设置').props.onClick()
  await settle()
  expect(context.api.saveSettings).toHaveBeenCalledTimes(1)
  expect(textOf(root)).not.toContain('已重新读取最新设置')
})

it('自定义开关保留喜欢的依赖禁用与两项设置真实保存值', async () => {
  context.auth.user = { id: profile.id }
  context.api.saveSettings.mockResolvedValue({ enabled: true, show_likes: true })
  const root = mount(PublicProfileSettings)
  await settle()
  const control = label => all(root).find(node => node.props?.role === 'switch' && node.props['aria-label'] === label)
  expect(control('展示我的喜欢')?.props.disabled).toBe(true)
  control('发布我的主页').props.onClick()
  await settle()
  expect(control('展示我的喜欢').props.disabled).toBe(false)
  control('展示我的喜欢').props.onClick()
  await settle()
  await all(root).find(node => node.tag === 'form').props.onSubmit({ preventDefault() {} })
  expect(context.api.saveSettings).toHaveBeenCalledWith({ enabled: true, show_likes: true }, profile.id)
})

it('自定义选择器直接传visibility值并在保存期间禁用，读取后显示真实值', async () => {
  context.auth.user = { id: profile.id }
  const collection = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: '我的选集', visibility: 'private' }
  context.api.getMyCollections.mockResolvedValue({ items: [collection], has_more: false })
  let finish
  context.api.setCollectionVisibility.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const root = mount(PublicProfileSettings)
  await settle()
  const control = () => all(root).find(node => node.props?.role === 'combobox')
  expect(control()?.props.value).toBe('private')
  control().props.onSelect('public')
  await settle()
  expect(context.api.setCollectionVisibility).toHaveBeenCalledWith(collection.id, 'public', profile.id)
  expect(control().props.disabled).toBe(true)
  control().props.onSelect('unlisted')
  expect(context.api.setCollectionVisibility).toHaveBeenCalledTimes(1)
  context.api.getMyCollections.mockResolvedValue({ items: [{ ...collection, visibility: 'public' }], has_more: false })
  finish({ ...collection, visibility: 'public' })
  await settle()
  expect(control().props.value).toBe('public')
  expect(control().props.disabled).toBe(false)
})

it('相关收藏空结果折叠并退出可访问树，刷新有结果后重新展开', async () => {
  const root = mount(RelatedCollections)
  await settle()
  const section = () => all(root).find(node => node.tag === 'section')
  expect(section().props['aria-hidden']).toBe(true)
  expect(section().props.inert).toBe(true)
  expect(section().props.style.gridTemplateRows).toBe('0fr')
  expect(textOf(root)).not.toContain('暂时没有公开收藏')
  let finish
  context.api.getRelatedCollections.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  context.auth.user = { id: profile.id }
  await settle()
  expect(section().props['aria-hidden']).toBe(true)
  expect(section().props.style.gridTemplateRows).toBe('0fr')
  finish([{ id: 'collection-id', user_id: profile.id, name: '公开选集', item_count: 1, asset_keys: [] }])
  await settle()
  expect(section().props.style.gridTemplateRows).toBe('1fr')
  expect(textOf(root)).not.toContain('正在查找公开收藏')
})

it('相关收藏初次慢网及失败始终隐藏，迟到空响应不能覆盖新结果', async () => {
  let finishOld
  context.api.getRelatedCollections.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
  const root = mount(RelatedCollections)
  await settle()
  const section = () => all(root).find(node => node.tag === 'section')
  expect(section().props.style.gridTemplateRows).toBe('0fr')
  context.api.getRelatedCollections.mockRejectedValueOnce(new Error('network'))
  context.auth.user = { id: profile.id }
  await settle()
  expect(section().props.style.gridTemplateRows).toBe('0fr')
  expect(textOf(root)).not.toContain('暂时无法加载')
  context.api.getRelatedCollections.mockResolvedValueOnce([{ id: 'current-collection', asset_keys: [] }])
  context.auth.user = { id: 'new-user' }
  await settle()
  finishOld([])
  await settle()
  expect(section().props['aria-hidden']).toBeUndefined()
  expect(section().props.style.gridTemplateRows).toBe('1fr')
})

it('公开设置深色样式编译后只作用于组件，不覆盖页面主题根节点', () => {
  const { descriptor } = parse(readFileSync(new URL('../src/components/community/PublicProfileSettings.vue', import.meta.url), 'utf8'))
  const result = compileStyle({ source: descriptor.styles[0].content, id: 'data-v-public-settings-test', scoped: true })
  expect(result.errors).toEqual([])
  const darkSelectors = []
  result.rawResult.root.walkRules(rule => { if (rule.selector.includes('data-theme')) darkSelectors.push(rule.selector) })
  expect(darkSelectors.length).toBeGreaterThan(0)
  for (const selector of darkSelectors) {
    expect(selector).toContain('.public-settings')
    expect(selector).toContain('[data-v-public-settings-test]')
  }
})

it('切换主页内容只加载列表，头像昵称与关注按钮不会被整页loading替换', async () => {
  const root = mount(PublicProfile)
  await settle()
  let finish
  context.api.getConnections.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  context.route.query.tab = 'following'
  await settle()
  expect(textOf(root)).toContain('公开甲')
  expect(textOf(root)).toContain('正在加载壁纸内容')
  expect(button(root, '关注')).toBeTruthy()
  expect(context.api.getProfile).toHaveBeenCalledTimes(1)
  finish({ items: [], has_more: false })
  await settle()
  expect(textOf(root)).toContain('公开甲')
})


it('公开设置完整响应前只显示模块loading，不提前渲染表单和标题', async () => {
  context.auth.user = { id: profile.id }
  let finishSettings
  let finishCollections
  context.api.getSettings.mockImplementationOnce(() => new Promise(resolve => { finishSettings = resolve }))
  context.api.getMyCollections.mockImplementationOnce(() => new Promise(resolve => { finishCollections = resolve }))
  const root = mount(PublicProfileSettings)
  await settle()
  expect(textOf(root)).toContain('正在读取公开设置')
  expect(all(root).some(node => node.tag === 'h2' || node.tag === 'form')).toBe(false)
  finishSettings({ enabled: false, show_likes: false })
  await settle()
  expect(textOf(root)).toContain('正在读取公开设置')
  finishCollections({ items: [{ id: 'folder', name: '默认收藏夹', visibility: 'private' }], has_more: false })
  await settle()
  expect(textOf(root)).not.toContain('正在读取公开设置')
  expect(textOf(root)).toContain('发布我的主页')
  expect(all(root).filter(node => node.props?.role === 'option').map(node => node.props.value)).toEqual(['private', 'public'])
})

it('关注和粉丝请求完成前使用同一居中loading容器', async () => {
  context.auth.user = { id: profile.id }
  let finish
  context.api.getConnections.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const root = mount({ setup: () => () => h(AccountConnections, {kind: 'followers'}) })
  await settle()
  expect(all(root).some(node => node.props.class === 'content-loading')).toBe(true)
  expect(textOf(root)).toContain('正在加载粉丝')
  finish({ items: [], has_more: false })
  await settle()
  expect(textOf(root)).toContain('还没有公开粉丝')
  expect(textOf(root)).not.toContain('正在加载粉丝')
  expect(textOf(root)).not.toContain('发现壁纸同好')
})
