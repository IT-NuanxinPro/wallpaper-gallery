import { describe, expect, it } from 'vitest'
import { buildHotTagQuery } from '../src/utils/filter/hotTagQuery'
import { validateBrowseQuery } from '../src/composables/home/useBrowseState'

describe('共享热门标签导航', () => {
  const categories = [{ value: 'landscape', label: '风景', subcategories: [{ name: '山川' }] }]

  it('分类与子分类进入同一筛选，清除残留的搜索、格式和图片定位', () => {
    expect(buildHotTagQuery({ tag: '风景' }, 'desktop', categories)).toMatchObject({ category: 'landscape', q: '', exact: '', image: '', format: 'all', resolution: 'all' })
    expect(buildHotTagQuery({ tag: '山川' }, 'desktop', categories)).toMatchObject({ category: 'landscape', subcategory: '山川', q: '' })
  })

  it('Bing 历史单图使用完整身份，离开专题后不会被当前月份排除', () => {
    const query = buildHotTagQuery({ tag: '林间迷雾', topWallpapers: ['bing-2024-10-01.jpg'] }, 'bing')
    expect(validateBrowseQuery(query, { series: 'bing' })).toMatchObject({ q: '林间迷雾', exact: 'bing:bing-2024-10-01.jpg', category: 'all' })
  })

  it('Bing 月份和普通关键词分别保留月份与跨月份搜索语义', () => {
    expect(buildHotTagQuery({ tag: '2024 10' }, 'bing')).toMatchObject({ category: '2024-10', q: '' })
    expect(buildHotTagQuery({ tag: '山川', topWallpapers: ['bing-2024-10-01.jpg', 'bing-2023-10-01.jpg'] }, 'bing')).toMatchObject({ category: 'all', exact: '', q: '山川' })
    expect(buildHotTagQuery({ tag: '星空' }, 'desktop', categories)).toMatchObject({ q: '星空', category: 'all', subcategory: 'all' })
  })
})
