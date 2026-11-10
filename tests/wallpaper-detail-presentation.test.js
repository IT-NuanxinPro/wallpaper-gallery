import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, expect, it, vi } from 'vitest'
import WallpaperDetail from '../src/views/WallpaperDetail.vue'

const state = vi.hoisted(() => ({ record: null }))
vi.mock('../src/services/wallpaperDetailService.js', () => ({
  createWallpaperDetailLoader: ({ onState }) => ({ load: () => onState({ loading: false, record: state.record, error: null }), cancel() {} }),
  loadWallpaperCatalog: () => Promise.resolve([]),
  readInitialWallpaperDetail: () => null,
}))
vi.mock('../src/utils/seo/wallpaperDetail.js', () => ({ applyWallpaperDetailSeo() {} }))
vi.mock('../src/composables/useInteraction.js', () => ({ useInteraction: () => ({ liked: false, collected: false, isAuthenticated: false, toggleLike() {}, toggleCollect() {} }) }))
vi.mock('../src/composables/useInteractionPrefetch.js', () => ({ useInteractionPrefetch() {} }))
vi.mock('../src/composables/useWallpaperDownload.js', () => ({ useWallpaperDownload: () => ({ downloading: false, handleDownload() {}, cancelDownload() {} }) }))
vi.mock('../src/components/wallpaper/desktop/WallpaperDesktopActions.vue', () => ({ default: { render: () => null } }))

beforeEach(() => {
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
})
