import { expect, it } from 'vitest'
import { advanceRelatedImageFallback } from '../src/utils/wallpaper/relatedImageFallback.js'

const thumbnail = '/images/v1.0.0/thumbnail/mobile/lake.webp'
const cdn = 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.0.0/thumbnail/mobile/lake.webp'
const raw = 'https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/v1.0.0/thumbnail/mobile/lake.webp'

function imageElement(src) {
  return {
    src,
    currentSrc: new URL(src, 'https://wallpaper.061129.xyz').href,
    ownerDocument: { baseURI: 'https://wallpaper.061129.xyz/desktop' },
    getAttribute() { return this.src },
    setAttribute(name, value) { this[name] = value },
  }
}

it('推荐缩略图失败只推进同尺寸候选，耗尽后不重新发起请求', () => {
  const image = imageElement(thumbnail)
  expect(advanceRelatedImageFallback({ target: image }, thumbnail)).toBe(true)
  expect(image.src).toBe(cdn)
  image.currentSrc = cdn
  expect(advanceRelatedImageFallback({ target: image }, thumbnail)).toBe(true)
  expect(image.src).toBe(raw)
  image.currentSrc = raw
  for (let count = 0; count < 3; count++) {
    expect(advanceRelatedImageFallback({ target: image }, thumbnail)).toBe(false)
    expect(image.src).toBe(raw)
  }
  expect(image.src).not.toContain('/wallpaper/mobile/')
})

it('迟到的旧源错误及新资源错误不能跳过当前候选', () => {
  const image = imageElement(thumbnail)
  expect(advanceRelatedImageFallback({ target: image }, thumbnail)).toBe(true)
  expect(advanceRelatedImageFallback({ target: image }, thumbnail)).toBe(false)
  expect(image.src).toBe(cdn)
  image.currentSrc = cdn
  expect(advanceRelatedImageFallback({ target: image }, '/images/v1.0.0/thumbnail/mobile/new.webp')).toBe(false)
  expect(image.src).toBe(cdn)
})

it('未加载出currentSrc仍按当前src重试；未知来源不替换为原图', () => {
  const image = imageElement(thumbnail)
  image.currentSrc = ''
  expect(advanceRelatedImageFallback({ target: image }, thumbnail)).toBe(true)
  expect(image.src).toBe(cdn)
  const remote = imageElement('https://img.061129.xyz/thumbnail/video/sample.png')
  expect(advanceRelatedImageFallback({ target: remote }, remote.src)).toBe(false)
  expect(remote.src).toBe('https://img.061129.xyz/thumbnail/video/sample.png')
})
