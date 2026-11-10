import { createPinia, setActivePinia } from 'pinia'
import { computed, createRenderer, h, nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { createMemoryHistory, createRouter, onBeforeRouteLeave, RouterView, useRoute } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBrowseState, validateBrowseQuery } from '../src/composables/home/useBrowseState'
import { handleBrowseRouteLeave } from '../src/composables/home/browseRouteGuard'
import { useWallpaperNavigator } from '../src/composables/home/useWallpaperNavigator'
import { useGridPagination } from '../src/components/wallpaper/WallpaperGrid/composables/useGridPagination'
import { useFilterStore } from '../src/stores/filter'
import { buildWallpaperAssetKey } from '../src/utils/wallpaper/identity'
import { encodeWallpaperShareToken } from '../src/utils/wallpaper/share'

vi.mock('@/composables/useModal', () => ({
  useModal() {
    const isOpen = ref(false)
    const currentData = ref(null)
    return { isOpen, currentData, open: item => { currentData.value = item; isOpen.value = true }, close: () => { isOpen.value = false }, updateData: item => { currentData.value = item } }
  },
}))

const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode() {}, nextSibling() {},
})
const cleanups = []
function mount(setup) {
  let result
  const app = renderer.createApp({ setup() { result = setup(); return () => null } })
  app.mount({})
  cleanups.push(() => app.unmount())
  return result
}
async function flush() {
  for (let i = 0; i < 8; i++) await nextTick()
  await vi.runAllTimersAsync()
  for (let i = 0; i < 8; i++) await nextTick()
}
function item(folder, filename = 'same.jpg') {
  return { id: filename, filename, path: `/wallpaper/desktop/${folder}/${filename}`, previewUrl: `/preview/desktop/${folder}/${filename}`, url: `/wallpaper/desktop/${folder}/${filename}` }
}
let requests
beforeEach(() => {
  vi.useFakeTimers()
  requests = []
  vi.stubGlobal('Image', class { set src(value) { this.url = value; if (value) requests.push(this) } get src() { return this.url } })
  vi.stubGlobal('window', { scrollY: 0, scrollTo: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })
  const storage = new Map()
  vi.stubGlobal('sessionStorage', { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) })
  vi.stubGlobal('requestAnimationFrame', callback => setTimeout(callback, 0))
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
})
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('当前结果内导航', () => {
  it('按筛选排序结果导航，区分同名资源并停在边界', async () => {
    const a = item('a'), b = item('b'), c = item('c')
    const results = ref([c, a, b])
    const nav = mount(() => useWallpaperNavigator(() => results.value))
    nav.handleSelectWallpaper(a)
    nav.handleNextWallpaper()
    expect(buildWallpaperAssetKey(nav.currentWallpaper.value)).toBe(buildWallpaperAssetKey(b))
    nav.handleNextWallpaper()
    expect(buildWallpaperAssetKey(nav.currentWallpaper.value)).toBe(buildWallpaperAssetKey(b))
    nav.handlePrevWallpaper()
    nav.handlePrevWallpaper()
    expect(buildWallpaperAssetKey(nav.currentWallpaper.value)).toBe(buildWallpaperAssetKey(c))
    nav.handlePrevWallpaper()
    expect(buildWallpaperAssetKey(nav.currentWallpaper.value)).toBe(buildWallpaperAssetKey(c))
    await flush()
  })
  it('未完整加载时保留所选图且禁止误跳；完整筛选排除后关闭', async () => {
    const a = item('a'), b = item('b')
    const results = ref([a, b]), ready = ref(true)
    const nav = mount(() => useWallpaperNavigator(() => results.value, { resultsReady: () => ready.value }))
    nav.handleSelectWallpaper(a)
    ready.value = false
    results.value = [b]
    await flush()
    nav.handleNextWallpaper()
    expect(nav.isOpen.value).toBe(true)
    expect(buildWallpaperAssetKey(nav.currentWallpaper.value)).toBe(buildWallpaperAssetKey(a))
    ready.value = true
    await flush()
    expect(nav.isOpen.value).toBe(false)
  })
  it('最多预加载相邻两张预览，切换/关闭取消旧任务，缺预览不请求原图或视频', async () => {
    const a = item('a'), b = item('b'), c = item('c'), d = item('d')
    c.previewUrl = ''
    const nav = mount(() => useWallpaperNavigator(() => [a, b, c, d]))
    nav.handleSelectWallpaper(b)
    await flush()
    expect(requests.map(image => image.src)).toEqual([a.previewUrl])
    const old = requests[0]
    nav.handleSelectWallpaper(c)
    await flush()
    expect(old.src).toBe('')
    expect(requests.filter(image => image.src)).toHaveLength(2)
    expect(requests.filter(image => image.src).map(image => image.src)).toEqual([b.previewUrl, d.previewUrl])
    nav.close()
    await flush()
    expect(requests.filter(image => image.src)).toHaveLength(0)
  })
  it('preview 错配原图或视频时跳过，不使用 url/downloadUrl 兜底', async () => {
    const a = item('a'), b = item('b'), c = item('c')
    a.previewUrl = a.url
    c.mediaType = 'video'
    c.previewUrl = '/preview/video/clip.mp4'
    const nav = mount(() => useWallpaperNavigator(() => [a, b, c]))
    nav.handleSelectWallpaper(b)
    await flush()
    expect(requests).toHaveLength(0)
  })
})

