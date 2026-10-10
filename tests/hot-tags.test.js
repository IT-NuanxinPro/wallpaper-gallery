import { describe, expect, it } from 'vitest'
import { buildHotTags } from '../scripts/export-hot-tags.js'

const now = new Date('2026-10-10T04:00:00Z')

function wallpaper(filename, ageDays, keyword, extra = {}) {
  return {
    filename,
    path: `/wallpaper/desktop/${filename}`,
    createdAt: new Date(now.getTime() - ageDays * 86400000).toISOString(),
    keywords: [keyword],
    ...extra,
  }
}

describe('近期热门标签', () => {
  it('新图没有统计或不在历史 Top 500 内，也能贡献关键词和分类', () => {
    const tags = buildHotTags([
      wallpaper('new.jpg', 0, '极光', { category: '风景', subcategory: '星空' }),
    ], [], 'desktop', now)
    expect(tags.map(t => t.tag).sort()).toEqual(['星空', '极光', '风景'].sort())
    expect(tags.every(t => t.score > 0 && t.wallpaperCount === 1)).toBe(true)
  })

  it('90 天外的旧图再热门也不进入推荐，未知或未来日期也不进入', () => {
    const rows = [
      wallpaper('boundary.jpg', 90, '边界内容'),
      wallpaper('old.jpg', 90.001, '历史内容'),
      wallpaper('future.jpg', -1, '未来内容'),
      wallpaper('invalid.jpg', 0, '错误内容', { createdAt: 'bad-date' }),
      wallpaper('missing.jpg', 0, '缺失内容', { createdAt: null }),
    ]
    const stats = [{ image_id: 'old.jpg', views: 1000000, downloads: 1000000 }]
    expect(buildHotTags(rows, stats, 'desktop', now).map(t => t.tag)).toEqual(['边界内容'])
  })

  it('两个月前的高累计热度不能压过没有互动的新图', () => {
    const rows = [wallpaper('new.jpg', 0, '新内容'), wallpaper('old.jpg', 60, '老内容')]
    const stats = [{ image_id: 'old.jpg', views: 10000000, downloads: 10000000 }]
    const tags = buildHotTags(rows, stats, 'desktop', now)
    expect(tags.map(t => t.tag)).toEqual(['新内容', '老内容'])
    expect(tags[0].score).toBeGreaterThan(tags[1].score)
  })

  it('同日的新图仍按互动加分区分，时间权重每 30 天减半', () => {
    const rows = [wallpaper('quiet.jpg', 0, '普通'), wallpaper('hot.jpg', 0, '热图')]
    const stats = [{ image_id: 'hot.jpg', views: 10, downloads: 2 }]
    expect(buildHotTags(rows, stats, 'desktop', now).map(t => t.tag)).toEqual(['热图', '普通'])
    const later = new Date(now.getTime() + 30 * 86400000)
    const [tag] = buildHotTags([rows[0]], [], 'desktop', now)
    const [agedTag] = buildHotTags([rows[0]], [], 'desktop', later)
    expect(agedTag.score).toBeCloseTo(tag.score / 2)
  })

  it('预览图只取窗口内内容，重复元数据不重复计数', () => {
    const current = wallpaper('new.jpg', 1, '星空', { tags: ['星空'], subcategory: '星空' })
    const tags = buildHotTags([current, current, wallpaper('old.jpg', 200, '星空')], [], 'desktop', now)
    expect(tags).toHaveLength(1)
    expect(tags[0].wallpaperCount).toBe(1)
    expect(tags[0].topWallpapers.map(w => w.filename)).toEqual(['new.jpg'])
  })

  it('同名不同路径的图片不复用无法拆分的累计统计', () => {
    const rows = [
      wallpaper('same.jpg', 1, '海洋'),
      wallpaper('same.jpg', 1, '雪山', { path: '/other/same.jpg' }),
    ]
    const tags = buildHotTags(rows, [{ image_id: 'same.jpg', views: 500 }], 'desktop', now)
    expect(tags).toHaveLength(2)
    expect(tags.every(t => t.views === 0 && t.score < 1)).toBe(true)
  })

  it('没有近期内容时不回退到历史榜，累计孤立记录不能生成标签', () => {
    expect(buildHotTags([wallpaper('old.jpg', 180, '旧图')], [
      { image_id: 'old.jpg', views: 9999 },
      { image_id: 'missing.jpg', views: 99999 },
    ], 'desktop', now)).toEqual([])
  })

  it('必应日期不能被标点规范化成伪热门关键词', () => {
    expect(buildHotTags([
      wallpaper('bing-2026-10-10.jpg', 0, '森林', { category: '2026-10', tags: ['2026-10', '森林'] }),
    ], [], 'bing', now).map(t => t.tag)).toEqual(['森林'])
  })
})
