import { computed, nextTick, onBeforeUnmount, onMounted, ref, toValue, watch } from 'vue'
import { FORMAT_OPTIONS, RESOLUTION_OPTIONS, SORT_OPTIONS } from '@/utils/config/constants'
import { getDefaultCategoryFilter } from '@/utils/filter/defaults'
import { buildWallpaperAssetKey } from '@/utils/wallpaper/identity'
import { decodeWallpaperShareToken, encodeWallpaperShareToken } from '@/utils/wallpaper/share'

const FILTER_FIELDS = {
  q: 'searchQuery',
  exact: 'exactSearchValue',
  category: 'categoryFilter',
  subcategory: 'subcategoryFilter',
  sort: 'sortBy',
  format: 'formatFilter',
  resolution: 'resolutionFilter',
}
const STORAGE_KEY = 'wallpaper_browse_v1:'
const MAX_DISPLAY_COUNT = 100000

function safeText(value, maxLength = 120) {
  return typeof value === 'string' && value.length <= maxLength && ![...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ? value : ''
}

function validImage(value, series) {
  const input = safeText(value, 4096)
  // 兼容早期浏览 URL 的规范完整键，新写入统一使用分享 token。
  const key = decodeWallpaperShareToken(input) || input
  if (!key.startsWith(`${series}:`) || buildWallpaperAssetKey(key, series) !== key)
    return ''
  if (series === 'bing') {
    const date = key.match(/^bing:bing-(\d{4}-\d{2}-\d{2})\.jpg$/)?.[1]
    const parsed = date ? new Date(date) : null
    const validDate = parsed && Number.isFinite(parsed.getTime()) && parsed.getUTCFullYear() >= 2009
      && parsed.getUTCFullYear() <= new Date().getFullYear() && parsed.toISOString().slice(0, 10) === date
    return validDate ? key : ''
  }
  return key.startsWith(`${series}:path:/wallpaper/${series}/`) && /\.(?:jpe?g|png|webp|gif|avif|mp4|webm)$/i.test(key) ? key : ''
}

export function validateBrowseQuery(query = {}, { series, categories = [], categoriesReady = false } = {}) {
  const defaults = { q: '', exact: '', category: getDefaultCategoryFilter(series), subcategory: 'all', sort: 'newest', format: 'all', resolution: 'all', image: '' }
  const state = { ...defaults, q: safeText(query.q, 200), image: validImage(query.image, series), exact: validImage(query.exact, series) }
  if (!state.q)
    state.exact = ''
  const options = { sort: SORT_OPTIONS, format: FORMAT_OPTIONS, resolution: RESOLUTION_OPTIONS }
  for (const [key, list] of Object.entries(options)) {
    if (list.some(option => option.value === query[key]))
      state[key] = query[key]
  }
  const category = safeText(query.category)
  const month = series === 'bing' && /^20\d{2}-(?:0[1-9]|1[0-2])$/.test(category)
    && Number(category.slice(0, 4)) >= 2009 && Number(category.slice(0, 4)) <= new Date().getFullYear()
  if (category === 'all' || month || (category && (!categoriesReady || categories.some(option => option.value === category))))
    state.category = category
  const subcategory = safeText(query.subcategory)
  const parent = categories.find(option => option.value === state.category)
  if (subcategory && state.category !== 'all' && (!categoriesReady || parent?.subcategories?.some(item => (item.name || item.value) === subcategory)))
    state.subcategory = subcategory
  return state
}

function querySignature(query) {
  return JSON.stringify(Object.entries(query).sort(([a], [b]) => a.localeCompare(b)))
}

function compactQuery(state, series) {
  const defaults = validateBrowseQuery({}, { series })
  return Object.fromEntries(Object.entries(state)
    .filter(([key, value]) => value && value !== defaults[key])
    .map(([key, value]) => [key, ['image', 'exact'].includes(key) ? encodeWallpaperShareToken(value) : value]))
}

// URL 保存筛选/身份，sessionStorage 只保存同一结果列表的分页与滚动位置。
export function useBrowseState({ route, router, filterStore, currentSeries, results, resultsReady, categories, categoriesReady, gridReady, navigator }) {
  const minimumDisplayCount = ref(20)
  const restoring = ref(true)
  let displayCount = 20
  let pending = null
  let applying = false
  let started = false
  let disposed = false
  let version = 0
  const ownNavigations = new Set()

  function options() {
    return { series: toValue(currentSeries), categories: toValue(categories) || [], categoriesReady: toValue(categoriesReady) }
  }
  const filterState = computed(() => {
    const state = Object.fromEntries(Object.entries(FILTER_FIELDS).map(([key, field]) => [key, filterStore[field]]))
    if (toValue(currentSeries) === 'bing' && /^bing-\d{4}-\d{2}-\d{2}\.jpg$/i.test(state.exact))
      state.exact = buildWallpaperAssetKey(state.exact, 'bing')
    return state
  })
  const imageKey = computed(() => navigator.isOpen.value ? buildWallpaperAssetKey(navigator.currentWallpaper.value) : '')
  function matchesFilters(state) {
    return Object.keys(FILTER_FIELDS).every(key => filterState.value[key] === state[key])
  }
  function listKey(state) {
    const { image, ...filters } = state
    return `${STORAGE_KEY}${route.path}:${querySignature(compactQuery(filters, toValue(currentSeries)))}`
  }
  function readPosition(state) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(listKey(state)))
      return {
        count: Number.isInteger(saved?.count) ? Math.max(20, Math.min(MAX_DISPLAY_COUNT, saved.count)) : 20,
        top: Number.isFinite(saved?.top) ? Math.max(0, Math.min(10000000, saved.top)) : 0,
      }
    }
    catch {
      return { count: 20, top: 0 }
    }
  }
  function savePosition() {
    if (!started || pending || applying || disposed)
      return
    const state = validateBrowseQuery(route.query, options())
    if (querySignature(compactQuery({ ...filterState.value, image: '' }, toValue(currentSeries))) !== querySignature(compactQuery({ ...state, image: '' }, toValue(currentSeries))))
      return
    try {
      sessionStorage.setItem(listKey(state), JSON.stringify({ count: displayCount, top: window.scrollY }))
    }
    catch {
      // 存储受限时 URL 筛选与图片恢复仍然可用。
    }
  }
  function onDisplayCountChange(count) {
    displayCount = count
    savePosition()
  }

  async function writeQuery(state, replace = false) {
    const query = compactQuery(state, toValue(currentSeries))
    const signature = `${route.path}:${querySignature(query)}`
    if (querySignature(query) === querySignature(route.query))
      return
    ownNavigations.add(signature)
    try {
      await router[replace ? 'replace' : 'push']({ path: route.path, query, hash: route.hash })
    }
    finally {
      ownNavigations.delete(signature)
    }
  }
  async function applyRoute() {
    const generation = ++version
    applying = true
    restoring.value = true
    const state = validateBrowseQuery(route.query, options())
    pending = { state, position: readPosition(state), generation }
    minimumDisplayCount.value = pending.position.count
    filterStore.clearExactSearch()
    Object.entries(FILTER_FIELDS).forEach(([key, field]) => {
      filterStore[field] = state[key]
    })
    if (state.exact)
      filterStore.setExactSearch(state.q, state.exact)
    filterStore.debouncedQuery = state.q
    await nextTick()
    if (generation === version)
      applying = false
    await restoreResults()
  }
  async function restoreResults() {
    const request = pending
    if (!request || applying || !matchesFilters(request.state) || !toValue(resultsReady) || !toValue(gridReady))
      return
    applying = true
    const validated = validateBrowseQuery(route.query, options())
    if (querySignature(validated) !== querySignature(request.state)) {
      applying = false
      await applyRoute()
      return
    }
    const rows = toValue(results) || []
    const index = rows.findIndex(item => buildWallpaperAssetKey(item) === request.state.image)
    minimumDisplayCount.value = Math.max(request.position.count, index + 1)
    if (index >= 0)
      navigator.handleSelectWallpaper(rows[index])
    else
      navigator.close()
    await nextTick()
    // 等列表补足并完成布局，再恢复位置，避免浏览器在短列表上截断滚动。
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    if (disposed || request.generation !== version)
      return
    if (!matchesFilters(request.state) || imageKey.value !== (index >= 0 ? request.state.image : '')) {
      pending = null
      restoring.value = false
      applying = false
      await writeQuery({ ...filterState.value, image: imageKey.value })
      return
    }
    window.scrollTo({ top: request.position.top, behavior: 'instant' })
    pending = null
    restoring.value = false
    await writeQuery({ ...request.state, image: index >= 0 ? request.state.image : '' }, true)
    applying = false
  }

  watch(() => route.fullPath, () => {
    if (!started || ownNavigations.has(`${route.path}:${querySignature(route.query)}`))
      return
    void applyRoute()
  }, { flush: 'post' })
  watch([results, () => toValue(resultsReady), () => toValue(gridReady), () => toValue(categoriesReady)], () => {
    void restoreResults()
  }, { flush: 'post' })
  watch([filterState, imageKey], async () => {
    await nextTick()
    if (!started || applying || disposed)
      return
    if (pending && matchesFilters(pending.state) && !imageKey.value)
      return
    if (pending || Object.keys(FILTER_FIELDS).some(key => filterState.value[key] !== validateBrowseQuery(route.query, options())[key]))
      minimumDisplayCount.value = 20
    pending = null
    restoring.value = false
    version += 1
    savePosition()
    await writeQuery({ ...filterState.value, image: imageKey.value })
  }, { flush: 'post' })

  onMounted(() => {
    started = true
    void applyRoute()
    window.addEventListener('scroll', savePosition, { passive: true })
    window.addEventListener('pagehide', savePosition)
  })
  onBeforeUnmount(() => {
    savePosition()
    disposed = true
    version += 1
    window.removeEventListener('scroll', savePosition)
    window.removeEventListener('pagehide', savePosition)
  })
  return { minimumDisplayCount, restoring, onDisplayCountChange, savePosition, restoreFromRoute: applyRoute }
}
