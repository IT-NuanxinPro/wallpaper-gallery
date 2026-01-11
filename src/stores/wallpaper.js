// ========================================
// 壁纸数据管理 Store (优化版 - 按需加载 + Web Worker)
// ========================================

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { isWorkerAvailable, workerDecodeAndParse } from '@/composables/useWorker'
import { decodeData } from '@/utils/codec'
import { DATA_CACHE_BUSTER, SERIES_CONFIG } from '@/utils/constants'
import { buildBingPreviewUrl, buildBingThumbnailUrl, buildBingUHDUrl, buildImageUrl } from '@/utils/format'

export const useWallpaperStore = defineStore('wallpaper', () => {
  // ========================================
  // State
  // ========================================

  // 系列数据缓存（只存储索引信息）
  const seriesIndexCache = ref({})

  // 分类数据缓存（按需加载）
  const categoryCache = ref({})

  // Bing 壁纸缓存（完整加载后缓存）
  const bingWallpapersCache = ref(null)

  // 当前加载的壁纸列表（合并后的）
  const wallpapers = ref([])

  // 当前加载的系列
  const currentLoadedSeries = ref('')

  // 已加载的分类列表（当前系列）
  const loadedCategories = ref(new Set())

  // 加载状态
  const loading = ref(false)
  const error = ref(null)
  const errorType = ref(null) // 'network' | 'parse' | 'format' | 'unknown'

  // 后台加载状态（用于控制 UI 是否显示加载中的数量变化）
  const isBackgroundLoading = ref(false)

  // 首次加载完成后的初始数量（用于在后台加载期间稳定显示）
  const initialLoadedCount = ref(0)

  // 系列总数量（从索引文件中获取，用于显示预期总数）
  const expectedTotal = ref(0)

  // ========================================
  // 分页相关状态（新增）
  // ========================================

  // 当前页码
  const currentPage = ref(1)

  // 总页数
  const totalPages = ref(0)

  // 每页数量
  const pageSize = ref(30)

  // 分页元数据（从 index.json 获取）
  const pagesInfo = ref([])

  // 已加载的页码集合（用于无限滚动模式）
  const loadedPages = ref(new Set())

  // 分页缓存（按页存储数据）
  const pageCache = ref({})

  // ========================================
  // 筛选模式相关状态
  // ========================================

  // 是否处于筛选模式（加载分类数据而非分页数据）
  const isFilterMode = ref(false)

  // 当前筛选的分类名称
  const currentFilterCategory = ref(null)

  // 分类数据缓存（用于筛选模式）
  const filterDataCache = ref({})

  // 筛选模式下的完整数据（用于客户端分页）
  const filterModeAllData = ref([])

  // 重试配置
  const MAX_RETRIES = 3
  const RETRY_DELAY = 1000 // 1秒

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
    const items = wallpapers.value
    const jpgCount = items.filter(w => w.format === 'JPG' || w.format === 'JPEG').length
    const pngCount = items.filter(w => w.format === 'PNG').length
    const totalSize = items.reduce((sum, w) => sum + (w.size || 0), 0)

    // 动态导入格式化函数（避免循环依赖）
    let totalSizeFormatted = '0 B'
    if (totalSize > 0) {
      try {
        // 使用简单的格式化逻辑，避免导入依赖
        const units = ['B', 'KB', 'MB', 'GB']
        const k = 1024
        const i = Math.floor(Math.log(totalSize) / Math.log(k))
        totalSizeFormatted = `${Number.parseFloat((totalSize / k ** i).toFixed(2))} ${units[i]}`
      }
      catch {
        totalSizeFormatted = `${totalSize} B`
      }
    }

    return {
      total: items.length,
      jpg: jpgCount,
      png: pngCount,
      totalSize,
      totalSizeFormatted,
    }
  })

  // 分页相关计算属性
  const hasPrevPage = computed(() => currentPage.value > 1)
  const hasNextPage = computed(() => currentPage.value < totalPages.value)
  const isFirstPage = computed(() => currentPage.value === 1)
  const isLastPage = computed(() => currentPage.value >= totalPages.value)

  // ========================================
  // Helper Functions
  // ========================================

  /**
   * 分类错误类型
   */
  function classifyError(error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return 'network'
    }
    if (error.message && error.message.includes('HTTP error')) {
      return 'network'
    }
    if (error instanceof SyntaxError || error.message.includes('JSON')) {
      return 'parse'
    }
    if (error.message && (error.message.includes('Invalid') || error.message.includes('format'))) {
      return 'format'
    }
    return 'unknown'
  }

  /**
   * 获取用户友好的错误信息
   */
  function getErrorMessage(error, errorType, context = '') {
    const contextStr = context ? ` (${context})` : ''
    switch (errorType) {
      case 'network':
        return `网络连接失败，请检查网络设置${contextStr}`
      case 'parse':
        return `数据解析失败，可能是数据格式错误${contextStr}`
      case 'format':
        return `数据格式错误${contextStr}`
      default:
        return error.message || `加载失败${contextStr}`
    }
  }

  /**
   * 延迟函数
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 带重试的 fetch 请求
   */
  async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options)
        if (!response.ok) {
          // 4xx 错误不重试
          if (response.status >= 400 && response.status < 500) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          // 5xx 错误重试
          if (i < retries - 1) {
            await delay(RETRY_DELAY * (i + 1))
            continue
          }
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response
      }
      catch (error) {
        // 网络错误重试
        if (error instanceof TypeError && error.message.includes('fetch')) {
          if (i < retries - 1) {
            await delay(RETRY_DELAY * (i + 1))
            continue
          }
        }
        throw error
      }
    }
  }

  /**
   * 解码数据（优先使用 Worker，降级到主线程）
   */
  async function decodeDataWithWorker(encoded) {
    // 如果 Worker 可用且数据较大，使用 Worker
    if (isWorkerAvailable() && encoded.length > 1000) {
      try {
        return await workerDecodeAndParse(encoded)
      }
      catch (e) {
        console.warn('Worker decode failed, fallback to main thread:', e)
      }
    }
    // 降级到主线程
    const jsonStr = decodeData(encoded)
    return JSON.parse(jsonStr)
  }

  /**
   * 将相对路径转换为完整 URL
   * 使用图片专属的 cdnTag 实现精准缓存控制
   */
  function transformWallpaperUrls(wallpaper) {
    const cdnTag = wallpaper.cdnTag // 图片专属的 CDN tag
    return {
      ...wallpaper,
      url: wallpaper.path ? buildImageUrl(wallpaper.path, cdnTag) : (wallpaper.url || ''),
      thumbnailUrl: wallpaper.thumbnailPath ? buildImageUrl(wallpaper.thumbnailPath, cdnTag) : (wallpaper.thumbnailUrl || ''),
      previewUrl: wallpaper.previewPath ? buildImageUrl(wallpaper.previewPath, cdnTag) : (wallpaper.previewUrl || null),
      downloadUrl: wallpaper.path ? buildImageUrl(wallpaper.path, cdnTag) : (wallpaper.downloadUrl || ''),
    }
  }

  /**
   * 转换 Bing 壁纸数据为标准格式
   * @param {object} bingItem - Bing 壁纸元数据
   * @returns {object} 标准壁纸格式
   */
  function transformBingWallpaper(bingItem) {
    // UHD 原图 URL（直接使用 Bing CDN）
    const uhdUrl = buildBingUHDUrl(bingItem.urlbase)

    return {
      id: `bing-${bingItem.date}`,
      filename: `bing-${bingItem.date}.jpg`,
      // Bing 壁纸按日期分类
      category: bingItem.date.substring(0, 7), // 年-月，如 2025-01
      // 所有图片都使用 Bing CDN
      url: uhdUrl,
      downloadUrl: uhdUrl,
      thumbnailUrl: buildBingThumbnailUrl(bingItem.urlbase),
      previewUrl: buildBingPreviewUrl(bingItem.urlbase),
      // Bing 特有字段
      date: bingItem.date,
      title: bingItem.title,
      copyright: bingItem.copyright,
      copyrightlink: bingItem.copyrightlink,
      quiz: bingItem.quiz,
      urlbase: bingItem.urlbase,
      hsh: bingItem.hsh,
      // 标准字段（Bing 不提供文件大小，UHD 图片约 1-3MB）
      size: 0,
      format: 'JPG',
      createdAt: `${bingItem.date}T00:00:00Z`,
      // Bing UHD 壁纸分辨率（通常为 3840x2160 或更高）
      resolution: {
        width: 3840,
        height: 2160,
        label: '4K UHD',
        type: 'success',
      },
      // 标记为 Bing 系列
      isBing: true,
      // 搜索标签
      tags: [bingItem.title, bingItem.date.substring(0, 7)],
    }
  }

  // ========================================
  // Actions
  // ========================================

  /**
   * 加载系列的分类索引（只加载索引，不加载具体数据）
   */
  async function loadSeriesIndex(seriesId) {
    // 如果已有缓存，直接返回
    if (seriesIndexCache.value[seriesId]) {
      return seriesIndexCache.value[seriesId]
    }

    const seriesConfig = SERIES_CONFIG[seriesId]
    if (!seriesConfig) {
      const err = new Error(`Invalid series: ${seriesId}`)
      errorType.value = 'format'
      throw err
    }

    try {
      const response = await fetchWithRetry(seriesConfig.indexUrl)
      let data
      try {
        data = await response.json()
      }
      catch (parseError) {
        const err = new Error(`Failed to parse JSON: ${parseError.message}`)
        errorType.value = 'parse'
        throw err
      }

      // 解密分类列表（使用 Worker）
      let indexData
      const encoded = data.blob || data.payload
      if (encoded) {
        try {
          const categories = await decodeDataWithWorker(encoded)
          indexData = {
            generatedAt: data.generatedAt,
            series: data.series,
            seriesName: data.seriesName,
            total: data.total,
            categoryCount: data.categoryCount,
            categories,
            // 分页信息（schema 3 新增）
            pageSize: data.pageSize || 30,
            totalPages: data.totalPages || 0,
            pages: data.pages || [],
            schema: data.schema,
            env: data.env,
          }
        }
        catch (err) {
          console.warn('Failed to decode category index:', err)
          // 如果解码失败，尝试使用原始数据
          if (data.categories) {
            indexData = data
          }
          else {
            const decodeErr = new Error('Failed to decode category index')
            errorType.value = 'parse'
            throw decodeErr
          }
        }
      }
      else {
        indexData = data
      }

      // 验证数据格式
      // Bing 系列使用 years 而不是 categories，但必须有分页信息
      const hasCategories = indexData.categories && Array.isArray(indexData.categories)
      const hasPagination = indexData.pages && Array.isArray(indexData.pages) && indexData.totalPages > 0

      if (!hasCategories && !hasPagination) {
        const err = new Error('Invalid index data format: missing categories array or pagination info')
        errorType.value = 'format'
        throw err
      }

      // 如果没有 categories，设置为空数组（Bing 系列）
      if (!hasCategories) {
        indexData.categories = []
      }

      // 存入缓存
      seriesIndexCache.value[seriesId] = indexData
      return indexData
    }
    catch (e) {
      const errType = classifyError(e)
      errorType.value = errType
      console.error(`Failed to load series index for ${seriesId}:`, e)
      throw e
    }
  }

  /**
   * 加载单个分类的数据
   */
  async function loadCategory(seriesId, categoryFile) {
    const cacheKey = `${seriesId}:${categoryFile}`

    // 如果已有缓存，直接返回
    if (categoryCache.value[cacheKey]) {
      return categoryCache.value[cacheKey]
    }

    const seriesConfig = SERIES_CONFIG[seriesId]
    if (!seriesConfig) {
      const err = new Error(`Invalid series: ${seriesId}`)
      errorType.value = 'format'
      throw err
    }

    try {
      const categoryUrl = `${seriesConfig.categoryBaseUrl}/${categoryFile}${DATA_CACHE_BUSTER}`
      const response = await fetchWithRetry(categoryUrl)
      let data
      try {
        data = await response.json()
      }
      catch (parseError) {
        const err = new Error(`Failed to parse JSON for category ${categoryFile}: ${parseError.message}`)
        errorType.value = 'parse'
        throw err
      }

      // 解密数据（使用 Worker）
      let wallpaperList
      const encoded = data.blob || data.payload
      if (encoded) {
        try {
          const decoded = await decodeDataWithWorker(encoded)
          wallpaperList = decoded.wallpapers || decoded
        }
        catch (err) {
          console.warn(`Failed to decode category ${categoryFile}:`, err)
          // 如果解码失败，尝试使用原始数据
          wallpaperList = data.wallpapers || []
          if (!wallpaperList || !Array.isArray(wallpaperList)) {
            const decodeErr = new Error(`Failed to decode category ${categoryFile}`)
            errorType.value = 'parse'
            throw decodeErr
          }
        }
      }
      else {
        wallpaperList = data.wallpapers || []
      }

      // 验证数据格式
      if (!Array.isArray(wallpaperList)) {
        const err = new Error(`Invalid category data format: ${categoryFile}`)
        errorType.value = 'format'
        throw err
      }

      // 转换 URL
      const transformedList = wallpaperList.map(w => transformWallpaperUrls(w))

      // 存入缓存
      categoryCache.value[cacheKey] = transformedList
      return transformedList
    }
    catch (e) {
      const errType = classifyError(e)
      errorType.value = errType
      console.error(`Failed to load category ${categoryFile}:`, e)
      throw e
    }
  }

  /**
   * 加载指定页的数据（分页模式核心方法）
   * @param {string} seriesId - 系列ID
   * @param {number} pageNum - 页码（从1开始）
   * @returns {Promise<Array>} 该页的壁纸列表
   */
  async function loadPage(seriesId, pageNum) {
    const cacheKey = `${seriesId}:page-${pageNum}`

    // 如果已有缓存，直接返回
    if (pageCache.value[cacheKey]) {
      return pageCache.value[cacheKey]
    }

    const seriesConfig = SERIES_CONFIG[seriesId]
    if (!seriesConfig) {
      throw new Error(`Invalid series: ${seriesId}`)
    }

    try {
      const pageUrl = `${seriesConfig.categoryBaseUrl}/page-${pageNum}.json${DATA_CACHE_BUSTER}`
      const response = await fetchWithRetry(pageUrl)
      const data = await response.json()

      // 解密数据
      let wallpaperList
      const encoded = data.blob || data.payload
      if (encoded) {
        wallpaperList = await decodeDataWithWorker(encoded)
      }
      else {
        wallpaperList = data.wallpapers || []
      }

      // 转换 URL
      const transformedList = wallpaperList.map(w => transformWallpaperUrls(w))

      // 存入缓存
      pageCache.value[cacheKey] = transformedList
      loadedPages.value.add(pageNum)

      return transformedList
    }
    catch (e) {
      console.error(`Failed to load page ${pageNum} for ${seriesId}:`, e)
      throw e
    }
  }

  /**
   * 初始化系列（分页模式 - 只加载第一页）
   * PC 端：显示第一页，用户翻页时加载对应页
   * 移动端：显示第一页，滚动时追加下一页
   * 注：Bing 系列会自动转发到 initBingSeries
   */
  async function initSeriesPaginated(seriesId, forceRefresh = false) {
    // 检查是否为 Bing 系列，转发到专用初始化方法
    const seriesConfig = SERIES_CONFIG[seriesId]
    if (seriesConfig?.isDaily) {
      return initBingSeries(seriesId, forceRefresh)
    }

    // 如果已加载相同系列且有数据，跳过
    if (!forceRefresh && currentLoadedSeries.value === seriesId && wallpapers.value.length > 0) {
      return
    }

    // 重置状态
    wallpapers.value = []
    loading.value = true
    error.value = null
    errorType.value = null
    currentLoadedSeries.value = seriesId
    loadedPages.value = new Set()
    currentPage.value = 1
    isBackgroundLoading.value = false
    // 重置筛选模式状态
    isFilterMode.value = false
    currentFilterCategory.value = null

    try {
      // 1. 加载索引文件（包含分页信息）
      const indexData = await loadSeriesIndex(seriesId)

      // 2. 设置分页状态
      expectedTotal.value = indexData.total || 0
      totalPages.value = indexData.totalPages || 0
      pageSize.value = indexData.pageSize || 30
      pagesInfo.value = indexData.pages || []

      // 3. 加载第一页数据
      if (totalPages.value > 0) {
        const firstPageData = await loadPage(seriesId, 1)
        wallpapers.value = firstPageData
        currentPage.value = 1
      }

      error.value = null
      errorType.value = null
    }
    catch (e) {
      console.error(`Failed to init series ${seriesId}:`, e)
      const errType = errorType.value || classifyError(e)
      errorType.value = errType
      error.value = getErrorMessage(e, errType, `系列: ${seriesId}`)
      wallpapers.value = []
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 跳转到指定页（PC 端分页用）
   * 替换当前显示的数据为目标页
   */
  async function goToPage(pageNum) {
    if (pageNum < 1 || pageNum > totalPages.value || pageNum === currentPage.value) {
      return
    }

    loading.value = true
    try {
      const pageData = await loadPage(currentLoadedSeries.value, pageNum)
      wallpapers.value = pageData
      currentPage.value = pageNum
    }
    catch (e) {
      console.error(`Failed to go to page ${pageNum}:`, e)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 加载下一页并追加（移动端无限滚动用）
   * 不替换数据，而是追加到现有列表
   */
  async function loadNextPage() {
    if (currentPage.value >= totalPages.value || loading.value) {
      return false
    }

    const nextPageNum = currentPage.value + 1
    loading.value = true

    try {
      const pageData = await loadPage(currentLoadedSeries.value, nextPageNum)
      wallpapers.value = [...wallpapers.value, ...pageData]
      currentPage.value = nextPageNum
      return true
    }
    catch (e) {
      console.error(`Failed to load next page:`, e)
      return false
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 获取当前月份（YYYY-MM 格式）
   */
  function getCurrentMonth() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  /**
   * 初始化每日 Bing 壁纸系列
   * Bing 系列默认显示当前月份数据，使用客户端分页
   */
  async function initBingSeries(seriesId, forceRefresh = false) {
    // 如果已加载相同系列且有数据，跳过
    if (!forceRefresh && currentLoadedSeries.value === seriesId && wallpapers.value.length > 0) {
      return
    }

    // 立即清空旧数据
    wallpapers.value = []

    loading.value = true
    error.value = null
    errorType.value = null
    currentLoadedSeries.value = seriesId
    loadedCategories.value = new Set()
    isBackgroundLoading.value = false
    initialLoadedCount.value = 0
    expectedTotal.value = 0

    // 立即设置筛选模式状态（当前月份）
    const currentMonth = getCurrentMonth()
    isFilterMode.value = true
    currentFilterCategory.value = currentMonth

    const seriesConfig = SERIES_CONFIG[seriesId]

    try {
      // 1. 加载 Bing 索引文件
      const indexUrl = seriesConfig.indexUrl
      const indexResponse = await fetchWithRetry(indexUrl)
      const indexData = await indexResponse.json()

      // 记录预期总数
      expectedTotal.value = indexData.total || 0

      // 2. 首屏优化：先加载最近数据 (latest.json)
      let initialWallpapers = []
      try {
        const latestUrl = seriesConfig.latestUrl
        const latestResponse = await fetchWithRetry(latestUrl)
        const latestData = await latestResponse.json()

        if (latestData.items && Array.isArray(latestData.items)) {
          initialWallpapers = latestData.items.map((item, index) =>
            transformBingWallpaper(item, index),
          )
        }
      }
      catch (e) {
        console.warn('Failed to load latest.json, will load from year data:', e)
      }

      // 3. 临时存储初始数据，用于后台加载完成前的筛选
      if (initialWallpapers.length > 0) {
        // 标记已加载的日期
        initialWallpapers.forEach((w) => {
          loadedCategories.value.add(w.date)
        })

        // 先筛选当前月份数据显示
        const currentMonthData = initialWallpapers.filter(w => w.category === currentMonth)
        filterModeAllData.value = currentMonthData
        wallpapers.value = currentMonthData
        expectedTotal.value = currentMonthData.length
        totalPages.value = Math.ceil(currentMonthData.length / 30) || 1
        pageSize.value = 30
        currentPage.value = 1
        loadedPages.value = new Set([1])
        initialLoadedCount.value = currentMonthData.length
      }

      // 4. 清除错误状态
      error.value = null
      errorType.value = null

      // 5. 后台加载所有年度数据，完成后更新当前月份数据
      if (indexData.years && Array.isArray(indexData.years) && indexData.years.length > 0) {
        isBackgroundLoading.value = true
        // 后台加载完成后会自动更新当前月份筛选
        loadBingYearDataSilently(seriesId, indexData.years)
      }
      else {
        // 没有年度数据，保存到缓存
        bingWallpapersCache.value = initialWallpapers
      }
    }
    catch (e) {
      console.error(`Failed to init Bing series:`, e)
      const errType = classifyError(e)
      errorType.value = errType
      error.value = getErrorMessage(e, errType, '每日 Bing 壁纸')
      wallpapers.value = []
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 设置 Bing 默认月份筛选（当前月份）
   */
  async function setDefaultBingMonth(allData) {
    const currentMonth = getCurrentMonth()

    // 筛选当前月份数据
    const currentMonthData = allData.filter(w => w.category === currentMonth)

    // 设置筛选模式状态
    isFilterMode.value = true
    currentFilterCategory.value = currentMonth
    filterModeAllData.value = currentMonthData

    // 设置分页状态
    pageSize.value = 30
    currentPage.value = 1
    expectedTotal.value = currentMonthData.length
    totalPages.value = Math.ceil(currentMonthData.length / 30) || 1
    loadedPages.value = new Set([1])

    // 设置 wallpapers 为当前月份数据
    wallpapers.value = currentMonthData
  }

  /**
   * 后台加载 Bing 年度数据（加载完成后设置当前月份筛选）
   */
  async function loadBingYearDataSilently(seriesId, years) {
    const seriesConfig = SERIES_CONFIG[seriesId]
    const allWallpapers = [...wallpapers.value] // 从初始数据开始

    try {
      // 按年份降序加载（最新的先加载）
      const sortedYears = [...years].sort((a, b) => b.year - a.year)

      for (const yearInfo of sortedYears) {
        // 检查系列是否已切换
        if (currentLoadedSeries.value !== seriesId) {
          return
        }

        try {
          const yearUrl = `${seriesConfig.yearBaseUrl}/${yearInfo.file}${DATA_CACHE_BUSTER}`
          const yearResponse = await fetchWithRetry(yearUrl)
          const yearData = await yearResponse.json()

          if (yearData.items && Array.isArray(yearData.items)) {
            // 过滤已加载的数据（避免重复）
            const newItems = yearData.items.filter(
              item => !loadedCategories.value.has(item.date),
            )

            if (newItems.length > 0) {
              // 转换数据格式
              const transformedItems = newItems.map((item, index) =>
                transformBingWallpaper(item, allWallpapers.length + index),
              )

              // 标记已加载
              newItems.forEach((item) => {
                loadedCategories.value.add(item.date)
              })

              // 收集到 allWallpapers（不立即更新 UI）
              allWallpapers.push(...transformedItems)
            }
          }

          // 批次间暂停，让 UI 有时间响应
          await delay(50)
        }
        catch (e) {
          console.warn(`Failed to load year data ${yearInfo.file}:`, e)
        }
      }

      // 所有年度数据加载完成
      if (currentLoadedSeries.value === seriesId) {
        isBackgroundLoading.value = false

        // 排序并保存到缓存
        allWallpapers.sort((a, b) => b.date.localeCompare(a.date))
        bingWallpapersCache.value = allWallpapers
        initialLoadedCount.value = allWallpapers.length

        // 设置默认月份筛选（当前月份）
        await setDefaultBingMonth(allWallpapers)
      }
    }
    catch (e) {
      console.error('Background loading Bing data failed:', e)
      isBackgroundLoading.value = false
    }
  }

  /**
   * 仅加载 Bing 数据到缓存（不更新 UI 状态）
   * 用于筛选模式下确保缓存数据可用
   */
  async function loadBingDataToCache(seriesId) {
    // 如果缓存已有数据，直接返回
    if (bingWallpapersCache.value && bingWallpapersCache.value.length > 0) {
      return
    }

    const seriesConfig = SERIES_CONFIG[seriesId]
    const allWallpapers = []
    const loadedDates = new Set()

    try {
      // 1. 加载索引文件
      const indexUrl = seriesConfig.indexUrl
      const indexResponse = await fetchWithRetry(indexUrl)
      const indexData = await indexResponse.json()

      // 2. 加载 latest.json
      try {
        const latestUrl = seriesConfig.latestUrl
        const latestResponse = await fetchWithRetry(latestUrl)
        const latestData = await latestResponse.json()

        if (latestData.items && Array.isArray(latestData.items)) {
          latestData.items.forEach((item, index) => {
            if (!loadedDates.has(item.date)) {
              allWallpapers.push(transformBingWallpaper(item, index))
              loadedDates.add(item.date)
            }
          })
        }
      }
      catch (e) {
        console.warn('Failed to load latest.json:', e)
      }

      // 3. 加载所有年度数据
      if (indexData.years && Array.isArray(indexData.years)) {
        const sortedYears = [...indexData.years].sort((a, b) => b.year - a.year)

        for (const yearInfo of sortedYears) {
          try {
            const yearUrl = `${seriesConfig.yearBaseUrl}/${yearInfo.file}${DATA_CACHE_BUSTER}`
            const yearResponse = await fetchWithRetry(yearUrl)
            const yearData = await yearResponse.json()

            if (yearData.items && Array.isArray(yearData.items)) {
              yearData.items.forEach((item, index) => {
                if (!loadedDates.has(item.date)) {
                  allWallpapers.push(transformBingWallpaper(item, allWallpapers.length + index))
                  loadedDates.add(item.date)
                }
              })
            }
          }
          catch (e) {
            console.warn(`Failed to load year data ${yearInfo.file}:`, e)
          }
        }
      }

      // 4. 排序并保存到缓存
      allWallpapers.sort((a, b) => b.date.localeCompare(a.date))
      bingWallpapersCache.value = allWallpapers
    }
    catch (e) {
      console.error('Failed to load Bing data to cache:', e)
      throw e
    }
  }

  /**
   * 初始化系列（首屏优化：先加载前3个分类，后台加载剩余分类）
   * 确保数据完整且不会出现数字递增的问题
   */
  async function initSeries(seriesId, forceRefresh = false) {
    // 如果已加载相同系列且有数据，跳过
    if (!forceRefresh && currentLoadedSeries.value === seriesId && wallpapers.value.length > 0) {
      return
    }

    // 检查是否为每日 Bing 系列
    const seriesConfig = SERIES_CONFIG[seriesId]
    if (seriesConfig?.isDaily) {
      return initBingSeries(seriesId, forceRefresh)
    }

    // 立即清空旧数据，避免切换系列时显示旧图片
    wallpapers.value = []

    loading.value = true
    error.value = null
    errorType.value = null
    currentLoadedSeries.value = seriesId
    loadedCategories.value = new Set()
    isBackgroundLoading.value = false
    initialLoadedCount.value = 0
    expectedTotal.value = 0

    try {
      // 1. 加载分类索引
      const indexData = await loadSeriesIndex(seriesId)

      // 2. 记录预期总数（从索引文件中获取，用于显示）
      expectedTotal.value = indexData.total || 0

      // 3. 首屏优化：只加载前3个分类（快速显示）
      const initialCategories = indexData.categories.slice(0, 3)
      const initialPromises = initialCategories.map(cat => loadCategory(seriesId, cat.file))
      const initialDataArrays = await Promise.all(initialPromises)

      // 4. 立即显示前3个分类的数据
      wallpapers.value = initialDataArrays.flat()

      // 5. 记录已加载的分类
      initialCategories.forEach((cat) => {
        loadedCategories.value.add(cat.file)
      })

      // 6. 记录初始加载数量（用于 UI 稳定显示）
      initialLoadedCount.value = wallpapers.value.length

      // 7. 清除错误状态
      error.value = null
      errorType.value = null

      // 8. 后台加载剩余分类（不阻塞主流程）
      const remainingCategories = indexData.categories.slice(3)
      if (remainingCategories.length > 0) {
        isBackgroundLoading.value = true
        // 后台加载，但不更新 wallpapers，而是收集完整数据后一次性更新
        loadRemainingCategoriesSilently(seriesId, remainingCategories)
      }
      else {
        // 如果没有剩余分类，直接设置预期总数为实际数量
        expectedTotal.value = wallpapers.value.length
      }
    }
    catch (e) {
      console.error(`Failed to init series ${seriesId}:`, e)
      const errType = errorType.value || classifyError(e)
      errorType.value = errType
      error.value = getErrorMessage(e, errType, `系列: ${seriesId}`)
      wallpapers.value = []
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 后台静默加载剩余分类（收集完整数据后一次性更新，避免数字递增）
   */
  async function loadRemainingCategoriesSilently(seriesId, categories) {
    try {
      // 批量加载：每次加载3个分类
      const BATCH_SIZE = 3
      const batches = []

      for (let i = 0; i < categories.length; i += BATCH_SIZE) {
        batches.push(categories.slice(i, i + BATCH_SIZE))
      }

      // 收集所有后台加载的数据
      const allRemainingData = []

      for (const batch of batches) {
        // 检查系列是否已切换，如果切换则停止加载
        if (currentLoadedSeries.value !== seriesId) {
          return
        }

        // 过滤已加载的分类
        const unloadedBatch = batch.filter(cat => !loadedCategories.value.has(cat.file))
        if (unloadedBatch.length === 0)
          continue

        try {
          // 并行加载批次内的所有分类
          const batchPromises = unloadedBatch.map(cat => loadCategory(seriesId, cat.file))
          const batchResults = await Promise.all(batchPromises)

          // 再次检查系列是否已切换（加载完成后）
          if (currentLoadedSeries.value !== seriesId) {
            return
          }

          // 收集本批次的数据（不立即更新 wallpapers）
          const batchData = batchResults.flat()
          allRemainingData.push(...batchData)

          // 标记本批次的分类为已加载
          unloadedBatch.forEach((cat) => {
            loadedCategories.value.add(cat.file)
          })

          // 批次间暂停，避免阻塞主线程
          await delay(150)
        }
        catch (e) {
          console.warn(`Failed to load batch:`, e)
          // 继续加载下一批次
        }
      }

      // 所有后台数据加载完成后，一次性更新 wallpapers（避免数字递增）
      if (currentLoadedSeries.value === seriesId && allRemainingData.length > 0) {
        // 先关闭后台加载标记，再更新数据
        // 这样 displayTotal 会立即显示完整数量，不会出现中间状态
        isBackgroundLoading.value = false
        // 一次性追加所有剩余数据
        wallpapers.value = [...wallpapers.value, ...allRemainingData]
        // 更新初始加载数量（现在显示完整数量）
        initialLoadedCount.value = wallpapers.value.length
      }
      else {
        // 如果没有数据或系列已切换，也要关闭后台加载标记
        isBackgroundLoading.value = false
      }
    }
    catch (e) {
      console.error('Background loading failed:', e)
      isBackgroundLoading.value = false
    }
  }

  /**
   * 后台加载剩余分类（不阻塞主流程）
   */
  async function loadRemainingCategories(seriesId, categories) {
    // 批量加载：每次加载3个分类后才更新一次 wallpapers
    const BATCH_SIZE = 3
    const batches = []

    for (let i = 0; i < categories.length; i += BATCH_SIZE) {
      batches.push(categories.slice(i, i + BATCH_SIZE))
    }

    for (const batch of batches) {
      // 检查系列是否已切换，如果切换则停止加载
      if (currentLoadedSeries.value !== seriesId) {
        return
      }

      // 过滤已加载的分类
      const unloadedBatch = batch.filter(cat => !loadedCategories.value.has(cat.file))
      if (unloadedBatch.length === 0)
        continue

      try {
        // 并行加载批次内的所有分类
        const batchPromises = unloadedBatch.map(cat => loadCategory(seriesId, cat.file))
        const batchResults = await Promise.all(batchPromises)

        // 再次检查系列是否已切换（加载完成后）
        if (currentLoadedSeries.value !== seriesId) {
          return
        }

        // 合并本批次的数据
        const batchData = batchResults.flat()

        // 一次性追加本批次的所有数据(减少响应式更新次数)
        wallpapers.value = [...wallpapers.value, ...batchData]

        // 标记本批次的分类为已加载
        unloadedBatch.forEach((cat) => {
          loadedCategories.value.add(cat.file)
        })

        // 批次间暂停，避免阻塞主线程
        await new Promise(resolve => setTimeout(resolve, 150))
      }
      catch (e) {
        console.warn(`Failed to load batch:`, e)
        // 继续加载下一批次
      }
    }

    // 后台加载完成，更新状态（仅当系列未切换时）
    if (currentLoadedSeries.value === seriesId) {
      isBackgroundLoading.value = false
      initialLoadedCount.value = wallpapers.value.length
    }
  }

  /**
   * 加载所有分类（用户主动触发）
   */
  async function loadAllCategories(seriesId) {
    const indexData = seriesIndexCache.value[seriesId]
    if (!indexData) {
      await loadSeriesIndex(seriesId)
      return
    }

    const unloadedCategories = indexData.categories.filter(cat =>
      !loadedCategories.value.has(cat.file),
    )

    if (unloadedCategories.length === 0) {
      return
    }

    loading.value = true
    try {
      await loadRemainingCategories(seriesId, unloadedCategories)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 根据 ID 获取单个壁纸
   */
  function getWallpaperById(id) {
    return wallpapers.value.find(w => w.id === id)
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
    if (seriesId) {
      // 清除指定系列的缓存
      delete seriesIndexCache.value[seriesId]
      Object.keys(categoryCache.value).forEach((key) => {
        if (key.startsWith(`${seriesId}:`)) {
          delete categoryCache.value[key]
        }
      })
      // 清除 Bing 缓存
      if (seriesId === 'bing') {
        bingWallpapersCache.value = null
      }
    }
    else {
      // 清除所有缓存
      seriesIndexCache.value = {}
      categoryCache.value = {}
      bingWallpapersCache.value = null
    }
  }

  // ========================================
  // 筛选模式相关方法
  // ========================================

  /**
   * 加载分类数据（用于筛选模式）
   * @param {string} categoryName - 分类名称（Bing 系列为 YYYY-MM 格式）
   * @returns {Promise<Array>} 该分类的所有壁纸
   */
  async function loadFilteredCategoryData(categoryName) {
    const seriesId = currentLoadedSeries.value
    const cacheKey = `${seriesId}:category:${categoryName}`

    // 检查缓存
    if (filterDataCache.value[cacheKey]) {
      return filterDataCache.value[cacheKey]
    }

    const seriesConfig = SERIES_CONFIG[seriesId]
    if (!seriesConfig) {
      throw new Error(`Invalid series: ${seriesId}`)
    }

    // Bing 系列特殊处理：从已加载的缓存数据中筛选
    if (seriesConfig.isDaily) {
      // 确保 Bing 数据已加载到缓存
      if (!bingWallpapersCache.value || bingWallpapersCache.value.length === 0) {
        // 如果缓存为空，需要先加载 Bing 数据
        // 但不能调用 initBingSeries，因为它会重置筛选模式状态
        // 直接加载数据到缓存
        await loadBingDataToCache(seriesId)
      }

      // 从缓存中筛选指定月份的数据（categoryName 格式为 YYYY-MM）
      const filteredList = (bingWallpapersCache.value || []).filter(w => w.category === categoryName)

      // 存入缓存
      filterDataCache.value[cacheKey] = filteredList
      return filteredList
    }

    try {
      // 其他系列：加载分类 JSON 文件
      const categoryUrl = `${seriesConfig.categoryBaseUrl}/${categoryName}.json${DATA_CACHE_BUSTER}`
      const response = await fetchWithRetry(categoryUrl)
      const data = await response.json()

      // 解密数据
      let wallpaperList
      const encoded = data.blob || data.payload
      if (encoded) {
        wallpaperList = await decodeDataWithWorker(encoded)
      }
      else {
        wallpaperList = data.wallpapers || []
      }

      // 转换 URL
      const transformedList = wallpaperList.map(w => transformWallpaperUrls(w))

      // 存入缓存
      filterDataCache.value[cacheKey] = transformedList
      return transformedList
    }
    catch (e) {
      console.error(`Failed to load category ${categoryName}:`, e)
      throw e
    }
  }

  /**
   * 切换到筛选模式（加载分类数据并启用客户端分页）
   * @param {string} categoryName - 分类名称（Bing 系列为 YYYY-MM 格式，'all' 表示全部）
   * @param {number} clientPageSize - 客户端分页大小
   */
  async function switchToFilterMode(categoryName, clientPageSize = 30) {
    const seriesId = currentLoadedSeries.value
    const seriesConfig = SERIES_CONFIG[seriesId]

    loading.value = true

    try {
      let categoryData

      // Bing 系列选择"全部月份"时，使用缓存的全量数据
      if (seriesConfig?.isDaily && categoryName === 'all') {
        // 确保缓存数据可用
        if (!bingWallpapersCache.value || bingWallpapersCache.value.length === 0) {
          await loadBingDataToCache(seriesId)
        }
        categoryData = bingWallpapersCache.value || []
      }
      else {
        // 加载该分类的所有数据
        categoryData = await loadFilteredCategoryData(categoryName)
      }

      // 设置筛选模式状态
      isFilterMode.value = true
      currentFilterCategory.value = categoryName
      filterModeAllData.value = categoryData

      // 设置分页状态
      pageSize.value = clientPageSize
      currentPage.value = 1
      expectedTotal.value = categoryData.length
      totalPages.value = Math.ceil(categoryData.length / clientPageSize) || 1
      loadedPages.value = new Set([1])

      // 设置 wallpapers 为分类数据（用于 categoryOptions 计算）
      // 实际显示由 Home.vue 的 paginatedWallpapers 控制
      wallpapers.value = categoryData
    }
    catch (e) {
      console.error(`Failed to switch to filter mode:`, e)
      error.value = `加载分类 "${categoryName}" 失败`
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 退出筛选模式（恢复到默认状态）
   * Bing 系列：恢复到当前月份
   * 其他系列：恢复到分页模式
   */
  async function exitFilterMode() {
    if (!isFilterMode.value) {
      return
    }

    const seriesId = currentLoadedSeries.value
    const seriesConfig = SERIES_CONFIG[seriesId]

    // Bing 系列：恢复到当前月份（而非全量数据）
    if (seriesConfig?.isDaily && bingWallpapersCache.value && bingWallpapersCache.value.length > 0) {
      await setDefaultBingMonth(bingWallpapersCache.value)
      return
    }

    // 其他系列：重置筛选模式状态并恢复分页
    isFilterMode.value = false
    currentFilterCategory.value = null
    filterModeAllData.value = []

    // 重新加载分页数据
    await initSeriesPaginated(seriesId, true)
  }

  /**
   * 筛选模式下跳转到指定页（客户端分页）
   */
  function goToFilterPage(pageNum) {
    if (!isFilterMode.value || pageNum < 1 || pageNum > totalPages.value) {
      return
    }

    const startIdx = (pageNum - 1) * pageSize.value
    const endIdx = Math.min(startIdx + pageSize.value, filterModeAllData.value.length)
    wallpapers.value = filterModeAllData.value.slice(startIdx, endIdx)
    currentPage.value = pageNum
    loadedPages.value.add(pageNum)
  }

  /**
   * 筛选模式下加载下一页（客户端分页，用于移动端无限滚动）
   */
  function loadNextFilterPage() {
    if (!isFilterMode.value || currentPage.value >= totalPages.value) {
      return false
    }

    const nextPageNum = currentPage.value + 1
    const startIdx = (nextPageNum - 1) * pageSize.value
    const endIdx = Math.min(startIdx + pageSize.value, filterModeAllData.value.length)
    const nextPageData = filterModeAllData.value.slice(startIdx, endIdx)

    // 追加数据
    wallpapers.value = [...wallpapers.value, ...nextPageData]
    currentPage.value = nextPageNum
    loadedPages.value.add(nextPageNum)

    return true
  }

  return {
    // State
    wallpapers,
    loading,
    error,
    errorType,
    currentLoadedSeries,
    loadedCategories,
    isBackgroundLoading,
    // 分页状态
    currentPage,
    totalPages,
    pageSize,
    pagesInfo,
    loadedPages,
    expectedTotal,
    // 筛选模式状态
    isFilterMode,
    currentFilterCategory,
    filterModeAllData,
    // Getters
    total,
    displayTotal,
    loaded,
    statistics,
    // 分页计算属性
    hasPrevPage,
    hasNextPage,
    isFirstPage,
    isLastPage,
    // Actions
    initSeries,
    initSeriesPaginated, // 分页模式初始化
    loadAllCategories,
    loadCategory,
    loadPage, // 加载指定页
    goToPage, // PC 端翻页
    loadNextPage, // 移动端加载下一页
    // 筛选模式 Actions
    switchToFilterMode, // 切换到筛选模式
    exitFilterMode, // 退出筛选模式
    goToFilterPage, // 筛选模式翻页
    loadNextFilterPage, // 筛选模式加载下一页
    // 其他
    getWallpaperById,
    getWallpaperIndex,
    getPrevWallpaper,
    getNextWallpaper,
    clearCache,
  }
})
