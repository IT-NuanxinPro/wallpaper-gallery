import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { buildDetailPresentation } from '../server/wallpaper-detail-markup.js'
import { buildWallpaperDetailRecord } from '../src/utils/wallpaper/detailRecords.js'
import WallpaperDetail from '../src/views/WallpaperDetail.vue'
import WallpaperDetailStats from '../src/components/wallpaper/WallpaperDetailStats.vue'

const state = vi.hoisted(() => ({ record: null, embedded: null }))
vi.mock('../src/services/wallpaperDetailService.js', () => ({
  createWallpaperDetailLoader: ({ onState }) => ({ load: () => onState({ loading: false, record: state.record, error: null }), cancel() {} }),
  loadWallpaperCatalog: () => Promise.resolve([]),
  readInitialWallpaperDetail: () => state.embedded,
}))
vi.mock('../src/utils/seo/wallpaperDetail.js', () => ({ applyWallpaperDetailSeo() {} }))
vi.mock('../src/composables/useInteraction.js', () => ({ useInteraction: () => ({ liked: false, collected: false, isAuthenticated: false, toggleLike() {}, toggleCollect() {} }) }))
vi.mock('../src/composables/useInteractionPrefetch.js', () => ({ useInteractionPrefetch() {} }))
vi.mock('../src/composables/useWallpaperDownload.js', () => ({ useWallpaperDownload: () => ({ downloading: false, handleDownload() {}, cancelDownload() {} }) }))
vi.mock('../src/components/wallpaper/desktop/WallpaperDesktopActions.vue', () => ({ default: { render: () => null } }))
vi.mock('../src/components/community/RelatedCollections.vue', () => ({ default: { render: () => null } }))

beforeEach(() => {
  state.embedded = null
  state.record = {
    assetKey: 'desktop:path:/wallpaper/desktop/lake.jpg', _series: 'desktop', series: 'desktop',
    sharePath: '/wallpaper/ZGVza3RvcDpwYXRoOi93YWxscGFwZXIvZGVza3RvcC9sYWtlLmpwZw',
    title: 'IMG_001.jpg', filename: 'IMG_001.jpg', displayTitle: '湖面与星空.jpg',
    category: '风景', subcategory: '星空', description: '夜晚的星空映在湖面上。',
    thumbnailUrl: '/images/v1.0.0/thumbnail/desktop/lake.webp', previewUrl: '/images/v1.0.0/preview/desktop/lake.webp',
    url: 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.0.0/wallpaper/desktop/lake.jpg',
    resolution: { width: 3840, height: 2160 }, size: 2097152, format: 'JPG', tags: ['星空'], mediaType: 'image',
  }
})

async function renderDetail() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: WallpaperDetail }] })
  await router.push(state.record.sharePath)
  const app = createSSRApp({ render: () => h(WallpaperDetail) })
  app.use(router)
  return renderToString(app)
}

it('详情输出清理后的可读标题、真实描述、面包屑与原文件信息', async () => {
  const html = await renderDetail()
  expect(html).toMatch(/<h1[^>]*>湖面与星空<\/h1>/)
  expect(html).toContain('夜晚的星空映在湖面上。')
  expect(html).toContain('aria-label="面包屑"')
  expect(html).toContain('3840 × 2160')
  expect(html).toContain('2 MB')
  expect(html).toContain('JPG')
})

it('实际未提供作者与授权时，不生成虚构署名或授权声明', async () => {
  const html = await renderDetail()
  expect(html).not.toContain('来源未提供授权信息')
  expect(html).not.toContain('<dt>作者</dt>')
  expect(html).not.toContain('<dt>授权</dt>')
})

it('Bing原始urlbase生成4K下载信息，SSR和客户端用1080p预览比例且不落到默认黑边', async () => {
  state.record = buildWallpaperDetailRecord({
    _series: 'bing', filename: 'bing-2026-11-10.jpg', date: '2026-11-10',
    title: '惬意放松，尽享海岛时光', urlbase: '/th?id=OHR.RoseIsland_ZH-CN6477140814',
  }, 'v1.5.2')
  expect(state.record.resolution).toMatchObject({ width: 3840, height: 2160 })
  expect(state.record.previewResolution).toEqual({ width: 1920, height: 1080 })
  expect(state.record.previewUrl.endsWith('_1920x1080.jpg')).toBe(true)
  expect(state.record.downloadUrl.endsWith('_UHD.jpg')).toBe(true)
  for (const html of [await renderDetail(), buildDetailPresentation(state.record)]) {
    expect(html).toContain('3840 × 2160')
    expect(html).not.toContain('尺寸信息未提供')
    expect(html).toMatch(/aspect-ratio:\s*1920\s*\/\s*1080/)
    expect(html).not.toContain('<video')
  }
})

