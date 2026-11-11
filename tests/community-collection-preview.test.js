import { readFileSync } from 'node:fs'
import { afterEach, expect, it } from 'vitest'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

const { descriptor } = parse(readFileSync(new URL('../src/components/community/PublicCollectionCard.vue', import.meta.url), 'utf8'))
const { content } = compileScript(descriptor, { id: 'collection-preview-test', inlineTemplate: true })
const source = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]vue['"]/g, (_, names) => `const {${names.replace(/\bas\b/g, ':')}} = Vue`).replace(/^import[^\n]+$/gm, '').replace('export default', 'return')
const apps = []
afterEach(() => apps.splice(0).forEach(app => app.unmount()))

function renderPreview(count) {
  const state = Vue.ref({ status: 'ready', data: Array.from({ length: count }, (_, index) => ({ assetKey: `image-${index}`, thumbnailUrl: `/image-${index}.jpg`, title: `壁纸${index}` })) })
  const Card = new Function('Vue', 'loadCommunityWallpapers', 'publicProfileName', 'useCommunityRequest', source)(Vue, () => {}, () => '', () => ({ state }))
  const nodes = []
  const renderer = Vue.createRenderer({
    createElement(tag) { const node = { tag, props: {} }; nodes.push(node); return node }, createText: text => ({ text }), createComment: text => ({ text }),
    insert() {}, remove() {}, setText(node, text) { node.text = text }, setElementText(node, text) { node.text = text },
    patchProp(node, key, old, value) { node.props[key] = value }, parentNode: () => null, nextSibling: () => null,
  })
  const app = renderer.createApp(Card, { collection: { id: 'collection-id', user_id: 'owner-id', name: '公开选集', item_count: count, asset_keys: [] } })
  app.component('RouterLink', { props: ['to'], setup: (props, { slots }) => () => Vue.h('a', { to: props.to }, slots.default?.()) })
  app.mount({})
  apps.push(app)
  return { preview: nodes.find(node => node.props.class?.includes('public-collection__preview')), images: nodes.filter(node => node.tag === 'img') }
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
