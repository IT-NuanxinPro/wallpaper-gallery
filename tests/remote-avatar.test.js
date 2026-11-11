import { readFileSync } from 'node:fs'
import { afterEach, expect, it } from 'vitest'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

const { descriptor } = parse(readFileSync(new URL('../src/components/common/ui/RemoteAvatar.vue', import.meta.url), 'utf8'))
const { content } = compileScript(descriptor, { id: 'remote-avatar-test', inlineTemplate: true })
const source = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]vue['"]/g, (_, names) => `const {${names.replace(/\bas\b/g, ':')}} = Vue`).replace('export default', 'return')
const Avatar = new Function('Vue', source)(Vue)
const apps = []
afterEach(() => apps.splice(0).forEach(app => app.unmount()))

async function mountAvatar(initialProps = {}, slots) {
  const nodes = []
  const make = (tag, text = '') => ({ tag, text, props: {}, children: [], parent: null })
  const renderer = Vue.createRenderer({
    createElement(tag) { const node = make(tag); nodes.push(node); return node },
    createText: text => make('#text', text), createComment: text => make('#comment', text),
    insert(node, parent, anchor) {
      node.parent = parent
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index < 0 ? parent.children.length : index, 0, node)
    },
    remove(node) {
      node.removed = true
      const index = node.parent?.children.indexOf(node)
      if (index >= 0) node.parent.children.splice(index, 1)
    },
    setText(node, text) { node.text = text }, setElementText(node, text) { node.text = text },
    patchProp(node, key, old, value) { node.props[key] = value },
    parentNode: node => node.parent, nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] || null,
  })
  const props = Vue.reactive({ initial: '山', ...initialProps })
  const app = renderer.createApp({ render: () => Vue.h(Avatar, props, slots) })
  app.mount(make('root'))
  apps.push(app)
  await Vue.nextTick()
  const active = tag => nodes.findLast(node => node.tag === tag && !node.removed)
  return { props, active }
}

it('候选头像依次尝试，最后地址失败后显示首字回退而非破图', async () => {
  const avatar = await mountAvatar({ sources: ['https://example.test/first.png', 'https://example.test/second.png'] })
  expect(avatar.active('img').props.src).toBe('https://example.test/first.png')
  avatar.active('img').props.onError()
  await Vue.nextTick()
  expect(avatar.active('img').props.src).toBe('https://example.test/second.png')
  avatar.active('img').props.onError()
  await Vue.nextTick()
  expect(avatar.active('img')).toBeUndefined()
  expect(avatar.active('span').text).toBe('山')
})

it('失败回退后切换用户来源重新加载首个头像', async () => {
  const avatar = await mountAvatar({ src: 'https://example.test/old.png' })
  avatar.active('img').props.onError()
  await Vue.nextTick()
  expect(avatar.active('img')).toBeUndefined()
  avatar.props.src = 'https://example.test/new.png'
  await Vue.nextTick()
  expect(avatar.active('img').props.src).toBe('https://example.test/new.png')
  expect(avatar.active('span')).toBeUndefined()
})

it('候选全部失败时保留自定义fallback插槽', async () => {
  const avatar = await mountAvatar({ src: 'https://example.test/broken.png' }, { fallback: () => Vue.h('strong', '自定义头像') })
  avatar.active('img').props.onError()
  await Vue.nextTick()
  expect(avatar.active('img')).toBeUndefined()
  expect(avatar.active('strong').text).toBe('自定义头像')
})