it('Bing已有原图尺寸优先于UHD默认值，预览尺寸独立', () => {
  const record = buildWallpaperDetailRecord({
    _series: 'bing', filename: 'bing-2026-11-10.jpg', urlbase: '/th?id=OHR.RoseIsland_ZH-CN6477140814',
    resolution: { width: 4096, height: 2304 },
  })
  expect(record.resolution).toMatchObject({ width: 4096, height: 2304 })
  expect(record.previewResolution).toEqual({ width: 1920, height: 1080 })
})

it('详情SSR和CSR预留四项独立统计行，未读取数值时不伪造0', async () => {
  for (const html of [await renderDetail(), buildDetailPresentation(state.record)]) {
    const stats = html.match(/<dl class="detail-stats"[\s\S]*?<\/dl>/)?.[0]
    expect(stats).toBeTruthy()
    for (const label of ['浏览', '喜欢', '收藏', '下载'])
      expect(stats).toContain(label)
    expect(stats.match(/<dd>—<\/dd>/g)).toHaveLength(4)
  }
  const html = await renderToString(createSSRApp({ render: () => h(WallpaperDetailStats, { stats: { views: 14, likes: 0, collects: 2, downloads: 3 } }) }))
  expect(html).toContain('<dd>0</dd>')
  expect(html).toContain('<dd>14</dd>')
})

it('动态详情与预览一样静音循环播放，不输出原生控制条', async () => {
  Object.assign(state.record, {
    _series: 'video', series: 'video', mediaType: 'video', filename: 'lake.mp4', format: 'MP4',
    url: 'https://img.061129.xyz/wallpaper/video/desktop/lake.mp4',
    previewUrl: 'https://img.061129.xyz/preview/video/desktop/lake.mp4',
    thumbnailUrl: 'https://img.061129.xyz/thumbnail/video/desktop/lake.png',
  })
  const html = await renderDetail()
  const video = html.match(/<video\b[^>]*>/)?.[0]
  expect(video).toBeTruthy()
  expect(video).not.toMatch(/\scontrols(?:[\s=>])/)
  expect(video).toMatch(/\sautoplay(?:[\s=>])/)
  expect(video).toMatch(/\smuted(?:[\s=>])/)
  expect(video).toMatch(/\sloop(?:[\s=>])/)
  expect(video).toMatch(/\splaysinline(?:[\s=>])/)
  const mediaClass = html.match(/<section class="([^"]+)" aria-label=/)?.[1].split(' ')
  expect(mediaClass).toEqual(expect.arrayContaining(['detail-media', 'is-video']))
  expect(html).toContain('正在加载视频')
  expect(html).toContain('aria-busy="true"')
})

it('手机详情在客户端与无脚本首屏都使用真机框，原始尺寸仍真实显示', async () => {
  Object.assign(state.record, { _series: 'mobile', series: 'mobile', resolution: { width: 1440, height: 2560 } })
  for (const html of [await renderDetail(), buildDetailPresentation(state.record)]) {
    expect(html).toContain('preview-frame--phone')
    expect(html).toContain('preview-frame__island')
    expect(html).toContain('preview-frame__home')
    expect(html).toContain('is-phone')
    expect(html).toContain('1440 × 2560')
    expect(html).not.toContain('phone-frame__wallpaper-time')
    expect(html).not.toContain('size-selector__floating-ball')
  }
})

it('服务端动态海报保留可抓取图片，同时提供统一加载状态和无脚本说明', () => {
  const html = buildDetailPresentation({ ...state.record, mediaType: 'video' })
  expect(html).toContain('视频海报')
  expect(html).toContain('soft-loading')
  expect(html).toContain('正在加载视频')
  expect(html).toMatch(/<noscript>[\s\S]*JavaScript[\s\S]*<\/noscript>/)
})

