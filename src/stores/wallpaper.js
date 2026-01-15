// ========================================
// 壁纸数据管理 Store (优化版 - 按需加载 + Web Worker)
// ========================================

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { isWorkerAvailable, workerDecodeAndParse } from '@/composables/useWorker'
import { decodeData } from '@/utils/codec'
import { DATA_CACHE_BUSTER, SERIES_CONFIG } from '@/utils/constants'
import { buildBingPreviewUrl, buildBingThumbnailUrl, buildBingUHDUrl, buildImageUrl } from '@/utils/format'
import { LRUCache } from '@/utils/lruCache'

export const useWallpaperStore = defineStore('wallpaper', () => {
  // ========================================
  // State
  // ========================================

  // 系列数据缓存（只存储索引信息，最多缓存 5 个系列）
  const seriesIndexCache = ref({})

  // 分类数据缓存（使用 LRU 缓存，最多保留 15 个分类，约 60MB）
  const categoryCache = new LRUCache(15)

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

  // 重试配置
  const MAX_RETRIES = 3
  const RETRY_DELAY = 1000 // 1秒

  // 请求版本号（用于防止竞态条件）
  let requestVersion = 0

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
      if (!indexData.categories || !Array.isArray(indexData.categories)) {
        const err = new Error('Invalid index data format: missing categories array')
        errorType.value = 'format'
        throw err
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
    if (categoryCache.has(cacheKey)) {
      return categoryCache.get(cacheKey)
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

      // 存入缓存（LRU 会自动淘汰旧数据）
      categoryCache.set(cacheKey, transformedList)
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
   * 初始化每日 Bing 壁纸系列
   * Bing 系列使用年度数据文件结构，不同于其他系列的分类结构
   * 优化：只加载当前年份数据，用户切换月份时按需加载其他年份
   */
  async function initBingSeries(seriesId, forceRefresh = false) {
    // 如果已加载相同系列且有数据，跳过
    if (!forceRefresh && currentLoadedSeries.value === seriesId && wallpapers.value.length > 0) {
      return
    }

    // 检查缓存：如果有缓存的 Bing 数据，直接使用
    if (!forceRefresh && bingWallpapersCache.value && bingWallpapersCache.value.length > 0) {
      wallpapers.value = bingWallpapersCache.value
      currentLoadedSeries.value = seriesId
      loading.value = false
      error.value = null
      errorType.value = null
      isBackgroundLoading.value = false
      expectedTotal.value = bingWallpapersCache.value.length
      // 恢复 loadedCategories，防止切换系列后数据重复加载
      loadedCategories.value = new Set()
      bingWallpapersCache.value.forEach((w) => {
        loadedCategories.value.add(w.date)
        // 同时添加年份标记
        const year = w.date.substring(0, 4)
        loadedCategories.value.add(year)
      })
      return
    }

    // 递增请求版本号，用于防止竞态条件
    const currentRequestVersion = ++requestVersion

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

    const seriesConfig = SERIES_CONFIG[seriesId]

    try {
      // 1. 加载 Bing 索引文件
      const indexUrl = seriesConfig.indexUrl
      const indexResponse = await fetchWithRetry(indexUrl)
      const indexData = await indexResponse.json()

      // 检查请求是否过期
      if (requestVersion !== currentRequestVersion) {
        return
      }

      // 保存索引数据到缓存
      seriesIndexCache.value[seriesId] = indexData

      // 2. 只加载当前年份的数据（一次性加载，不分两步）
      const currentYear = new Date().getFullYear()
      const currentYearInfo = indexData.years?.find(y => y.year === currentYear)

      if (currentYearInfo) {
        const yearUrl = `${seriesConfig.yearBaseUrl}/${currentYearInfo.file}${DATA_CACHE_BUSTER}`
        const yearResponse = await fetchWithRetry(yearUrl)
        const yearData = await yearResponse.json()

        // 再次检查请求是否过期
        if (requestVersion !== currentRequestVersion) {
          return
        }

        if (yearData.items && Array.isArray(yearData.items)) {
          // 转换数据格式
          const transformedItems = yearData.items.map((item, index) =>
            transformBingWallpaper(item, index),
          )

          // 按日期降序排序
          transformedItems.sort((a, b) => b.date.localeCompare(a.date))

          // 一次性设置数据
          wallpapers.value = transformedItems
          initialLoadedCount.value = transformedItems.length
          expectedTotal.value = transformedItems.length

          // 标记已加载的年份
          loadedCategories.value.add(currentYear.toString())

          // 标记已加载的日期
          transformedItems.forEach((w) => {
            loadedCategories.value.add(w.date)
          })
        }
      }

      // 3. 清除错误状态
      error.value = null
      errorType.value = null
    }
    catch (e) {
      // 如果请求已过期，不处理错误
      if (requestVersion !== currentRequestVersion) {
        return
      }
      console.error(`Failed to init Bing series:`, e)
      const errType = classifyError(e)
      errorType.value = errType
      error.value = getErrorMessage(e, errType, '每日 Bing 壁纸')
      wallpapers.value = []
    }
    finally {
      // 只有当请求未过期时才更新 loading 状态
      if (requestVersion === currentRequestVersion) {
        loading.value = false
      }
    }
  }

  /**
   * 加载指定年份的 Bing 数据（用户切换月份时按需加载）
   */
  async function loadBingYear(year) {
    const seriesId = 'bing'
    const seriesConfig = SERIES_CONFIG[seriesId]

    // 如果已加载该年份，跳过
    if (loadedCategories.value.has(year.toString())) {
      return
    }

    // 记录当前请求版本号
    const currentRequestVersion = requestVersion

    // 获取索引数据
    let indexData = seriesIndexCache.value[seriesId]
    if (!indexData) {
      const indexUrl = seriesConfig.indexUrl
      const indexResponse = await fetchWithRetry(indexUrl)
      indexData = await indexResponse.json()

      // 检查请求是否过期
      if (requestVersion !== currentRequestVersion) {
        return
      }

      seriesIndexCache.value[seriesId] = indexData
    }

    // 查找年份信息
    const yearInfo = indexData.years?.find(y => y.year === year)
    if (!yearInfo) {
      console.warn(`Year ${year} not found in Bing index`)
      return
    }

    try {
      const yearUrl = `${seriesConfig.yearBaseUrl}/${yearInfo.file}${DATA_CACHE_BUSTER}`
      const yearResponse = await fetchWithRetry(yearUrl)
      const yearData = await yearResponse.json()

      // 检查请求是否过期
      if (requestVersion !== currentRequestVersion) {
        return
      }

      if (yearData.items && Array.isArray(yearData.items)) {
        // 过滤已加载的数据
        const newItems = yearData.items.filter(
          item => !loadedCategories.value.has(item.date),
        )

        if (newItems.length > 0) {
          // 转换数据格式
          const transformedItems = newItems.map((item, index) =>
            transformBingWallpaper(item, wallpapers.value.length + index),
          )

          // 标记已加载
          newItems.forEach((item) => {
            loadedCategories.value.add(item.date)
          })

          // 合并并排序
          const merged = [...wallpapers.value, ...transformedItems]
          merged.sort((a, b) => b.date.localeCompare(a.date))
          wallpapers.value = merged

          // 更新计数
          initialLoadedCount.value = wallpapers.value.length
          expectedTotal.value = wallpapers.value.length
        }
      }

      // 标记年份已加载
      loadedCategories.value.add(year.toString())

      // 更新缓存
      bingWallpapersCache.value = [...wallpapers.value]
    }
    catch (e) {
      console.warn(`Failed to load Bing year ${year}:`, e)
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

    // 递增请求版本号，用于防止竞态条件
    const currentRequestVersion = ++requestVersion

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

      // 检查请求是否过期（用户已切换到其他系列）
      if (requestVersion !== currentRequestVersion) {
        return
      }

      // 2. 记录预期总数（从索引文件中获取，用于显示）
      expectedTotal.value = indexData.total || 0

      // 3. 首屏优化：只加载前3个分类（快速显示）
      const initialCategories = indexData.categories.slice(0, 3)
      const initialPromises = initialCategories.map(cat => loadCategory(seriesId, cat.file))
      const initialDataArrays = await Promise.all(initialPromises)

      // 再次检查请求是否过期
      if (requestVersion !== currentRequestVersion) {
        return
      }

      // 4. 立即显示前3个分类的数据（预排序，确保数据层有序）
      const initialData = initialDataArrays.flat()
      initialData.sort((a, b) => {
        // 按日期降序（最新优先）
        const dateA = new Date(a.createdAt)
        const dateB = new Date(b.createdAt)
        const dateDiff = dateB - dateA

        // 日期相同时按文件名排序，确保稳定性
        if (dateDiff === 0) {
          return a.filename.localeCompare(b.filename)
        }
        return dateDiff
      })
      wallpapers.value = initialData

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
        // 后台加载，传入请求版本号用于检查
        loadRemainingCategoriesSilently(seriesId, remainingCategories, currentRequestVersion)
      }
      else {
        // 如果没有剩余分类，直接设置预期总数为实际数量
        expectedTotal.value = wallpapers.value.length
      }
    }
    catch (e) {
      // 如果请求已过期，不处理错误
      if (requestVersion !== currentRequestVersion) {
        return
      }
      console.error(`Failed to init series ${seriesId}:`, e)
      const errType = errorType.value || classifyError(e)
      errorType.value = errType
      error.value = getErrorMessage(e, errType, `系列: ${seriesId}`)
      wallpapers.value = []
    }
    finally {
      // 只有当请求未过期时才更新 loading 状态
      if (requestVersion === currentRequestVersion) {
        loading.value = false
      }
    }
  }

  /**
   * 后台静默加载剩余分类（收集完整数据后一次性更新，避免数字递增）
   * @param {string} seriesId - 系列 ID
   * @param {Array} categories - 待加载的分类列表
   * @param {number} expectedVersion - 期望的请求版本号，用于检测竞态条件
   */
  async function loadRemainingCategoriesSilently(seriesId, categories, expectedVersion) {
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
        // 检查请求版本号，如果已过期则停止加载
        if (requestVersion !== expectedVersion) {
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

          // 再次检查请求版本号（加载完成后）
          if (requestVersion !== expectedVersion) {
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
      // 再次检查请求版本号，确保数据仍然有效
      if (requestVersion === expectedVersion && allRemainingData.length > 0) {
        // 先关闭后台加载标记，再更新数据
        // 这样 displayTotal 会立即显示完整数量，不会出现中间状态
        isBackgroundLoading.value = false

        // 合并数据并按日期+文件名排序，确保数据层有序
        // 这样 UI 层排序时结果稳定，不会导致图片跳动
        const merged = [...wallpapers.value, ...allRemainingData]
        merged.sort((a, b) => {
          // 按日期降序（最新优先）
          const dateA = new Date(a.createdAt)
          const dateB = new Date(b.createdAt)
          const dateDiff = dateB - dateA

          // 日期相同时按文件名排序，确保稳定性
          if (dateDiff === 0) {
            return a.filename.localeCompare(b.filename)
          }
          return dateDiff
        })

        wallpapers.value = merged
        // 更新初始加载数量（现在显示完整数量）
        initialLoadedCount.value = wallpapers.value.length
      }
      else if (requestVersion === expectedVersion) {
        // 如果没有数据但请求仍有效，也要关闭后台加载标记
        isBackgroundLoading.value = false
      }
      // 如果请求已过期，不做任何操作
    }
    catch (e) {
      // 只有请求未过期时才处理错误
      if (requestVersion === expectedVersion) {
        console.error('Background loading failed:', e)
        isBackgroundLoading.value = false
      }
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
      categoryCache.deleteByPrefix(`${seriesId}:`)
      // 清除 Bing 缓存
      if (seriesId === 'bing') {
        bingWallpapersCache.value = null
      }
    }
    else {
      // 清除所有缓存
      seriesIndexCache.value = {}
      categoryCache.clear()
      bingWallpapersCache.value = null
    }
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
    // Getters
    total,
    displayTotal,
    loaded,
    statistics,
    // Actions
    initSeries,
    loadAllCategories,
    loadCategory,
    loadBingYear,
    getWallpaperById,
    getWallpaperIndex,
    getPrevWallpaper,
    getNextWallpaper,
    clearCache,
  }
})
