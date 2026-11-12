import { expect, it } from 'vitest'
import { preservesAccountScroll } from '../src/router/accountRoutes.js'

it('同一账号页面切换标签保留滚动，不影响进入其他用户或页面', () => {
  for (const [name, path] of [['Account', '/account'], ['Library', '/library'], ['PublicProfile', '/people/one']]) {
    expect(preservesAccountScroll({ name, path, query: { tab: 'likes' } }, { name, path, query: { tab: 'collections' } })).toBe(true)
  }
  expect(preservesAccountScroll({ name: 'PublicProfile', path: '/people/two' }, { name: 'PublicProfile', path: '/people/one' })).toBe(false)
  expect(preservesAccountScroll({ name: 'WallpaperDetail', path: '/wallpaper/one' }, { name: 'Account', path: '/account' })).toBe(false)
})