it.each(['MP4', 'mkv', 'AVIF', 'heic', '3gp', 'custom123'])('无脚本推荐保留去掉 %s 后缀的替代文本，不显示图片下方标题', (extension) => {
  const recommendation = buildWallpaperDetailRecord({
    _series: 'desktop', path: `/wallpaper/desktop/other.${extension}`, filename: `山间__晨光.${extension}`,
  }, 'v1.0.0')
  const html = buildDetailPresentation(state.record, [recommendation])
  expect(html).not.toContain('<span>山间 晨光</span>')
  expect(html).toContain('alt="山间 晨光"')
})

it('客户端继续发现只显示图片，保留清理后的替代文本', async () => {
  const related = buildWallpaperDetailRecord({
    _series: 'desktop', path: '/wallpaper/desktop/related.avif', filename: '山间__晨光.avif',
  }, 'v1.0.0')
  state.embedded = { record: state.record, related: [related] }
  const html = await renderDetail()
  expect(html).not.toContain('<span>山间 晨光</span>')
  expect(html).toContain('alt="山间 晨光"')
})

it('头像详情使用方形舞台，保留真实原文件尺寸和下载地址', async () => {
  Object.assign(state.record, {
    _series: 'avatar', series: 'avatar', resolution: { width: 900, height: 1200 },
    downloadUrl: 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.0.0/wallpaper/avatar/lake.jpg',
  })
  const source = structuredClone(state.record)
  for (const html of [await renderDetail(), buildDetailPresentation(state.record)]) {
    expect(html).toContain('is-avatar')
    expect(html).toContain('aspect-ratio:1 / 1')
    expect(html).toContain('900 × 1200')
  }
  expect(buildDetailPresentation(state.record)).toContain(`href="${state.record.downloadUrl}"`)
  expect(state.record).toEqual(source)
})

it.each([
  ['desktop', '', '16 / 10', 'avif'],
  ['mobile', '', '9 / 16', 'heic'],
  ['avatar', '', '1 / 1', 'png'],
  ['bing', '', '16 / 9', 'jpg'],
  ['video', 'desktop', '16 / 9', 'mp4'],
  ['video', 'mobile', '9 / 16', 'webm'],
  ['video', 'social-cover', '9 / 16', 'mov'],
])('继续发现按 %s / %s 自身系列使用外卡比例，只显示图片', async (series, usage, ratio, extension) => {
  const related = buildWallpaperDetailRecord({
    _series: series, usage, isBing: series === 'bing', date: series === 'bing' ? '2026-11-11' : undefined,
    urlbase: '/th?id=OHR.Lake', path: series === 'bing' ? '' : `/wallpaper/${series}/related.${extension}`,
    filename: series === 'bing' ? 'bing-2026-11-11.jpg' : `山间__晨光.${extension}`, displayTitle: `山间__晨光.${extension}`,
  }, 'v1.0.0')
  Object.assign(state.record, { _series: series, series })
  state.embedded = { record: state.record, related: [related] }
  for (const html of [await renderDetail(), buildDetailPresentation(state.record, [related])]) {
    const recommendation = html.match(/<img[^>]*alt="山间 晨光"[^>]*>/)?.[0]
    expect(recommendation).toContain(`aspect-ratio:${ratio}`)
    expect(html).not.toContain('<span>山间 晨光</span>')
  }
})

it.each(['mobile', 'social-cover'])('视频推荐目录没有 usage 时按 category=%s 保持竖向卡片', async (category) => {
  const record = buildWallpaperDetailRecord({
    _series: 'video', category, path: `/wallpaper/video/${category}/sample.mp4`, filename: '竖向视频.mp4',
    resolution: { width: 720, height: 1280 },
  }, 'v1.0.0')
  // 与 index-video.json 相同的目录字段，目录不携带 usage / _series / filename。
  const { assetKey, series, title, subcategory, tags, thumbnailUrl, previewUrl, resolution, mediaType, sharePath, size } = record
  const related = { assetKey, series, title, category, subcategory, tags, thumbnailUrl, previewUrl, resolution, mediaType, sharePath, size }
  Object.assign(state.record, { _series: 'video', series: 'video', resolution: null })
  state.embedded = { record: state.record, related: [related] }
  for (const html of [await renderDetail(), buildDetailPresentation(state.record, [related])]) {
    expect(html.match(/<img[^>]*alt="竖向视频"[^>]*>/)?.[0]).toContain('aspect-ratio:9 / 16')
  }
})
