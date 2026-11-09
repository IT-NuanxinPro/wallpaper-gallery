// 热门统计使用资源身份定位，累计与期间互动分别排序。
import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import { loadStaticStats, loadStatsFromSupabase } from '@/services/statsService'
import { refreshStatsMetadata } from '@/utils/stats/snapshot'
import { buildWallpaperAssetKey, getWallpaperIdentity, resolveWallpaperSeries } from '@/utils/wallpaper/identity'

const EMPTY_METADATA = { schema: 0, exportedAt: null, periodStartedAt: null, weekStart: null, monthStart: null, periodAvailable: false, stale: false }

export const usePopularityStore = defineStore('popularity', () => {
  const statsMap = ref(new Map())
  const likeCollectOverrides = ref(new Map())
  const loading = ref(false)
  const currentSeries = ref('')
  const statsMetadata = ref({ ...EMPTY_METADATA })
  const snapshotError = ref('')
  let requestVersion = 0
  let loadedAt = 0

  function refreshPeriods() {
    statsMetadata.value = refreshStatsMetadata(statsMetadata.value)
  }

  function refreshVisiblePeriods() {
    if (document.visibilityState === 'visible')
      refreshPeriods()
  }

  if (typeof document !== 'undefined') {
    const periodTimer = setInterval(refreshPeriods, 60 * 1000)
    document.addEventListener('visibilitychange', refreshVisiblePeriods)
    onScopeDispose(() => {
      clearInterval(periodTimer)
      document.removeEventListener('visibilitychange', refreshVisiblePeriods)
    })
  }

  function resolveKey(target) {
    if (typeof target === 'string')
      return buildWallpaperAssetKey(target, currentSeries.value)
    return getWallpaperIdentity(target, resolveWallpaperSeries(target, currentSeries.value)).assetKey
  }

  function isCanonicalKey(key) {
    return key.startsWith('bing:bing-') || key.includes(':path:')
  }

  function getCount(target, field) {
    const key = resolveKey(target)
    if (!key.startsWith(`${currentSeries.value}:`))
      return null
    const stats = statsMap.value.get(key)
    // 新快照的 legacy 行仅保留历史总量，不能套到同名的新资源上。
    if (statsMetadata.value.schema === 2)
      return isCanonicalKey(key) && !stats?.legacy_ambiguous ? (stats?.[field] || 0) : null
    // Bing 日期天然唯一；其他旧文件名无完整目录证明，不推测单图计数。
    return key.startsWith('bing:bing-') && stats ? (stats[field] || 0) : null
  }

  function createPopularityMap(period = 'all') {
    const entries = [...statsMap.value].filter(([key, stats]) => isCanonicalKey(key) && !stats.legacy_ambiguous)
    const viewsField = period === 'all' ? 'views' : `${period}_views`
    const downloadsField = period === 'all' ? 'downloads' : `${period}_downloads`
    const available = period === 'all' || statsMetadata.value[`${period}Available`]
    return new Map(entries.map(([key, stats]) => {
      const views = available ? (stats[viewsField] || 0) : 0
      const downloads = available ? (stats[downloadsField] || 0) : 0
      return [key, { score: views + downloads * 2, views, downloads }]
    }).sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0])).map(([key, stats], index) => [key, { ...stats, rank: index + 1 }]))
  }

  const popularityMap = computed(() => createPopularityMap())
  const weeklyPopularityMap = computed(() => createPopularityMap('week'))
  const monthlyPopularityMap = computed(() => createPopularityMap('month'))
  const allTimeData = computed(() => [...popularityMap.value].map(([assetKey, stats]) => ({
    asset_key: assetKey,
    image_id: assetKey.slice(assetKey.indexOf(':') + 1),
    view_count: stats.views,
    download_count: stats.downloads,
    popularity_score: stats.score,
  })))
  const hasData = computed(() => statsMap.value.size > 0)

  function getPopularRank(target) {
    return popularityMap.value.get(resolveKey(target))?.rank || 0
  }

  function getDownloadCount(target) {
    return getCount(target, 'downloads')
  }

  function getViewCount(target) {
    return getCount(target, 'views')
  }

  function getLikeCount(target) {
    const base = getCount(target, 'likes')
    const delta = likeCollectOverrides.value.get(resolveKey(target))?.likes || 0
    return base === null ? null : Math.max(0, base + delta)
  }

  function getCollectCount(target) {
    const base = getCount(target, 'collects')
    const delta = likeCollectOverrides.value.get(resolveKey(target))?.collects || 0
    return base === null ? null : Math.max(0, base + delta)
  }

  function getPopularityScore(target, period = 'all') {
    const map = period === 'week' ? weeklyPopularityMap.value : period === 'month' ? monthlyPopularityMap.value : popularityMap.value
    return map.get(resolveKey(target))?.score || 0
  }

  function getPeriodScore(target, period) {
    return getPopularityScore(target, period)
  }

  function adjustCount(target, field, delta) {
    const key = resolveKey(target)
    if (!isCanonicalKey(key))
      return
    const current = likeCollectOverrides.value.get(key) || { likes: 0, collects: 0 }
    const newMap = new Map(likeCollectOverrides.value)
    newMap.set(key, { ...current, [field]: current[field] + delta })
    likeCollectOverrides.value = newMap
  }

  function adjustLikeCount(target, delta) {
    adjustCount(target, 'likes', delta)
  }

  function adjustCollectCount(target, delta) {
    adjustCount(target, 'collects', delta)
  }

  async function fetchPopularityData(series, forceRefresh = false) {
    if (!forceRefresh && currentSeries.value === series && statsMetadata.value.schema && !snapshotError.value && Date.now() - loadedAt < 60 * 60 * 1000) {
      statsMetadata.value = refreshStatsMetadata(statsMetadata.value)
      return
    }

    const currentRequestVersion = ++requestVersion
    if (currentSeries.value !== series) {
      statsMap.value = new Map()
      statsMetadata.value = { ...EMPTY_METADATA }
      likeCollectOverrides.value = new Map()
    }
    currentSeries.value = series
    loading.value = true
    snapshotError.value = ''

    try {
      let data
      try {
        data = await loadStaticStats(series, forceRefresh)
      }
      catch {
        data = await loadStatsFromSupabase(series)
      }
      if (currentRequestVersion !== requestVersion)
        return
      statsMap.value = data
      statsMetadata.value = data.metadata || { ...EMPTY_METADATA }
      loadedAt = Date.now()
      snapshotError.value = statsMetadata.value.schema === 1
        ? '旧版统计快照尚未更新，单图与期间统计暂不可用'
        : ''
      likeCollectOverrides.value = new Map()
    }
    catch {
      if (currentRequestVersion === requestVersion)
        snapshotError.value = statsMetadata.value.exportedAt ? '统计更新失败，当前显示上次快照' : '统计暂不可用'
    }
    finally {
      if (currentRequestVersion === requestVersion)
        loading.value = false
    }
  }

  function clearData() {
    requestVersion++
    loadedAt = 0
    statsMap.value = new Map()
    likeCollectOverrides.value = new Map()
    currentSeries.value = ''
    statsMetadata.value = { ...EMPTY_METADATA }
    snapshotError.value = ''
    loading.value = false
  }

  return {
    statsMap,
    loading,
    currentSeries,
    statsMetadata,
    snapshotError,
    allTimeData,
    popularityMap,
    weeklyPopularityMap,
    monthlyPopularityMap,
    hasData,
    fetchPopularityData,
    getPopularRank,
    getDownloadCount,
    getViewCount,
    getLikeCount,
    getCollectCount,
    getPopularityScore,
    getPeriodScore,
    adjustLikeCount,
    adjustCollectCount,
    clearData,
  }
})
