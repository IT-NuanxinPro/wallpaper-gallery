import { effectScope, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useImageFallback } from '../src/composables/useImageFallback.js'

const PREVIEW = '/images/v1.2.63/preview/desktop/sample.webp'
const CDN_PREVIEW = 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.63/preview/desktop/sample.webp'
const RAW_PREVIEW = 'https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v1.2.63/preview/desktop/sample.webp'
const ORIGINAL = 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.2.63/wallpaper/desktop/sample.png'
const RAW_ORIGINAL = 'https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v1.2.63/wallpaper/desktop/sample.png'

let scope
beforeEach(() => {
  vi.stubEnv('VITE_IMAGE_BASE_URL', '')
  vi.stubEnv('VITE_IMAGE_PROXY_ENABLED', '')
  scope = effectScope()
})
afterEach(() => {
  scope.stop()
  vi.unstubAllEnvs()
})

describe('详情图片失败回退', () => {
  it('入口失败先试同尺寸 jsDelivr，再试 Raw，耗尽时停止重试', () => {
    const image = scope.run(() => useImageFallback(ref(PREVIEW)))
    expect(image.displayUrl.value).toBe(PREVIEW)
    expect(image.advance()).toBe(true)
    expect(image.displayUrl.value).toBe(CDN_PREVIEW)
    expect(image.advance()).toBe(true)
    expect(image.displayUrl.value).toBe(RAW_PREVIEW)
    expect(image.advance()).toBe(false)
    expect(image.displayUrl.value).toBe(RAW_PREVIEW)
  })

  it('查看原图和返回预览均从该尺寸的首个来源重新开始', () => {
    const source = ref(PREVIEW)
    const image = scope.run(() => useImageFallback(source))
    image.advance()
    image.advance()

    source.value = ORIGINAL
    expect(image.displayUrl.value).toBe(ORIGINAL)
    expect(image.advance()).toBe(true)
    expect(image.displayUrl.value).toBe(RAW_ORIGINAL)
    expect(image.advance()).toBe(false)

    source.value = PREVIEW
    expect(image.displayUrl.value).toBe(PREVIEW)
  })

  it('下一张壁纸切换后不沿用上一张已失败的来源序号', () => {
    const source = ref(PREVIEW)
    const image = scope.run(() => useImageFallback(source))
    image.advance()
    image.advance()
    source.value = '/images/v1.2.63/preview/desktop/next.webp'
    expect(image.displayUrl.value).toBe('/images/v1.2.63/preview/desktop/next.webp')
  })

  it('旧的外部图片与空地址没有重复候选，reset允许显式重新尝试入口', () => {
    const source = ref('https://cn.bing.com/th?id=OHR.Sample_1920x1080.jpg')
    const image = scope.run(() => useImageFallback(source))
    expect(image.advance()).toBe(false)
    expect(image.displayUrl.value).toBe(source.value)
    source.value = ''
    expect(image.displayUrl.value).toBe('')
    expect(image.advance()).toBe(false)
    source.value = PREVIEW
    image.advance()
    image.reset()
    expect(image.displayUrl.value).toBe(PREVIEW)
  })
})
