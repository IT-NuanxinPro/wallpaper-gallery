import { readFileSync } from 'node:fs'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as Vue from 'vue'
import { describe, expect, it, vi } from 'vitest'

describe('裁剪预览画布尺寸', () => {
  it('观察实际预览容器变化触发画布重绘，卸载断开观察', async () => {
    const { resizePreviewCanvas } = await import('../src/utils/wallpaper/previewCanvas.js')
    let notify
    let observed
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback) { notify = callback }
      observe(element) { observed = element }
      disconnect() { disconnect() }
    })
    const { descriptor } = parse(readFileSync(new URL('../src/components/wallpaper/crop/shared/CropPreviewSection.vue', import.meta.url), 'utf8'))
    const { content } = compileScript(descriptor, { id: 'crop-preview', inlineTemplate: true })
    const source = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]vue['"]/g, (_, names) => `const {${names.replace(/\bas\b/g, ':')}} = Vue`)
      .replace('export default', 'return')
    const component = new Function('Vue', source)(Vue)
    let canvas
    const renderer = Vue.createRenderer({
      createElement(tag) {
        const element = Vue.markRaw({ tag, style: {}, clientWidth: 720, clientHeight: 405 })
        if (tag === 'canvas') canvas = element
        return element
      },
      createText: () => ({}), createComment: () => ({}), insertStaticContent: () => [{}, {}],
      insert(el, parent) { el.parentElement = parent }, remove() {}, setText() {}, setElementText() {}, patchProp() {},
      parentNode: el => el.parentElement, nextSibling: () => null,
    })
    const app = renderer.createApp(component, { onResize: () => resizePreviewCanvas(canvas, 2) })
    try {
      app.mount({})
      await Vue.nextTick()
      expect(observed.tag).toBe('div')
      expect(canvas.width).toBe(1440)
      observed.clientWidth = 190
      observed.clientHeight = 412
      notify()
      expect(canvas.width).toBe(380)
      expect(canvas.height).toBe(824)
      expect(canvas.style).toEqual({})
    }
    finally {
      app.unmount()
      vi.unstubAllGlobals()
    }
    expect(disconnect).toHaveBeenCalled()
  })

  it('按预览容器重建像素，收窄再扩大不受旧canvas尺寸约束', async () => {
    const { resizePreviewCanvas } = await import('../src/utils/wallpaper/previewCanvas.js')
    const container = { clientWidth: 720, clientHeight: 405 }
    const canvas = { parentElement: container, width: 300, height: 150, offsetWidth: 720, offsetHeight: 405, style: {} }
    expect(resizePreviewCanvas(canvas, 2)).toEqual({ width: 720, height: 405, dpr: 2 })
    expect(canvas).toMatchObject({ width: 1440, height: 810, style: {} })
    container.clientWidth = 190
    container.clientHeight = 412
    expect(resizePreviewCanvas(canvas, 2)).toEqual({ width: 190, height: 412, dpr: 2 })
    expect(canvas).toMatchObject({ width: 380, height: 824, style: {} })
    container.clientWidth = 480
    container.clientHeight = 270
    resizePreviewCanvas(canvas, 3)
    expect(canvas).toMatchObject({ width: 960, height: 540, style: {} })
  })

  it('隐藏容器不分配错误尺寸，恢复显示后才更新', async () => {
    const { resizePreviewCanvas } = await import('../src/utils/wallpaper/previewCanvas.js')
    const canvas = { parentElement: { clientWidth: 0, clientHeight: 0 }, width: 300, height: 150, style: {} }
    expect(resizePreviewCanvas(canvas, 1)).toBeNull()
    expect(canvas.width).toBe(300)
  })
})
