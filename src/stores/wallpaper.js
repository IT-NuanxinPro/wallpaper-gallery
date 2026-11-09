// ========================================
// 壁纸数据管理 Store (优化版 - 按需加载 + Web Worker)
// ========================================

import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { decodeDataWithWorker } from '@/services/wallpaper/decoder'
import { fetchWithRetry } from '@/services/wallpaper/fetch'
import { LRUCache } from '@/utils/cache/LRUCache'
import { DATA_CACHE_BUSTER, SERIES_CONFIG } from '@/utils/config/constants'
import { classifyWallpaperError, getWallpaperErrorMessage } from '@/utils/wallpaper/errors'
import { buildWallpaperAssetKey, getWallpaperIdentity } from '@/utils/wallpaper/identity'
import { formatWallpaperStatistics, transformBingWallpaper, transformWallpaperUrls } from '@/utils/wallpaper/transformers'

export const useWallpaperStore = defineStore('wallpaper', () => {
  // ========================================
  // State
  // ========================================

  // 系列数据缓存（只存储索引信息，最多缓存 5 个系列）
  const seriesIndexCache = ref({})

  // 分类数据缓存（使用 LRU 缓存，最多保留 15 个分类，约 60MB）
  const categoryCache = new LRUCache(15)
  // 保留四个普通系列的完整快照，往返切换无需重复解码和排序。
  const seriesDataCache = new LRUCache(4)

  // 最新切片和生成时间独立保存，避免把切片误当成完整数据。
  const seriesLatestCache = shallowRef({})
  const seriesLatestGeneratedAt = {}

  // Bing 壁纸缓存（完整加载后缓存）
  const bingWallpapersCache = shallowRef(null)
  const bingYearLookupCache = shallowRef({})
  let bingLoadedYearsCache = new Set()
  const bingYearRequests = new Map()
  let bingYearLoadState = { pending: new Set(), errors: new Map() }

  // 当前加载的壁纸列表（合并后的）
  // 列表按批次替换，元数据不逐字段编辑，避免给数千条记录建立深层响应式代理。
  const wallpapers = shallowRef([])

  // 当前加载的系列
  const currentLoadedSeries = ref('')
  const currentRenderedSeries = ref('')

  // 已加载的分类列表（当前系列）
  const loadedCategories = ref(new Set())

  // 加载状态
  const loading = ref(false)
  const error = ref(null)
  const errorType = ref(null) // 'network' | 'parse' | 'format' | 'unknown'

  // 后台加载状态（用于控制 UI 是否显示加载中的数量变化）
  const isBackgroundLoading = ref(false)
  const isDataComplete = ref(false)
  const backgroundError = ref(null)

  // 首次加载完成后的初始数量（用于在后台加载期间稳定显示）
  const initialLoadedCount = ref(0)

  // 系列总数量（从索引文件中获取，用于显示预期总数）
  const expectedTotal = ref(0)

  const retryConfig = {
    retries: 3,
    retryDelay: 1000,
  }

  // 请求版本号（用于防止竞态条件）
  let requestVersion = 0
  const cacheVersions = new Map()
  let activeSeriesLoad = null

  function compareWallpapers(a, b) {
    const dateDiff = new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    if (dateDiff !== 0) {
      return dateDiff
    }

    return String(a.filename || '').localeCompare(String(b.filename || ''))
  }

  function sortWallpapers(wallpaperList) {
    return [...wallpaperList].sort(compareWallpapers)
  }

  // ========================================
  // Getters
  // ========================================

  const total = computed(() => wallpapers.value.length)

  // 用于 UI 显示的稳定总数（后台加载期间显示预期总数，避免误导用户）
  const displayTotal = computed(() => {
    // 如果正在后台加载且有预期总数，显示预期总数（避免误导用户）
    if (isBackgroundLoading.value && expectedTotal.value > 0) {
      return expectedTotal.value
    }
    // 如果有预期总数且已加载完成，显示实际数量
    if (expectedTotal.value > 0 && !isBackgroundLoading.value) {
      return wallpapers.value.length
    }
    // 默认显示实际数量
    return wallpapers.value.length
  })

  const loaded = computed(() => wallpapers.value.length > 0)

  // 统计信息
  const statistics = computed(() => {
    return formatWallpaperStatistics(wallpapers.value)
  })

  // ========================================
  // Actions
  // ========================================

  // 页面代次隔离系列切换，缓存代次隔离手动刷新及收藏等独立查询。
  function createLoadContext(seriesId, pageVersion) {
    const cacheVersion = cacheVersions.get(seriesId) || 0
    return {
      isCurrent: () => (cacheVersions.get(seriesId) || 0) === cacheVersion
        && (pageVersion === undefined || requestVersion === pageVersion),
      key: `${seriesId}:${cacheVersion}:${pageVersion ?? 'lookup'}`,
    }
  }

  // 同时限制响应头和 JSON 响应体等待时间，超时后保留已展示的切片。
  async function fetchJson(url) {
    const controller = new AbortController()
    let timeout
    try {
      const deadline = new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort()
          reject(new Error('数据请求超时，请重试'))
        }, 20000)
      })
      return await Promise.race([
        fetchWithRetry(url, { signal: controller.signal }, retryConfig).then(response => response.json()),
        deadline,
      ])
    }
    finally {
      clearTimeout(timeout)
    }
  }

  async function readList(data, keys, context) {
    const rawList = keys.map(key => data?.[key]).find(Array.isArray)
    const encoded = data?.blob || data?.payload
    if (encoded) {
      try {
        const decoded = await decodeDataWithWorker(encoded)
        const list = Array.isArray(decoded)
          ? decoded
          : keys.map(key => decoded?.[key]).find(Array.isArray)
        if (!Array.isArray(list))
          throw new SyntaxError(`Invalid decoded JSON: ${context}`)
        return list
      }
      catch (e) {
        // 仅允许真实存在的明文数组回退，解码失败不能伪装成空列表。
        if (!rawList)
          throw e
      }
    }
    if (!rawList)
      throw new TypeError(`Invalid data format: ${context}`)
    return rawList
  }

  async function loadSeriesIndex(seriesId, context = createLoadContext(seriesId)) {
    if (seriesIndexCache.value[seriesId])
      return seriesIndexCache.value[seriesId]

    const seriesConfig = SERIES_CONFIG[seriesId]
    if (!seriesConfig)
      throw new TypeError(`Invalid series: ${seriesId}`)

    const data = await fetchJson(seriesConfig.indexUrl)
    const key = seriesConfig.isDaily ? 'years' : 'categories'
    const entries = await readList(data, [key], `${seriesId} index`)
    if (entries.some(entry => !entry || typeof entry.file !== 'string')
      || (data.total > 0 && entries.length === 0)) {
      throw new TypeError(`Invalid index data format: ${seriesId}`)
    }
    const indexData = { ...data, [key]: entries }
    if (context.isCurrent())
      seriesIndexCache.value[seriesId] = indexData
    return indexData
  }

  async function loadCategory(seriesId, categoryFile, context = createLoadContext(seriesId)) {
    const cacheKey = `${seriesId}:${categoryFile}`
    if (categoryCache.has(cacheKey))
      return categoryCache.get(cacheKey)

    const seriesConfig = SERIES_CONFIG[seriesId]
    if (!seriesConfig)
      throw new TypeError(`Invalid series: ${seriesId}`)

    const data = await fetchJson(`${seriesConfig.categoryBaseUrl}/${categoryFile}${DATA_CACHE_BUSTER}`)
    const wallpaperList = await readList(data, ['wallpapers'], categoryFile)
    const transformedList = wallpaperList.map(w => transformWallpaperUrls(w))
    if (context.isCurrent())
      categoryCache.set(cacheKey, transformedList)
    return transformedList
  }

  // 缺少计数的旧格式仍可使用；合法计数不一致说明快照不完整，不能写入完整缓存。
  function validateCount(expected, actual, context) {
    if (Number.isInteger(expected) && expected >= 0 && expected !== actual)
      throw new TypeError(`Invalid record count: ${context}`)
  }

  function isLatestCurrent(seriesId, generatedAt = seriesLatestGeneratedAt[seriesId]) {
    const latestTime = Date.parse(generatedAt)
    const indexTime = Date.parse(seriesIndexCache.value[seriesId]?.generatedAt)
    return !Number.isFinite(latestTime) || !Number.isFinite(indexTime) || latestTime >= indexTime
  }

  /**
   * 最新切片可独立完成首屏；Bing 必须沿用自己的日期及 URL 转换。
   */
  async function loadSeriesLatest(seriesId, forceRefresh = false, context = createLoadContext(seriesId)) {
    const seriesConfig = SERIES_CONFIG[seriesId]
    if (!seriesConfig?.latestUrl)
      return []
    if (!forceRefresh && seriesLatestCache.value[seriesId] && isLatestCurrent(seriesId))
      return seriesLatestCache.value[seriesId]

    try {
      const data = await fetchJson(seriesConfig.latestUrl)
      const wallpaperList = await readList(data, ['wallpapers', 'items'], `${seriesId} latest`)
      const transformedList = sortWallpapers(wallpaperList.map(w => seriesConfig.isDaily
        ? transformBingWallpaper(w)
        : transformWallpaperUrls(w)))
      if (!isLatestCurrent(seriesId, data.generatedAt))
        return []
      if (context.isCurrent()) {
        seriesLatestCache.value[seriesId] = transformedList
        seriesLatestGeneratedAt[seriesId] = data.generatedAt
      }
      return transformedList
    }
    catch (e) {
      console.warn(`Failed to load latest slice for ${seriesId}:`, e)
      return []
    }
  }

  async function loadBingYearData(year, context = createLoadContext('bing')) {
    if (!Number.isInteger(year))
      return []
    if (bingYearLookupCache.value[year])
      return bingYearLookupCache.value[year]

    const requestKey = `${context.key}:${year}`
    if (bingYearRequests.has(requestKey))
      return bingYearRequests.get(requestKey)

    const pending = (async () => {
      const indexData = await loadSeriesIndex('bing', context)
      if (!context.isCurrent())
        return []
      const yearInfo = indexData.years.find(item => Number(item.year) === year)
      if (!yearInfo)
        return []

      const data = await fetchJson(`${SERIES_CONFIG.bing.yearBaseUrl}/${yearInfo.file}${DATA_CACHE_BUSTER}`)
      const items = await readList(data, ['items'], `Bing ${year}`)
      validateCount(yearInfo.count, items.length, `Bing ${year}`)
      const transformedItems = sortWallpapers(items.map(item => transformBingWallpaper(item)))
      if (context.isCurrent())
        bingYearLookupCache.value[year] = transformedItems
      return transformedItems
    })()
    bingYearRequests.set(requestKey, pending)
    try {
      return await pending
    }
    finally {
      bingYearRequests.delete(requestKey)
    }
  }

  function useCompleteData(seriesId, data, categories) {
    wallpapers.value = data
    currentRenderedSeries.value = seriesId
    loadedCategories.value = new Set(categories)
    initialLoadedCount.value = data.length
    expectedTotal.value = data.length
    loading.value = false
    isBackgroundLoading.value = false
    isDataComplete.value = true
    error.value = null
    errorType.value = null
    backgroundError.value = null
  }

  function isBingYearLoaded(year) {
    return currentRenderedSeries.value === 'bing' && loadedCategories.value.has(String(year))
  }

  function updateBingYearLoading(state) {
    isBackgroundLoading.value = state.pending.size > 0
    isDataComplete.value = isBingYearLoaded(new Date().getFullYear())
      && state.pending.size === 0 && state.errors.size === 0
    backgroundError.value = state.errors.values().next().value || null
  }

  function applyBingYearData(year, data) {
    // 完整年度替换同年切片，其他已加载年份继续保留。
    const yearKey = String(year)
    const existing = currentRenderedSeries.value === 'bing' ? wallpapers.value : (bingWallpapersCache.value || [])
    const merged = sortWallpapers([...existing.filter(w => !w.date.startsWith(`${yearKey}-`)), ...data])
    bingLoadedYearsCache.add(yearKey)
    // 缓存只收录完整年度，当前年切片不能随着健康历史年进入完整缓存。
    const complete = merged.filter(w => bingLoadedYearsCache.has(w.date.slice(0, 4)))
    bingWallpapersCache.value = complete.length === merged.length ? merged : complete
    wallpapers.value = merged
    currentRenderedSeries.value = 'bing'
    loadedCategories.value = new Set([...bingLoadedYearsCache, ...merged.map(w => w.date)])
    initialLoadedCount.value = merged.length
    expectedTotal.value = merged.length
    loading.value = false
    error.value = null
    errorType.value = null
  }

  async function loadCompleteSeries(seriesId, context) {
    const indexData = await loadSeriesIndex(seriesId, context)
    if (!context.isCurrent())
      return

    if (SERIES_CONFIG[seriesId].isDaily) {
      const year = new Date().getFullYear()
      const yearInfo = indexData.years.find(item => Number(item.year) === year)
      if (!yearInfo)
        throw new TypeError(`Invalid Bing index: missing current year ${year}`)
      expectedTotal.value = yearInfo.count || 0
      const data = await loadBingYearData(year, context)
      if (!context.isCurrent())
        return
      applyBingYearData(year, data)
      updateBingYearLoading(bingYearLoadState)
    }
    else {
      expectedTotal.value = indexData.total || 0
      const categories = indexData.categories
      const groups = await Promise.all(categories.map(cat => loadCategory(seriesId, cat.file, context)))
      if (!context.isCurrent())
        return
      const merged = groups.flat()
      try {
        categories.forEach((category, index) => validateCount(category.count, groups[index].length, category.file))
        validateCount(indexData.total, merged.length, seriesId)
      }
      catch (e) {
        categoryCache.deleteByPrefix(`${seriesId}:`)
        throw e
      }
      // 所有分类完成后只排序和替换一次，避免逐批追加引起列表跳动。
      const data = sortWallpapers(merged)
      seriesDataCache.set(seriesId, data)
      useCompleteData(seriesId, data, categories.map(cat => cat.file))
    }
  }

  async function runSeriesLoad(seriesId, forceRefresh, context) {
    let complete = false
    let settled = false
    let completeError = null

    // latest 和索引同时启动；完整数据先到时，慢切片不再覆盖列表。
    void loadSeriesLatest(seriesId, forceRefresh, context).then((data) => {
      if (!context.isCurrent() || complete || isDataComplete.value || data.length === 0 || !isLatestCurrent(seriesId))
        return
      wallpapers.value = seriesId === 'bing' && bingWallpapersCache.value
        ? sortWallpapers([...data.filter(w => !bingLoadedYearsCache.has(w.date.slice(0, 4))), ...bingWallpapersCache.value])
        : data
      currentRenderedSeries.value = seriesId
      initialLoadedCount.value = data.length
      loading.value = false
      isBackgroundLoading.value = !settled
      error.value = null
      errorType.value = null
      backgroundError.value = completeError
    })

    try {
      await loadCompleteSeries(seriesId, context)
      complete = context.isCurrent()
    }
    catch (e) {
      if (!context.isCurrent())
        return
      const type = classifyWallpaperError(e)
      completeError = getWallpaperErrorMessage(e, type, `系列: ${seriesId}`)
      if (seriesId === 'bing')
        bingYearLoadState.errors.set(String(new Date().getFullYear()), completeError)
      isDataComplete.value = false
      if (currentRenderedSeries.value === seriesId && wallpapers.value.length > 0) {
        backgroundError.value = completeError
      }
      else {
        error.value = completeError
        errorType.value = type
      }
    }
    finally {
      settled = true
      if (context.isCurrent()) {
        loading.value = false
        isBackgroundLoading.value = false
      }
    }
  }

  /**
   * Promise 仍等待完整数据结束，首屏通过 loading/currentRenderedSeries 提前就绪。
   */
  async function initSeries(seriesId, forceRefresh = false) {
    if (!forceRefresh && currentLoadedSeries.value === seriesId && activeSeriesLoad?.context.isCurrent())
      return activeSeriesLoad.promise
    if (forceRefresh)
      clearCache(seriesId)

    const currentRequestVersion = ++requestVersion
    bingYearLoadState = { pending: new Set(), errors: new Map() }
    const context = createLoadContext(seriesId, currentRequestVersion)
    currentLoadedSeries.value = seriesId
    const cached = !forceRefresh && (SERIES_CONFIG[seriesId]?.isDaily
      ? bingLoadedYearsCache.has(String(new Date().getFullYear())) && bingWallpapersCache.value
      : seriesDataCache.get(seriesId))
    if (cached) {
      const categories = SERIES_CONFIG[seriesId]?.isDaily
        ? [...bingLoadedYearsCache, ...cached.map(w => w.date)]
        : (seriesIndexCache.value[seriesId]?.categories || []).map(cat => cat.file)
      useCompleteData(seriesId, cached, categories)
      return
    }

    loading.value = true
    error.value = null
    errorType.value = null
    backgroundError.value = null
    isDataComplete.value = false
    currentRenderedSeries.value = ''
    wallpapers.value = []
    loadedCategories.value = new Set()
    isBackgroundLoading.value = false
    initialLoadedCount.value = 0
    expectedTotal.value = 0

    const pending = runSeriesLoad(seriesId, forceRefresh, context)
    const active = { context, promise: pending }
    activeSeriesLoad = active
    try {
      await pending
    }
    finally {
      if (activeSeriesLoad === active)
        activeSeriesLoad = null
    }
  }

  /**
   * 当前年的补齐结束后再加载其他年份，避免月筛选与初始化互相覆盖。
   */
  async function loadBingYear(year) {
    const context = createLoadContext('bing', requestVersion)
    if (currentLoadedSeries.value !== 'bing')
      return
    if (activeSeriesLoad?.context.isCurrent())
      await activeSeriesLoad.promise
    if (!context.isCurrent() || !Number.isInteger(Number(year)) || loadedCategories.value.has(String(year)))
      return

    const state = bingYearLoadState
    const pending = Symbol(year)
    const yearKey = String(year)
    state.pending.add(pending)
    state.errors.delete(yearKey)
    updateBingYearLoading(state)
    try {
      const indexData = await loadSeriesIndex('bing', context)
      if (!context.isCurrent())
        return
      if (!indexData.years.some(item => Number(item.year) === Number(year)))
        throw new TypeError(`Invalid Bing year: ${year}`)
      const data = await loadBingYearData(Number(year), context)
      if (!context.isCurrent())
        return
      applyBingYearData(year, data)
      state.errors.delete(yearKey)
    }
    catch (e) {
      if (context.isCurrent())
        state.errors.set(yearKey, getWallpaperErrorMessage(e, classifyWallpaperError(e), `Bing ${year}`))
    }
    finally {
      state.pending.delete(pending)
      if (context.isCurrent())
        updateBingYearLoading(state)
    }
  }

  async function loadAllCategories(seriesId) {
    await initSeries(seriesId)
  }

  /**
   * 根据 ID 获取单个壁纸
   */
  function getWallpaperById(id) {
    return wallpapers.value.find(w => w.id === id)
  }

  function getSeriesCategories(seriesId) {
    return seriesIndexCache.value[seriesId]?.categories || []
  }

  async function resolveWallpapersByAssetKeys(assetKeys = []) {
    if (!Array.isArray(assetKeys) || assetKeys.length === 0) {
      return []
    }

    const grouped = assetKeys.reduce((acc, requestedKey) => {
      const identity = getWallpaperIdentity(requestedKey)
      if (!identity.assetKey || !SERIES_CONFIG[identity.series]) {
        return acc
      }
      if (!acc[identity.series]) {
        acc[identity.series] = []
      }
      acc[identity.series].push({ ...identity, requestedKey })
      return acc
    }, {})

    const resolvedByKey = new Map()

    await Promise.all(Object.entries(grouped).map(async ([series, items]) => {
      const matchedByKey = new Map()
      const candidatesByFilename = new Map()
      const hasLegacyKeys = items.some(item => !item.imageId.startsWith('path:'))
      const collectMatches = (wallpaperList = []) => {
        wallpaperList.forEach((wallpaper) => {
          const identity = getWallpaperIdentity(wallpaper, series)
          if (!identity.assetKey) {
            return
          }
          matchedByKey.set(identity.assetKey, wallpaper)
          if (!candidatesByFilename.has(identity.filename)) {
            candidatesByFilename.set(identity.filename, new Set())
          }
          candidatesByFilename.get(identity.filename).add(identity.assetKey)
        })
      }
      const allExactMatchesFound = () => items.every(item => matchedByKey.has(item.assetKey))

      if (currentRenderedSeries.value === series) {
        collectMatches(wallpapers.value)
      }

      if (series === 'bing') {
        collectMatches(bingWallpapersCache.value || [])
        const neededYears = [...new Set(items.map(({ filename }) => {
          const matched = filename.match(/(\d{4})-\d{2}-\d{2}/)
          return matched ? Number.parseInt(matched[1], 10) : null
        }).filter(Number.isInteger))]
        for (const year of neededYears) {
          if (allExactMatchesFound()) {
            break
          }
          collectMatches(await loadBingYearData(year))
        }
      }
      else {
        const completeSeries = seriesDataCache.get(series)
        if (completeSeries) {
          collectMatches(completeSeries)
        }
        else if (hasLegacyKeys || !allExactMatchesFound()) {
          collectMatches(seriesLatestCache.value[series] || await loadSeriesLatest(series))
          const indexData = await loadSeriesIndex(series)
          for (const category of indexData.categories || []) {
            // 旧文件名必须扫描完整系列，不能在找到首个同名资源后停止。
            if (!hasLegacyKeys && allExactMatchesFound()) {
              break
            }
            collectMatches(await loadCategory(series, category.file))
          }
        }
      }

      items.forEach(({ assetKey, imageId, filename, requestedKey }) => {
        const candidates = candidatesByFilename.get(filename)
        const matchedKey = imageId.startsWith('path:') || series === 'bing'
          ? assetKey
          : (candidates?.size === 1 ? [...candidates][0] : '')
        const wallpaper = matchedByKey.get(matchedKey)
        resolvedByKey.set(requestedKey, wallpaper
          ? { ...wallpaper, _assetKey: buildWallpaperAssetKey(wallpaper, series), _series: series }
          : null)
      })
    }))

    return assetKeys.map(assetKey => resolvedByKey.get(assetKey) || null)
  }

  /**
   * 获取壁纸索引
   */
  function getWallpaperIndex(id) {
    return wallpapers.value.findIndex(w => w.id === id)
  }

  /**
   * 获取上一张壁纸
   */
  function getPrevWallpaper(currentId) {
    const index = getWallpaperIndex(currentId)
    if (index > 0) {
      return wallpapers.value[index - 1]
    }
    return null
  }

  /**
   * 获取下一张壁纸
   */
  function getNextWallpaper(currentId) {
    const index = getWallpaperIndex(currentId)
    if (index < wallpapers.value.length - 1) {
      return wallpapers.value[index + 1]
    }
    return null
  }

  /**
   * 清除缓存
   */
  function clearCache(seriesId) {
    const clearedSeries = seriesId ? [seriesId] : Object.keys(SERIES_CONFIG)
    clearedSeries.forEach((id) => {
      cacheVersions.set(id, (cacheVersions.get(id) || 0) + 1)
      delete seriesLatestGeneratedAt[id]
    })
    if (seriesId) {
      // 清除指定系列的缓存
      delete seriesIndexCache.value[seriesId]
      delete seriesLatestCache.value[seriesId]
      categoryCache.deleteByPrefix(`${seriesId}:`)
      seriesDataCache.delete(seriesId)
      // 清除 Bing 缓存
      if (seriesId === 'bing') {
        bingWallpapersCache.value = null
        bingYearLookupCache.value = {}
        bingLoadedYearsCache = new Set()
      }
    }
    else {
      // 清除所有缓存
      seriesIndexCache.value = {}
      seriesLatestCache.value = {}
      categoryCache.clear()
      seriesDataCache.clear()
      bingWallpapersCache.value = null
      bingYearLookupCache.value = {}
      bingLoadedYearsCache = new Set()
    }
  }

  return {
    // State
    wallpapers,
    loading,
    error,
    errorType,
    currentLoadedSeries,
    currentRenderedSeries,
    loadedCategories,
    isBackgroundLoading,
    isDataComplete,
    backgroundError,
    // Getters
    total,
    displayTotal,
    loaded,
    statistics,
    // Actions
    initSeries,
    loadAllCategories,
    loadCategory,
    loadSeriesLatest,
    loadBingYear,
    isBingYearLoaded,
    resolveWallpapersByAssetKeys,
    getWallpaperById,
    getSeriesCategories,
    getWallpaperIndex,
    getPrevWallpaper,
    getNextWallpaper,
    clearCache,
  }
})
