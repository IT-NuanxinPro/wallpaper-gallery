import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { WALLPAPER_COLLECTIONS } from '../src/content/collections.js'
import { loadCollectionWallpapers } from '../src/services/collectionsService.js'
import { getCollectionRelatedWallpapers, resolveWallpaperCollection } from '../src/utils/wallpaper/collections.js'
import { buildWallpaperSharePath } from '../src/utils/wallpaper/share.js'

const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/details/index.json', import.meta.url))).items
const fixture = WALLPAPER_COLLECTIONS[0]

describe('人工精选专题', () => {
  it('三个专题身份都存在、无重复，五组电脑/手机搭配引用真实不同系列', () => {
    expect(new Set(WALLPAPER_COLLECTIONS.map(item => item.slug)).size).toBe(3)
    const index = new Map(catalog.map(item => [item.assetKey, item]))
    let pairs = 0
    for (const collection of WALLPAPER_COLLECTIONS) {
      expect(new Set(collection.items).size).toBe(collection.items.length)
      expect(collection.items).toContain(collection.coverKey)
      for (const key of collection.items)
        expect(index.has(key), key).toBe(true)
      for (const pair of collection.pairs) {
        pairs++
        expect(collection.items).toContain(pair.desktopKey)
        expect(collection.items).toContain(pair.mobileKey)
        expect(index.get(pair.desktopKey).series).toBe('desktop')
        expect(index.get(pair.mobileKey).series).toBe('mobile')
      }
    }
    expect(pairs).toBe(5)
  })

  it('缺失与重复资源被跳过，搭配缺任一方不得冒充有效配对，封面可回退', () => {
    const available = catalog.filter(item => item.assetKey !== fixture.coverKey && item.assetKey !== fixture.pairs[0].mobileKey)
    const resolved = resolveWallpaperCollection({ ...fixture, items: [...fixture.items, fixture.items[1], 'desktop:path:/wallpaper/desktop/deleted.jpg'] }, available)
    expect(resolved.items.some(item => item.assetKey === fixture.coverKey)).toBe(false)
    expect(new Set(resolved.items.map(item => item.assetKey)).size).toBe(resolved.items.length)
    expect(resolved.pairs).toHaveLength(1)
    expect(resolved.missingKeys).toContain(fixture.coverKey)
    expect(resolved.cover).toBe(resolved.items[0])
    expect(resolveWallpaperCollection(fixture, []).items).toEqual([])
  })



  it('一次请求精选小清单；缺失/损坏/临时故障和取消分别处理', async () => {
    const manifest = JSON.parse(fs.readFileSync(new URL('../public/data/collections.json', import.meta.url)))
    const missing = fixture.items[0]
    const broken = fixture.items[1]
    const items = { ...manifest.items }
    delete items[missing]
    items[broken] = { ...items[broken], assetKey: 'wrong' }
    const calls = []
    const result = await loadCollectionWallpapers({ fetchImpl: async url => { calls.push(url); return Response.json({ schema: 1, items }) } })
    expect(calls).toEqual(['/data/collections.json'])
    expect(result.missingKeys).toEqual([missing])
    expect(result.failedKeys).toEqual([broken])
    expect(result.records).toHaveLength(15)
    for (const status of [404, 503]) {
      const failed = await loadCollectionWallpapers({ fetchImpl: async () => new Response(null, { status }) })
      expect(failed.missingKeys).toEqual([])
      expect(failed.failedKeys).toHaveLength(17)
    }
    const controller = new AbortController()
    await expect(loadCollectionWallpapers({ signal: controller.signal, fetchImpl: async () => { controller.abort(); return Response.json(manifest) } })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
