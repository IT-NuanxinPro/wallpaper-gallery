// ========================================
// 热门数据管理 Store（重构版）
// ========================================
// 使用静态 JSON + 乐观更新，不再直接查询 Supabase 视图

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getOptimisticQueue,
  incrementOptimistic,
} from '@/services/localStatsCache'
import {
  loadStaticStats,
  loadStatsFromSupabase,
} from '@/services/statsService'

export const usePopularityStore = defineStore('popularity', () => {
  // ========================================
  // State
  // ========================================

  // 统计数据 Map<imageId, {views, downloads}>
  const statsMap = ref(new Map())

  // 加载状态
  const loading = ref(false)

  // 当前加载的系列
  const currentSeries = ref('')

  // 是否已加载
  const loaded = ref(false)

  // ========================================
  // Getters
  // ========================================

  // 热门数据（按浏览量排序的数组）
  const allTimeData = computed(() => {
    const entries = Array.from(statsMap.value.entries())
    return entries
      .map(([imageId, stats]) => ({
        filename: imageId,
        image_id: imageId,
        view_count: stats.views || 0,
        download_count: stats.downloads || 0,
        popularity_score: (stats.views || 0) + (stats.downloads || 0) * 2,
      }))
      .sort((a, b) => b.popularity_score - a.popularity_score)
  })

  // 热门数据 Map（用于快速查找）
  const popularityMap = computed(() => {
    const map = new Map()
    allTimeData.value.forEach((item, index) => {
      map.set(item.filename, {
        rank: index + 1,
        score: item.popularity_score,
        downloads: item.download_count,
        views: item.view_count,
      })
    })
    return map
  })

  // 兼容旧 API：weeklyMap 和 monthlyMap 返回相同数据
  // 因为静态化后不再区分时间范围
  const weeklyMap = computed(() => popularityMap.value)
  const monthlyMap = computed(() => popularityMap.value)

  // 兼容旧 API
  const weeklyData = computed(() => allTimeData.value)
  const monthlyData = computed(() => allTimeData.value)

  // 是否有热门数据
  const hasData = computed(() => statsMap.value.size > 0)

  // ========================================
  // Actions
  // ========================================

  /**
   * 获取指定文件的热门排名
   */
  function getPopularRank(filename) {
    return popularityMap.value.get(filename)?.rank || 0
  }

  /**
   * 获取指定文件的下载次数
   */
  function getDownloadCount(filename) {
    const stats = statsMap.value.get(filename)
    if (!stats)
      return 0

    // 合并乐观更新
    const queue = getOptimisticQueue()
    const optimistic = queue.downloads[filename] || 0
    return (stats.downloads || 0) + optimistic
  }

  /**
   * 获取指定文件的浏览次数
   */
  function getViewCount(filename) {
    const stats = statsMap.value.get(filename)
    if (!stats)
      return 0

    // 合并乐观更新
    const queue = getOptimisticQueue()
    const optimistic = queue.views[filename] || 0
    return (stats.views || 0) + optimistic
  }

  /**
   * 获取指定文件的热门分数
   */
  function getPopularityScore(filename, _timeRange = 'all') {
    // 不再区分时间范围
    return popularityMap.value.get(filename)?.score || 0
  }

  /**
   * 本地乐观增加浏览量
   * @param {string} imageId - 图片 ID
   */
  function incrementLocalView(imageId) {
    incrementOptimistic(imageId, 'view')

    // 同时更新内存中的 statsMap（立即反映到 UI）
    const current = statsMap.value.get(imageId) || { views: 0, downloads: 0 }
    statsMap.value.set(imageId, {
      ...current,
      views: current.views + 1,
    })
  }

  /**
   * 本地乐观增加下载量
   * @param {string} imageId - 图片 ID
   */
  function incrementLocalDownload(imageId) {
    incrementOptimistic(imageId, 'download')

    // 同时更新内存中的 statsMap（立即反映到 UI）
    const current = statsMap.value.get(imageId) || { views: 0, downloads: 0 }
    statsMap.value.set(imageId, {
      ...current,
      downloads: current.downloads + 1,
    })
  }

  /**
   * 加载热门数据
   * @param {string} series - 系列名称
   * @param {boolean} forceRefresh - 是否强制刷新
   */
  async function fetchPopularityData(series, forceRefresh = false) {
    // 如果已加载且不强制刷新，直接返回
    if (!forceRefresh && currentSeries.value === series && hasData.value) {
      return
    }

    loading.value = true
    currentSeries.value = series

    try {
      // 优先从静态文件加载
      let data = await loadStaticStats(series, forceRefresh)

      // 如果静态文件为空，尝试从 Supabase 加载（降级方案）
      if (data.size === 0) {
        if (import.meta.env.DEV) {
          console.log(`[PopularityStore] 静态文件为空，尝试从 Supabase 加载: ${series}`)
        }
        data = await loadStatsFromSupabase(series, 500)
      }

      statsMap.value = data
      loaded.value = true

      if (import.meta.env.DEV) {
        console.log(`[PopularityStore] 加载完成: ${series}, ${data.size} 条数据`)
      }
    }
    catch (err) {
      console.error('[PopularityStore] 加载热门数据失败:', err)
      statsMap.value = new Map()
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 清除热门数据
   */
  function clearData() {
    statsMap.value = new Map()
    currentSeries.value = ''
    loaded.value = false
  }

  return {
    // State
    statsMap,
    loading,
    currentSeries,
    loaded,
    // Getters (兼容旧 API)
    allTimeData,
    weeklyData,
    monthlyData,
    popularityMap,
    weeklyMap,
    monthlyMap,
    hasData,
    // Actions
    fetchPopularityData,
    getPopularRank,
    getDownloadCount,
    getViewCount,
    getPopularityScore,
    incrementLocalView,
    incrementLocalDownload,
    clearData,
  }
})
