import { expect, it } from 'vitest'
import { resolveLegacyPreviewRoute } from '../src/router/legacyPreviewRoute.js'

const assetKey = 'desktop:path:/wallpaper/desktop/lake.jpg'
const token = 'ZGVza3RvcDpwYXRoOi93YWxscGFwZXIvZGVza3RvcC9sYWtlLmpwZw'
const base = { name: 'Desktop', path: '/desktop', query: {}, meta: { series: 'desktop' }, hash: '' }

it.each([assetKey, token])('退役预览参数 %s 转为真实详情且保留干净的列表返回地址', (image) => {
  expect(resolveLegacyPreviewRoute({ ...base, query: { image, q: '山', sort: 'views' } })).toEqual({
    location: { path: `/wallpaper/${token}`, replace: true },
    returnTo: { path: '/desktop', query: { q: '山', sort: 'views' }, hash: '' },
  })
})

it.each(['invalid!', '//other.example', ['a', 'b'], 'mobile:path:/wallpaper/mobile/lake.jpg', ''])('非法或跨系列参数 %j 只移除image，不影响筛选', (image) => {
  expect(resolveLegacyPreviewRoute({ ...base, query: { image, q: '山' } })).toEqual({
    location: { path: '/desktop', query: { q: '山' }, hash: '', replace: true },
    returnTo: null,
  })
})

it('不处理普通分类或其他页面，不能把未知路径转成详情', () => {
  expect(resolveLegacyPreviewRoute(base)).toBeNull()
  expect(resolveLegacyPreviewRoute({ ...base, name: 'PublicProfile', query: { image: token } })).toBeNull()
})
