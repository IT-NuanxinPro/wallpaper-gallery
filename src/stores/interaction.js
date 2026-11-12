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
import { formatInteractionError } from '@/utils/interaction/errors'
import { buildWallpaperAssetKey } from '@/utils/wallpaper/identity'

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
  const libraryLoaded = ref(false)
  const libraryOwner = ref('')
  const libraryError = ref('')
  let libraryRequest
  let libraryLoadedAt = 0

  // 正在进行中的操作（防止重复点击）
  const pendingOperations = ref(new Set())
  const operationErrors = ref({})
  let operationGeneration = 0

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
      const targetCollectionId = collectionId || defaultCollectionId.value
      if (!targetCollectionId)
        return
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

  const isLiked = computed(() => (wallpaperOrKey, series) => {
    const assetKey = buildWallpaperAssetKey(wallpaperOrKey, series)
    return likedBySeriesMap.value[series]?.has(assetKey) || false
  })

  const isCollected = computed(() => (wallpaperOrKey, series) => {
    const assetKey = buildWallpaperAssetKey(wallpaperOrKey, series)
    return collectedBySeriesMap.value[series]?.has(assetKey) || false
  })

  const isPending = computed(() => (assetKey) => {
    return pendingOperations.value.has(assetKey)
  })
  const getOperationError = computed(() => key => operationErrors.value[key] || '')

  // Library 按系列分组的喜欢数据
  const likesBySeries = computed(() => {
    return groupInteractionsBySeries(allLikes.value)
  })

  const collectionsBySeries = computed(() => {
    return groupInteractionsBySeries(allCollectionItems.value)
  })

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
  async function handleToggleLike(wallpaperOrKey, series) {
    const assetKey = buildWallpaperAssetKey(wallpaperOrKey, series)
    if (!assetKey || pendingOperations.value.has(`like:${assetKey}`))
      return { success: false, ignored: true }

    const seriesSet = likedBySeriesMap.value[series] || new Set()
    const wasLiked = seriesSet.has(assetKey)
    const nextLiked = !wasLiked
    const operationKey = `like:${assetKey}`
    const generation = operationGeneration
    const previousItems = allLikes.value.filter(item => item.asset_key === assetKey)

    operationErrors.value[operationKey] = ''
    updateSeriesSet(likedBySeriesMap, series, assetKey, nextLiked)
    syncLikesSnapshot(assetKey, nextLiked)

    pendingOperations.value.add(`like:${assetKey}`)

    try {
      const liked = await toggleLike(assetKey, series)
      if (generation !== operationGeneration)
        return { success: false, ignored: true }
      updateSeriesSet(likedBySeriesMap, series, assetKey, liked)
      syncLikesSnapshot(assetKey, liked)
      const delta = Number(liked) - Number(wasLiked)
      stats.value = {
        ...stats.value,
        likes: Math.max(0, stats.value.likes + delta),
      }

      const { usePopularityStore } = await import('@/stores/popularity')
      if (generation !== operationGeneration)
        return { success: false, ignored: true }
      const popularityStore = usePopularityStore()
      popularityStore.adjustLikeCount(assetKey, delta)
      return { success: true, liked }
    }
    catch (err) {
      if (generation !== operationGeneration)
        return { success: false, ignored: true }
      updateSeriesSet(likedBySeriesMap, series, assetKey, wasLiked)
      allLikes.value = [...previousItems, ...allLikes.value.filter(item => item.asset_key !== assetKey)]
      console.warn('[interactionStore] toggleLike failed:', err)
      operationErrors.value[operationKey] = formatInteractionError(err).message
      return { success: false, liked: wasLiked, error: err, feedbackHandled: true }
    }
    finally {
      if (generation === operationGeneration)
        pendingOperations.value.delete(operationKey)
    }
  }

  /**
   * 切换收藏（乐观更新）
   */
  async function handleToggleCollect(wallpaperOrKey, series) {
    const assetKey = buildWallpaperAssetKey(wallpaperOrKey, series)
    if (!assetKey || pendingOperations.value.has(`collect:${assetKey}`))
      return { success: false, ignored: true }

    const seriesSet = collectedBySeriesMap.value[series] || new Set()
    const wasCollected = seriesSet.has(assetKey)
    const nextCollected = !wasCollected
    const operationKey = `collect:${assetKey}`
    const generation = operationGeneration
    const previousItems = allCollectionItems.value.filter(item => item.asset_key === assetKey)

    pendingOperations.value.add(operationKey)
    operationErrors.value[operationKey] = ''
    // 首次收藏也立即回显；默认收藏夹的查询属于同一次待完成操作。
    updateSeriesSet(collectedBySeriesMap, series, assetKey, nextCollected)
    syncCollectionsSnapshot(assetKey, nextCollected)

    try {
      if (!defaultCollectionId.value) {
        const collectionId = await fetchDefaultCollectionId()
        if (generation !== operationGeneration)
          return { success: false, ignored: true }
        defaultCollectionId.value = collectionId
      }

      if (!defaultCollectionId.value) {
        throw new Error('未找到默认收藏夹')
      }

      syncCollectionsSnapshot(assetKey, nextCollected, defaultCollectionId.value)

      const collected = await toggleCollect(assetKey, series, defaultCollectionId.value)
      if (generation !== operationGeneration)
        return { success: false, ignored: true }
      updateSeriesSet(collectedBySeriesMap, series, assetKey, collected)
      syncCollectionsSnapshot(assetKey, collected, defaultCollectionId.value)
      const delta = Number(collected) - Number(wasCollected)
      stats.value = {
        ...stats.value,
        collections: Math.max(0, stats.value.collections + delta),
      }

      const { usePopularityStore } = await import('@/stores/popularity')
      if (generation !== operationGeneration)
        return { success: false, ignored: true }
      const popularityStore = usePopularityStore()
      popularityStore.adjustCollectCount(assetKey, delta)
      return { success: true, collected }
    }
    catch (err) {
      if (generation !== operationGeneration)
        return { success: false, ignored: true }
      updateSeriesSet(collectedBySeriesMap, series, assetKey, wasCollected)
      allCollectionItems.value = [...previousItems, ...allCollectionItems.value.filter(item => item.asset_key !== assetKey)]
      console.warn('[interactionStore] toggleCollect failed:', err)
      operationErrors.value[operationKey] = formatInteractionError(err).message
      return { success: false, collected: wasCollected, error: err, feedbackHandled: true }
    }
    finally {
      if (generation === operationGeneration)
        pendingOperations.value.delete(operationKey)
    }
  }

  /**
   * 加载 Library 全量数据
   */
  async function loadLibraryData({ userId = '', force = false } = {}) {
    if (userId && libraryOwner.value !== userId) {
      if (libraryOwner.value)
        $reset()
      libraryOwner.value = userId
    }
    if (libraryRequest)
      return libraryRequest
    if (!force && userId && libraryLoaded.value && Date.now() - libraryLoadedAt < 60000)
      return

    const generation = operationGeneration
    libraryLoading.value = true
    libraryError.value = ''
    libraryRequest = (async () => {
      try {
        const [likes, collections, statsData] = await Promise.all([
          fetchAllUserLikes(),
          fetchAllUserCollectionItems(),
          fetchUserInteractionStats(),
        ])
        if (generation !== operationGeneration)
          return
        allLikes.value = likes
        allCollectionItems.value = collections
        stats.value = statsData
        statsLoaded.value = true
        libraryLoaded.value = true
        libraryLoadedAt = Date.now()

        const likeGroups = groupInteractionsBySeries(likes)
        const collectionGroups = groupInteractionsBySeries(collections)
        Object.keys(likeGroups).forEach((series) => {
          likedBySeriesMap.value[series] = new Set(likeGroups[series].map(item => item.asset_key))
          collectedBySeriesMap.value[series] = new Set(collectionGroups[series].map(item => item.asset_key))
          loadedSeries.value.add(series)
        })
      }
      catch (err) {
        if (generation === operationGeneration)
          libraryError.value = '壁纸库暂时无法更新，请重试'
        console.warn('[interactionStore] loadLibraryData failed:', err)
      }
      finally {
        if (generation === operationGeneration) {
          libraryLoading.value = false
          libraryRequest = undefined
        }
      }
    })()
    return libraryRequest
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
    operationGeneration++
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
    libraryLoaded.value = false
    libraryOwner.value = ''
    libraryError.value = ''
    libraryRequest = undefined
    libraryLoadedAt = 0
    pendingOperations.value = new Set()
    operationErrors.value = {}
  }

  return {
    likedBySeriesMap,
    collectedBySeriesMap,
    loading,
    libraryLoading,
    libraryLoaded,
    libraryOwner,
    libraryError,
    stats,
    statsLoaded,
    allLikes,
    allCollectionItems,

    isLiked,
    isCollected,
    isPending,
    getOperationError,
    likesBySeries,
    collectionsBySeries,

    prefetchForSeries,
    handleToggleLike,
    handleToggleCollect,
    loadLibraryData,
    loadStats,
    $reset,
  }
})
