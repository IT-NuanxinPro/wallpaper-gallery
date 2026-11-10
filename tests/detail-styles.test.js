import { expect, it } from 'vitest'
import { buildDetailShell } from '../scripts/lib/detailShell.js'
import { prepareDetailStyles } from '../src/utils/platform/detailStyles.js'

function stylesheet(loaded = false) {
  const handlers = new Map()
  return { sheet: loaded ? {} : null, media: 'print', handlers,
    addEventListener: (name, handler) => handlers.set(name, handler),
    removeEventListener: name => handlers.delete(name),
  }
}

it('完整样式延迟时关键布局仍内联，并在全部样式可用后一起启用', async () => {
  const html = buildDetailShell('<head><link rel="stylesheet" href="/app.css"><link rel="modulepreload" href="/vue.js"></head><body></body>', '.detail-layout{display:grid}')
  expect(html).toContain('media="print" data-detail-stylesheet')
  expect(html).toContain('<style data-detail-critical>.detail-layout{display:grid}</style>')
  expect(html).toContain('<link rel="modulepreload" href="/vue.js">')
  const first = stylesheet(true), second = stylesheet()
  let ready = false
  const prepared = prepareDetailStyles({ querySelectorAll: () => [first, second] }).then(() => { ready = true })
  await Promise.resolve()
  expect(ready).toBe(false)
  expect(first.media).toBe('print')
  second.handlers.get('load')()
  await prepared
  expect([first.media, second.media]).toEqual(['all', 'all'])
  expect(second.handlers.size).toBe(0)
})

it('样式失败不启用半成品界面，普通页面没有延迟样式时直接就绪', async () => {
  const broken = stylesheet()
  const prepared = prepareDetailStyles({ querySelectorAll: () => [broken] })
  const rejected = expect(prepared).rejects.toThrow('样式加载失败')
  broken.handlers.get('error')()
  await rejected
  expect(broken.media).toBe('print')
  expect(broken.handlers.size).toBe(0)
  await expect(prepareDetailStyles({ querySelectorAll: () => [] })).resolves.toBeUndefined()
})
