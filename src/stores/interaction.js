import { ElMessage } from 'element-plus'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  fetchAllUserCollectionItems,
  fetchAllUserLikes,
  fetchDefaultCollectionId,
  fetchUserCollections,
  fetchUserInteractionStats,
  fetchUserLikes,
  toggleCollect,
  toggleLike,
} from '@/services/interactionService'
import { buildWallpaperAssetKey, normalizeWallpaperFilename } from '@/utils/wallpaper/identity'

export const useInteractionStore = defineStore('interaction', () => {
  // ========================================
  // State
  // ========================================

  // 按系列缓存的喜欢/收藏 Set，用于主页 O(1) 状态回显
  const likedBySeriesMap = ref({}) // { desktop: Set<assetKey>, ... }
  const collectedBySeriesMap = ref({}) // { desktop: Set<assetKey>, ... }

  // 已加载的系列标记
  const loadedSeries = ref(new Set())

  // 默认收藏夹 ID（缓存）
  const defaultCollectionId = ref(null)

  // Library 页面使用的全量数据
  const allLikes = ref([]) // [{ asset_key, created_at }]
  const allCollectionItems = ref([]) // [{ asset_key, added_at, collection_id }]

  // 统计数据
  const stats = ref({ likes: 0, collections: 0, downloads: 0 })
  const statsLoaded = ref(false)

  // 加载状态
  const loading = ref(false)
  const libraryLoading = ref(false)

  // 正在进行中的操作（防止重复点击）
  const pendingOperations = ref(new Set())

  // ========================================
  // Getters
  // ========================================

  function groupInteractionsBySeries(items) {
    const grouped = { desktop: [], video: [], bing: [], mobile: [], avatar: [] }
    const seenBySeries = {
      desktop: new Set(),
      video: new Set(),
      bing: new Set(),
      mobile: new Set(),
      avatar: new Set(),
    }

    items.forEach((item) => {
      const [series] = item.asset_key.split(':')
      if (!grouped[series] || seenBySeries[series].has(item.asset_key)) {
        return
      }

      grouped[series].push(item)
      seenBySeries[series].add(item.asset_key)
    })

    return grouped
  }

  function updateSeriesSet(targetMap, series, assetKey, shouldInclude) {
    const nextSet = new Set(targetMap.value[series] || [])

    if (shouldInclude) {
      nextSet.add(assetKey)
    }
    else {
      nextSet.delete(assetKey)
    }

    targetMap.value[series] = nextSet
  }

  function syncLikesSnapshot(assetKey, shouldInclude) {
    if (shouldInclude) {
      if (!allLikes.value.some(item => item.asset_key === assetKey)) {
        allLikes.value = [{ asset_key: assetKey, created_at: new Date().toISOString() }, ...allLikes.value]
      }
      return
    }

    allLikes.value = allLikes.value.filter(item => item.asset_key !== assetKey)
  }

  function syncCollectionsSnapshot(assetKey, shouldInclude, collectionId = defaultCollectionId.value) {
    if (shouldInclude) {
      const targetCollectionId = collectionId || defaultCollectionId.value || 'default'
      const hasExisting = allCollectionItems.value.some(item =>
        item.asset_key === assetKey && item.collection_id === targetCollectionId,
      )

      if (!hasExisting) {
        allCollectionItems.value = [
          { asset_key: assetKey, added_at: new Date().toISOString(), collection_id: targetCollectionId },
          ...allCollectionItems.value,
        ]
      }
      return
    }

    allCollectionItems.value = allCollectionItems.value.filter(item => item.asset_key !== assetKey)
  }

  const isLiked = computed(() => (filename, series) => {
    const assetKey = buildWallpaperAssetKey(filename, series)
    return likedBySeriesMap.value[series]?.has(assetKey) || false
  })

  const isCollected = computed(() => (filename, series) => {
    const assetKey = buildWallpaperAssetKey(filename, series)
    return collectedBySeriesMap.value[series]?.has(assetKey) || false
  })

  const isPending = computed(() => (assetKey) => {
    return pendingOperations.value.has(assetKey)
  })

  // Library 按系列分组的喜欢数据
  const likesBySeries = computed(() => {
    return groupInteractionsBySeries(allLikes.value)
  })

  // Library 按系列分组的收藏数据
  const collectionsBySeries = computed(() => {
    return groupInteractionsBySeries(allCollectionItems.value)
  })

  function formatInteractionError(err) {
    const message = err?.message || err?.details || err?.hint || ''

    if (message === '未登录') {
      return {
        message: '请先登录后再操作',
        type: 'warning',
      }
    }

    if (message === 'Supabase 未配置') {
      return {
        message,
        type: 'warning',
      }
    }

    return {
      message: message || '操作失败，请稍后重试',
      type: 'error',
    }
  }

  // ========================================
  // Actions
  // ========================================

  /**
   * 为指定系列预取用户的喜欢和收藏状态（主页调用）
   */
  async function prefetchForSeries(series) {
    if (!series || loadedSeries.value.has(series))
      return

    loading.value = true
    try {
      const [likes, collections] = await Promise.all([
        fetchUserLikes(series),
        fetchUserCollections(series),
      ])

      likedBySeriesMap.value[series] = new Set(likes)
      collectedBySeriesMap.value[series] = new Set(collections)
      loadedSeries.value.add(series)
    }
    catch (err) {
      console.warn('[interactionStore] prefetchForSeries failed:', err)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 切换喜欢（乐观更新）
   */
  async function handleToggleLike(filename, series) {
    const assetKey = buildWallpaperAssetKey(filename, series)
    if (!assetKey || pendingOperations.value.has(`like:${assetKey}`))
      return { success: false, ignored: true }

    const seriesSet = likedBySeriesMap.value[series] || new Set()
    const wasLiked = seriesSet.has(assetKey)
    const nextLiked = !wasLiked

    // 乐观更新
    updateSeriesSet(likedBySeriesMap, series, assetKey, nextLiked)
    syncLikesSnapshot(assetKey, nextLiked)

    pendingOperations.value.add(`like:${assetKey}`)

    try {
      const liked = await toggleLike(filename, series)
      // 同步更新统计
      stats.value = {
        ...stats.value,
        likes: stats.value.likes + (liked ? 1 : -1),
      }
      // 乐观更新壁纸级聚合计数
      const { usePopularityStore } = await import('@/stores/popularity')
      const popularityStore = usePopularityStore()
      const normalizedFilename = normalizeWallpaperFilename(filename, series)
      popularityStore.adjustLikeCount(normalizedFilename, liked ? 1 : -1)
      ElMessage.success(liked ? '已加入我的喜欢' : '已取消喜欢')
      return { success: true, liked }
    }
    catch (err) {
      // 回滚
      updateSeriesSet(likedBySeriesMap, series, assetKey, wasLiked)
      syncLikesSnapshot(assetKey, wasLiked)
      console.warn('[interactionStore] toggleLike failed:', err)
      const feedback = formatInteractionError(err)
      ElMessage[feedback.type](feedback.message)
      return { success: false, liked: wasLiked, error: err }
    }
    finally {
      pendingOperations.value.delete(`like:${assetKey}`)
    }
  }

  /**
   * 切换收藏（乐观更新）
   */
  async function handleToggleCollect(filename, series) {
    const assetKey = buildWallpaperAssetKey(filename, series)
    if (!assetKey || pendingOperations.value.has(`collect:${assetKey}`))
      return { success: false, ignored: true }

    // 确保有默认收藏夹 ID
    if (!defaultCollectionId.value) {
      defaultCollectionId.value = await fetchDefaultCollectionId()
    }

    const seriesSet = collectedBySeriesMap.value[series] || new Set()
    const wasCollected = seriesSet.has(assetKey)
    const nextCollected = !wasCollected

    // 乐观更新
    updateSeriesSet(collectedBySeriesMap, series, assetKey, nextCollected)
    syncCollectionsSnapshot(assetKey, nextCollected, defaultCollectionId.value)

    pendingOperations.value.add(`collect:${assetKey}`)

    try {
      const collected = await toggleCollect(filename, series, defaultCollectionId.value)
      stats.value = {
        ...stats.value,
        collections: stats.value.collections + (collected ? 1 : -1),
      }
      // 乐观更新壁纸级聚合计数
      const { usePopularityStore } = await import('@/stores/popularity')
      const popularityStore = usePopularityStore()
      const normalizedFilename = normalizeWallpaperFilename(filename, series)
      popularityStore.adjustCollectCount(normalizedFilename, collected ? 1 : -1)
      ElMessage.success(collected ? '已加入收藏' : '已取消收藏')
      return { success: true, collected }
    }
    catch (err) {
      // 回滚
      updateSeriesSet(collectedBySeriesMap, series, assetKey, wasCollected)
      syncCollectionsSnapshot(assetKey, wasCollected, defaultCollectionId.value)
      console.warn('[interactionStore] toggleCollect failed:', err)
      const feedback = formatInteractionError(err)
      ElMessage[feedback.type](feedback.message)
      return { success: false, collected: wasCollected, error: err }
    }
    finally {
      pendingOperations.value.delete(`collect:${assetKey}`)
    }
  }

  /**
   * 加载 Library 全量数据
   */
  async function loadLibraryData() {
    libraryLoading.value = true
    try {
      const [likes, collections, statsData] = await Promise.all([
        fetchAllUserLikes(),
        fetchAllUserCollectionItems(),
        fetchUserInteractionStats(),
      ])

      allLikes.value = likes
      allCollectionItems.value = collections
      stats.value = statsData
      statsLoaded.value = true

      // 同步更新系列级缓存
      const likeMap = {}
      const collectMap = {}

      likes.forEach(({ asset_key }) => {
        const [series] = asset_key.split(':')
        if (!likeMap[series])
          likeMap[series] = new Set()
        likeMap[series].add(asset_key)
      })

      collections.forEach(({ asset_key }) => {
        const [series] = asset_key.split(':')
        if (!collectMap[series])
          collectMap[series] = new Set()
        collectMap[series].add(asset_key)
      })

      // 合并到系列缓存（保留已有系列的数据，覆盖新数据）
      Object.keys(likeMap).forEach((series) => {
        likedBySeriesMap.value[series] = likeMap[series]
        loadedSeries.value.add(series)
      })

      Object.keys(collectMap).forEach((series) => {
        collectedBySeriesMap.value[series] = collectMap[series]
        loadedSeries.value.add(series)
      })
    }
    catch (err) {
      console.warn('[interactionStore] loadLibraryData failed:', err)
    }
    finally {
      libraryLoading.value = false
    }
  }

  async function loadStats(forceRefresh = false) {
    if (statsLoaded.value && !forceRefresh) {
      return stats.value
    }

    try {
      const statsData = await fetchUserInteractionStats()
      stats.value = statsData
      statsLoaded.value = true
      return statsData
    }
    catch (err) {
      console.warn('[interactionStore] loadStats failed:', err)
      return stats.value
    }
  }

  /**
   * 重置所有状态（登出时调用）
   */
  function $reset() {
    likedBySeriesMap.value = {}
    collectedBySeriesMap.value = {}
    loadedSeries.value = new Set()
    defaultCollectionId.value = null
    allLikes.value = []
    allCollectionItems.value = []
    stats.value = { likes: 0, collections: 0, downloads: 0 }
    statsLoaded.value = false
    loading.value = false
    libraryLoading.value = false
    pendingOperations.value = new Set()
  }

  return {
    // State
    likedBySeriesMap,
    collectedBySeriesMap,
    loading,
    libraryLoading,
    stats,
    statsLoaded,
    allLikes,
    allCollectionItems,

    // Getters
    isLiked,
    isCollected,
    isPending,
    likesBySeries,
    collectionsBySeries,

    // Actions
    prefetchForSeries,
    handleToggleLike,
    handleToggleCollect,
    loadLibraryData,
    loadStats,
    $reset,
  }
})
