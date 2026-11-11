import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getBrowseReturn, isBrowseReturnPath, rememberBrowseReturn } from '../src/utils/wallpaper/browseReturn.js'

let stored
beforeEach(() => {
  stored = ''
  vi.stubGlobal('sessionStorage', { getItem: () => stored, setItem: (_key, value) => { stored = value } })
})
afterEach(() => vi.unstubAllGlobals())

it.each([
  '/', '/?q=星空', '/desktop?q=%E6%98%9F%E7%A9%BA&category=风景', '/mobile', '/avatar#gallery',
  '/video?use=mobile', '/bing?category=2024-02', '/library?tab=collections', '/account?tab=likes', '/account',
])('原样记住合法站内列表及筛选参数 %s', (path) => {
  expect(isBrowseReturnPath(path)).toBe(true)
  rememberBrowseReturn(path)
  expect(getBrowseReturn()).toBe(path)
})

it.each([
  undefined, null, {}, '', '//example.com/desktop', 'https://example.com/desktop', '/wallpaper/token',
  '/desktop/unknown', '/collections/quiet-night/unknown', '/collections/not-a-collection',
  '/desktop\\evil', '/desktop?q=a\nb', '/desktop?q=%0ab', '/desktop?q=%5cb', '/desktop?q=//evil',
  '/desktop?q=%2f%2fevil', '/desktop?q=%zz', `/desktop?q=${'a'.repeat(4096)}`,
])('拒绝外站、详情、未知路由与非规范路径 %j', (path) => {
  expect(isBrowseReturnPath(path)).toBe(false)
  rememberBrowseReturn('/desktop?q=原筛选')
  rememberBrowseReturn(path)
  expect(getBrowseReturn()).toBe('/desktop?q=原筛选')
})

it('读取时重新校验存储，损坏或被改写的路径不会进入路由', () => {
  stored = '//example.com'
  expect(getBrowseReturn()).toBe('')
})

it('存储权限拒绝及存储缺失时安全退回默认列表', () => {
  vi.stubGlobal('sessionStorage', { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } })
  expect(() => rememberBrowseReturn('/desktop?q=山')).not.toThrow()
  expect(getBrowseReturn()).toBe('')
  vi.stubGlobal('sessionStorage', undefined)
  expect(() => rememberBrowseReturn('/desktop')).not.toThrow()
  expect(getBrowseReturn()).toBe('')
})
