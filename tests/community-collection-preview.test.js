import { readFileSync } from 'node:fs'
import { afterEach, expect, it } from 'vitest'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { getAvatarInitial, getAvatarStyle } from '../src/utils/auth/avatarAppearance.js'
import { sanitizePublicAvatarUrl } from '../src/utils/auth/providerProfile.js'
import { publicProfileName } from '../src/utils/community/profile.js'

const { descriptor } = parse(readFileSync(new URL('../src/components/community/PublicCollectionCard.vue', import.meta.url), 'utf8'))
const { content } = compileScript(descriptor, { id: 'collection-preview-test', inlineTemplate: true })
const source = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]vue['"]/g, (_, names) => `const {${names.replace(/\bas\b/g, ':')}} = Vue`).replace(/^import[^\n]+$/gm, '').replace('export default', 'return')
const avatarDescriptor = parse(readFileSync(new URL('../src/components/common/ui/RemoteAvatar.vue', import.meta.url), 'utf8')).descriptor
const avatarSource = compileScript(avatarDescriptor, { id: 'collection-owner-avatar', inlineTemplate: true }).content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]vue['"]/g, (_, names) => `const {${names.replace(/\bas\b/g, ':')}} = Vue`).replace('export default', 'return')
const RemoteAvatar = new Function('Vue', avatarSource)(Vue)
const apps = []
afterEach(() => apps.splice(0).forEach(app => app.unmount()))

function renderPreview(count, options = {}) {
  const state = Vue.ref({ status: 'ready', data: Array.from({ length: count }, (_, index) => ({ assetKey: `image-${index}`, thumbnailUrl: `/image-${index}.jpg`, title: `壁纸${index}` })) })
  const Card = new Function('Vue', 'loadCommunityWallpapers', 'publicProfileName', 'useCommunityRequest', 'RemoteAvatar', 'getAvatarInitial', 'getAvatarStyle', 'sanitizePublicAvatarUrl', source)(Vue, () => {}, publicProfileName, () => ({ state }), RemoteAvatar, getAvatarInitial, getAvatarStyle, sanitizePublicAvatarUrl)
  const nodes = []
  const renderer = Vue.createRenderer({
    createElement(tag) { const node = { tag, props: {} }; nodes.push(node); return node }, createText: text => ({ text }), createComment: text => ({ text }),
    insert() {}, remove() {}, setText(node, text) { node.text = text }, setElementText(node, text) { node.text = text },
    patchProp(node, key, old, value) { node.props[key] = value }, parentNode: () => null, nextSibling: () => null,
  })
  const app = renderer.createApp(Card, { collection: { id: 'collection-id', user_id: 'owner-id', name: '公开选集', item_count: count, asset_keys: [], profile: options.profile }, showOwner: options.showOwner })
  app.component('RouterLink', { props: ['to'], setup: (props, { slots }) => () => Vue.h('a', { to: props.to }, slots.default?.()) })
  app.mount({})
  apps.push(app)
  return { nodes, preview: nodes.find(node => node.props.class?.includes('public-collection__preview')), images: nodes.filter(node => node.tag === 'img') }
}

it.each([
  [1, 'minmax(0, 1fr)', 'minmax(0, 1fr)'],
  [2, 'repeat(2, minmax(0, 1fr))', 'minmax(0, 1fr)'],
  [3, 'repeat(2, minmax(0, 1fr))', 'repeat(2, minmax(0, 1fr))'],
  [4, 'repeat(2, minmax(0, 1fr))', 'repeat(2, minmax(0, 1fr))'],
])('%i张预览按数量占满网格，不为双图保留空白第二行', (count, columns, rows) => {
  const { preview, images } = renderPreview(count)
  expect(images).toHaveLength(count)
  expect(preview.props.style).toMatchObject({ gridTemplateColumns: columns, gridTemplateRows: rows })
  for (const [index, image] of images.entries()) {
    expect(image.props.src).toBe(`/image-${index}.jpg`)
    expect(image.props.style?.gridRow).toBe(count === 3 && index === 0 ? 'span 2' : undefined)
  }
})

it('相关收藏使用公开用户头像和名称，副标题简洁，并保留原收藏夹跳转', () => {
  const { nodes } = renderPreview(4, { showOwner: true, profile: { display_name: '暖心', username: 'nuanxin', avatar_url: 'https://images.example/avatar.jpg' } })
  expect(nodes.find(node => node.tag === 'img' && node.props.alt === '暖心的头像')?.props.src).toBe('https://images.example/avatar.jpg')
  expect(nodes.some(node => node.tag === 'h3' && node.text === '暖心')).toBe(true)
  expect(nodes.some(node => node.tag === 'p' && node.text === 'TA 的收藏')).toBe(true)
  expect(nodes.some(node => node.tag === 'h3' && node.text === '公开选集')).toBe(false)
  expect(nodes.find(node => node.tag === 'a').props.to).toEqual({ path: '/people/owner-id', query: { tab: 'collections', collection: 'collection-id' } })
})

it('用户没有头像时显示用户名首字占位，个人主页收藏卡仍保留收藏夹名称', () => {
  const { nodes } = renderPreview(1, { showOwner: true, profile: { username: 'Alice', avatar_url: '' } })
  expect(nodes.some(node => node.tag === 'h3' && node.text === 'Alice')).toBe(true)
  expect(nodes.some(node => node.tag === 'span' && node.text === 'A')).toBe(true)
  const standard = renderPreview(1)
  expect(standard.nodes.some(node => node.tag === 'h3' && node.text === '公开选集')).toBe(true)
})