describe('浏览参数校验与恢复', () => {
  it('同一Home实例跨系列后仍同步筛选和保存位置，离开到详情时才停止旧列表监听', async () => {
    const filters = reactive({
      searchQuery: '', debouncedQuery: '', exactSearchValue: '', sortBy: 'newest', categoryFilter: 'all',
      subcategoryFilter: 'all', formatFilter: 'all', resolutionFilter: 'all',
      clearExactSearch() { this.exactSearchValue = '' },
      setExactSearch(label, key) { this.searchQuery = label; this.exactSearchValue = key },
    })
    const results = ref([item('a')])
    let browse, setups = 0, unmounts = 0
    const Home = {
      setup() {
        setups++
        const route = useRoute()
        const currentSeries = computed(() => route.meta.series)
        const navigator = useWallpaperNavigator(results)
        browse = useBrowseState({
          route, router, filterStore: filters, currentSeries, results, resultsReady: ref(true),
          categories: ref([{ value: 'all' }]), categoriesReady: ref(true), gridReady: ref(true), navigator,
        })
        onBeforeRouteLeave(to => handleBrowseRouteLeave(to, browse))
        onBeforeUnmount(() => { unmounts++ })
        return () => null
      },
    }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/desktop', name: 'Desktop', meta: { series: 'desktop' }, component: Home },
        { path: '/mobile', name: 'Mobile', meta: { series: 'mobile' }, component: Home },
        { path: '/wallpaper/:token', name: 'WallpaperDetail', component: { render: () => null } },
      ],
    })
    await router.push('/desktop?q=desktop')
    const app = renderer.createApp({ render: () => h(RouterView) })
    app.use(router)
    app.mount({})
    cleanups.push(() => app.unmount())
    await flush()
    window.scrollY = 480
    browse.onDisplayCountChange(40)
    await router.push('/mobile?q=mobile')
    await flush()
    expect(setups).toBe(1)
    expect(unmounts).toBe(0)
    expect(filters.searchQuery).toBe('mobile')
    expect(JSON.parse(sessionStorage.getItem('wallpaper_browse_v1:/desktop:[["q","desktop"]]'))).toEqual({ count: 40, top: 480 })

    filters.searchQuery = '手机星空'
    filters.debouncedQuery = '手机星空'
    await flush()
    expect(router.currentRoute.value.path).toBe('/mobile')
    expect(router.currentRoute.value.query.q).toBe('手机星空')
    window.scrollY = 920
    browse.onDisplayCountChange(60)
    browse.savePosition()
    expect(JSON.parse(sessionStorage.getItem('wallpaper_browse_v1:/mobile:[["q","手机星空"]]'))).toEqual({ count: 60, top: 920 })

    router.beforeResolve(async (to) => {
      if (to.name !== 'WallpaperDetail')
        return
      // 模拟数据回调在离开守卫之后、组件卸载之前到达。
      expect(unmounts).toBe(0)
      filters.searchQuery = '迟到的筛选'
      filters.debouncedQuery = '迟到的筛选'
      results.value = [...results.value, item('late')]
      for (let i = 0; i < 8; i++) await nextTick()
    })
    await router.push('/wallpaper/detail-token')
    await flush()
    expect(router.currentRoute.value.fullPath).toBe('/wallpaper/detail-token')
    expect(unmounts).toBe(1)
    expect(JSON.parse(sessionStorage.getItem('wallpaper_browse_v1:/mobile:[["q","手机星空"]]'))).toEqual({ count: 60, top: 920 })
  })

  it('拒绝数组、非法枚举、非规范资源键、跨系列图与未知分类，保留 Bing 月份', () => {
    const state = validateBrowseQuery({ q: ['bad'], sort: 'evil', format: 'exe', resolution: '999K', category: 'unknown', color: 'fake', image: 'desktop:same.jpg' }, { series: 'desktop', categories: [{ value: '自然' }], categoriesReady: true })
    expect(state).not.toHaveProperty('color')
    expect(validateBrowseQuery({ ratio: 'landscape', style: 'minimal', use: 'desktop', device: '4k' }, { series: 'desktop' })).not.toHaveProperty('ratio')
    expect(state).toMatchObject({ q: '', sort: 'newest', format: 'all', resolution: 'all', category: 'all', image: '' })
    expect(validateBrowseQuery({ category: '2024-02', q: '山' }, { series: 'bing' })).toMatchObject({ category: '2024-02', q: '山' })
    expect(validateBrowseQuery({ category: '2024-99', image: buildWallpaperAssetKey(item('a')) }, { series: 'bing' })).toMatchObject({ image: '' })
    expect(validateBrowseQuery({ image: encodeWallpaperShareToken('bing:bing-2024-99-99.jpg') }, { series: 'bing' }).image).toBe('')
    expect(validateBrowseQuery({ image: encodeWallpaperShareToken(buildWallpaperAssetKey(item('a'))) }, { series: 'desktop' }).image).toBe(buildWallpaperAssetKey(item('a')))
    expect(validateBrowseQuery({ image: buildWallpaperAssetKey(item('a')) }, { series: 'desktop' }).image).toBe(buildWallpaperAssetKey(item('a')))
    expect(validateBrowseQuery({ category: '自然', subcategory: '山' }, { series: 'desktop', categoriesReady: true, categories: [{ value: '自然', subcategories: [{ name: '山' }] }] })).toMatchObject({ category: '自然', subcategory: '山' })
  })
  function harness(query = {}, initialResults = [], overrides = {}) {
    query = { ...query, ...(query.image ? { image: encodeWallpaperShareToken(query.image) } : {}) }
    const route = overrides.route || reactive({ path: '/desktop', query, fullPath: '/desktop?' + new URLSearchParams(query) })
    const router = overrides.router || { push: vi.fn(async (location) => { route.query = location.query; route.fullPath = route.path + '?' + new URLSearchParams(location.query) }), replace: vi.fn(async (location) => { route.query = location.query; route.fullPath = route.path + '?' + new URLSearchParams(location.query) }) }
    const filters = overrides.filterStore || reactive({ searchQuery: '', debouncedQuery: '', sortBy: 'newest', categoryFilter: 'all', subcategoryFilter: 'all', formatFilter: 'all', resolutionFilter: 'all', clearExactSearch: vi.fn() })
    if (!overrides.filterStore) {
      filters.exactSearchValue = ''
      filters.clearExactSearch = vi.fn(() => { filters.exactSearchValue = '' })
      filters.setExactSearch = vi.fn((label, key) => { filters.searchQuery = label; filters.exactSearchValue = key })
    }
    const results = overrides.results || ref(initialResults), ready = overrides.ready || ref(false), gridReady = ref(true)
    const series = ref(overrides.series || 'desktop')
    return { route, router, filters, results, ready, gridReady, ...mount(() => {
      const nav = useWallpaperNavigator(() => results.value, { resultsReady: () => ready.value })
      const browse = useBrowseState({ route, router, filterStore: filters, currentSeries: series, results, resultsReady: ready, categories: ref([{ value: 'all' }, { value: '自然' }]), categoriesReady: ready, gridReady, navigator: nav })
      return { nav, browse }
    }) }
  }
  it('刷新恢复筛选、完整身份和足够分页；数据未齐不清 image', async () => {
    const rows = Array.from({ length: 65 }, (_, i) => item(String(i)))
    const image = buildWallpaperAssetKey(rows[54])
    const h = harness({ q: '山', category: '自然', color: 'blue', image })
    await flush()
    expect(h.filters.searchQuery).toBe('山')
    expect(h.filters.debouncedQuery).toBe('山')
    expect(h.nav.isOpen.value).toBe(false)
    expect(h.route.query.image).toBe(encodeWallpaperShareToken(image))
    h.results.value = rows
    h.ready.value = true
    await flush()
    expect(buildWallpaperAssetKey(h.nav.currentWallpaper.value)).toBe(image)
    expect(h.browse.minimumDisplayCount.value).toBeGreaterThanOrEqual(55)
    expect(h.router.push).not.toHaveBeenCalled()
  })
  it('外部返回恢复图片和已展开数量/滚动；内部同步不循环导航', async () => {
    const rows = Array.from({ length: 65 }, (_, i) => item(String(i)))
    const h = harness({}, rows)
    h.ready.value = true
    await flush()
    h.browse.onDisplayCountChange(60)
    window.scrollY = 900
    h.browse.savePosition()
    h.filters.searchQuery = '星空'
    h.filters.debouncedQuery = '星空'
    await flush()
    expect(h.route.query.q).toBe('星空')
    const pushes = h.router.push.mock.calls.length
    await flush()
    expect(h.router.push).toHaveBeenCalledTimes(pushes)
    h.route.query = {}
    h.route.fullPath = '/desktop'
    await flush()
    expect(h.filters.searchQuery).toBe('')
    expect(h.browse.minimumDisplayCount.value).toBe(60)
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 900, behavior: 'instant' })
  })
  it('进入真实详情前保存旧列表，迟到数据不会改写详情 URL，返回可恢复分页位置', async () => {
    const rows = Array.from({ length: 65 }, (_, i) => item(String(i)))
    const h = harness({ q: '山' }, rows)
    h.ready.value = true
    await flush()
    h.browse.onDisplayCountChange(60)
    window.scrollY = 960
    h.browse.leave()
    h.router.push.mockClear()
    h.router.replace.mockClear()
    h.route.path = '/wallpaper/token'
    h.route.query = {}
    h.route.fullPath = '/wallpaper/token'
    h.results.value = [...rows, item('late')]
    await flush()
    expect(h.router.push).not.toHaveBeenCalled()
    expect(h.router.replace).not.toHaveBeenCalled()
    const restored = harness({ q: '山' }, rows)
    restored.ready.value = true
    await flush()
    expect(restored.browse.minimumDisplayCount.value).toBe(60)
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 960, behavior: 'instant' })
  })
  it('无效图只在完整结果就绪后移除', async () => {
    const h = harness({ image: buildWallpaperAssetKey(item('missing')) })
    await flush()
    expect(h.route.query.image).toBeTruthy()
    h.ready.value = true
    await flush()
    expect(h.route.query.image).toBeUndefined()
    expect(h.nav.isOpen.value).toBe(false)
  })
  it('等待数据期间改筛选/选图取消旧恢复，不覆盖用户后续操作', async () => {
    const a = item('a'), b = item('b')
    const h = harness({ q: '旧', image: buildWallpaperAssetKey(a) })
    await flush()
    h.filters.searchQuery = '新'
    h.filters.debouncedQuery = '新'
    h.nav.handleSelectWallpaper(b)
    await flush()
    expect(h.route.query).toMatchObject({ q: '新', image: encodeWallpaperShareToken(buildWallpaperAssetKey(b)) })
    h.results.value = [a, b]
    h.ready.value = true
    await flush()
    expect(buildWallpaperAssetKey(h.nav.currentWallpaper.value)).toBe(buildWallpaperAssetKey(b))
    expect(h.filters.searchQuery).toBe('新')
  })
  it('恢复布局两帧间改筛选不滚回旧位置且更新 URL', async () => {
    const h = harness({}, [item('a')])
    h.ready.value = true
    for (let i = 0; i < 8; i++) await nextTick()
    h.filters.searchQuery = '后续'
    h.filters.debouncedQuery = '后续'
    await flush()
    expect(h.route.query.q).toBe('后续')
    expect(window.scrollTo).not.toHaveBeenCalled()
  })
  it('分页恢复请求大于当前切片时保留目标，完整数据追加后无需重复加载', async () => {
    const rows = ref(Array.from({ length: 20 }, (_, i) => item(String(i))))
    const minimumDisplayCount = ref(61)
    const paging = mount(() => useGridPagination({ wallpapers: rows, minimumDisplayCount }))
    expect(paging.displayedItems.value).toHaveLength(20)
    rows.value = Array.from({ length: 80 }, (_, i) => item(String(i)))
    await flush()
    expect(paging.displayedItems.value.length).toBeGreaterThanOrEqual(61)
  })
  it('真实 memory router 的筛选/开图/返回恢复不产生 watch-router 回环', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/desktop', component: {} }] })
    await router.push('/desktop')
    const route = reactive({ get path() { return router.currentRoute.value.path }, get query() { return router.currentRoute.value.query }, get fullPath() { return router.currentRoute.value.fullPath } })
    const push = vi.spyOn(router, 'push')
    const a = item('a'), b = item('b')
    const h = harness({}, [a, b], { route, router })
    h.ready.value = true
    await flush()
    h.filters.searchQuery = '星空'
    h.filters.debouncedQuery = '星空'
    await flush()
    expect(router.currentRoute.value.query.q).toBe('星空')
    h.nav.handleSelectWallpaper(b)
    await flush()
    expect(router.currentRoute.value.query.image).toBe(encodeWallpaperShareToken(buildWallpaperAssetKey(b)))
    const calls = push.mock.calls.length
    router.back()
    await flush()
    expect(h.nav.isOpen.value).toBe(false)
    expect(h.filters.searchQuery).toBe('星空')
    router.back()
    await flush()
    expect(h.filters.searchQuery).toBe('')
    expect(push).toHaveBeenCalledTimes(calls)
  })
  it('重试加载器重置默认筛选后仍按 URL 恢复，未知分类等待完整索引才回退', async () => {
    const h = harness({ q: '森林', category: '未知' })
    await flush()
    expect(h.filters.categoryFilter).toBe('未知')
    h.ready.value = true
    await flush()
    expect(h.filters.categoryFilter).toBe('all')
    expect(h.route.query.category).toBeUndefined()
    expect(h.route.query.q).toBe('森林')
    h.filters.searchQuery = ''
    h.filters.debouncedQuery = ''
    const restoring = h.browse.restoreFromRoute()
    await flush()
    await restoring
    expect(h.filters.searchQuery).toBe('森林')
    expect(h.filters.debouncedQuery).toBe('森林')
    expect(h.route.query.q).toBe('森林')
  })
  it('Bing 历史月份保持月份语义，所需年份未就绪前不清选择', async () => {
    const image = 'bing:bing-2024-02-10.jpg'
    const h = harness({ category: '2024-02', image }, [], { series: 'bing' })
    await flush()
    expect(h.filters.categoryFilter).toBe('2024-02')
    expect(h.route.query.image).toBe(encodeWallpaperShareToken(image))
    h.results.value = [{ _assetKey: image, _series: 'bing', filename: 'bing-2024-02-10.jpg', category: '2024-02' }]
    await flush()
    expect(h.nav.isOpen.value).toBe(false)
    h.ready.value = true
    await flush()
    expect(h.filters.categoryFilter).toBe('2024-02')
    expect(buildWallpaperAssetKey(h.nav.currentWallpaper.value)).toBe(image)
  })
  it('sessionStorage 拒绝访问时 URL 恢复与同步仍可使用', async () => {
    vi.stubGlobal('sessionStorage', { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } })
    const h = harness({ q: '山' }, [item('a')])
    h.ready.value = true
    await flush()
    h.browse.onDisplayCountChange(40)
    h.browse.savePosition()
    h.filters.searchQuery = '河'
    h.filters.debouncedQuery = '河'
    await flush()
    expect(h.route.query.q).toBe('河')
  })
  it('旧 canonical asset key URL 可恢复且原地归一为分享 token', async () => {
    const a = item('a')
    const image = buildWallpaperAssetKey(a)
    const route = reactive({ path: '/desktop', query: { image }, fullPath: `/desktop?image=${encodeURIComponent(image)}` })
    const h = harness({}, [a], { route })
    h.ready.value = true
    await flush()
    expect(buildWallpaperAssetKey(h.nav.currentWallpaper.value)).toBe(image)
    expect(h.route.query.image).toBe(encodeWallpaperShareToken(image))
    expect(h.router.replace).toHaveBeenCalledTimes(1)
    expect(h.router.push).not.toHaveBeenCalled()
  })
  it('准确搜索刷新保留标签与唯一资源身份，image 不参与搜索条件', async () => {
    const a = item('a'), b = item('b')
    const key = buildWallpaperAssetKey(b)
    const h = harness({ q: '同名壁纸', exact: encodeWallpaperShareToken(key) }, [a, b])
    await flush()
    expect(h.filters.setExactSearch).toHaveBeenCalledWith('同名壁纸', key)
    expect(h.filters.exactSearchValue).toBe(key)
    expect(h.filters.searchQuery).toBe('同名壁纸')
    expect([a, b].filter(row => buildWallpaperAssetKey(row) === h.filters.exactSearchValue)).toEqual([b])
    h.ready.value = true
    await flush()
    expect(h.route.query.exact).toBe(encodeWallpaperShareToken(key))
    expect(h.nav.isOpen.value).toBe(false)
  })
  it('准确搜索 URL 返回恢复身份，改为普通文本搜索时移除 exact', async () => {
    const a = item('a'), key = buildWallpaperAssetKey(a)
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/desktop', component: {} }] })
    await router.push({ path: '/desktop', query: { q: '同名', exact: encodeWallpaperShareToken(key) } })
    const route = reactive({ get path() { return router.currentRoute.value.path }, get query() { return router.currentRoute.value.query }, get fullPath() { return router.currentRoute.value.fullPath } })
    const h = harness({}, [a], { route, router })
    h.ready.value = true
    await flush()
    expect(h.filters.exactSearchValue).toBe(key)
    h.filters.clearExactSearch()
    h.filters.searchQuery = '普通文本'
    h.filters.debouncedQuery = '普通文本'
    await flush()
    expect(route.query.exact).toBeUndefined()
    router.back()
    await flush()
    expect(h.filters.exactSearchValue).toBe(key)
    expect(h.filters.searchQuery).toBe('同名')
    expect(validateBrowseQuery({ q: 'x', exact: 'desktop:same.jpg' }, { series: 'desktop' }).exact).toBe('')
    expect(validateBrowseQuery({ q: 'x', exact: encodeWallpaperShareToken(key) }, { series: 'mobile' }).exact).toBe('')
  })
  it('Bing 热词的日期 filename 准确搜索写入完整键 token', async () => {
    const h = harness({}, [], { series: 'bing' })
    h.ready.value = true
    await flush()
    h.filters.setExactSearch('山川', 'bing-2024-02-10.jpg')
    h.filters.debouncedQuery = '山川'
    await flush()
    expect(h.route.query.exact).toBe(encodeWallpaperShareToken('bing:bing-2024-02-10.jpg'))
    expect(h.route.query.q).toBe('山川')
  })

})
