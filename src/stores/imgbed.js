/**
 * src/stores/imgbed.js
 *
 * 替代 wallpaperStore 中从 CDN JSON 加载数据的逻辑。
 * 提供相同的接口，从自建 /api/wallpapers 读取数据。
 *
 * 使用方式：
 *   在需要获取壁纸数据的地方，改为调用此 store 的方法，
 *   或直接调用 src/services/imgbed/api.js 中的函数。
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchWallpapers, fetchRandom, STYLES, COLORS, ORIENTATIONS } from '@/services/imgbed/api'

export const useImgbedStore = defineStore('imgbed', () => {
  // ======== State ========
  const wallpapers = ref([])
  const loading = ref(false)
  const error = ref(null)
  const total = ref(0)
  const currentPage = ref(1)
  const totalPages = ref(1)

  // 当前筛选条件
  const filters = ref({
    orientation: '',   // horizontal | vertical | square
    style: '',         // 动漫_二次元 等
    color: '',         // 偏蓝 等
    tags: '',          // 额外标签
  })

  // 分类元数据（供筛选面板使用）
  const CATEGORY_META = { STYLES, COLORS, ORIENTATIONS }

  // ======== Getters ========
  const loaded = computed(() => wallpapers.value.length > 0)
  const hasMore = computed(() => currentPage.value < totalPages.value)

  // ======== Actions ========

  /**
   * 加载壁纸列表（替换原 initSeries 逻辑）
   */
  async function loadWallpapers(opts = {}) {
    loading.value = true
    error.value = null

    try {
      const result = await fetchWallpapers({
        ...filters.value,
        ...opts,
        page: opts.page || 1,
        limit: opts.limit || 30,
        thumb: true,
        thumbWidth: 800,
      })

      wallpapers.value = opts.append
        ? [...wallpapers.value, ...result.items]
        : result.items

      total.value = result.total
      currentPage.value = result.page
      totalPages.value = result.totalPages
    } catch (e) {
      error.value = e.message
      console.error('[ImgbedStore] loadWallpapers failed:', e)
    } finally {
      loading.value = false
    }
  }

  /**
   * 加载下一页（追加模式）
   */
  async function loadMore() {
    if (!hasMore.value || loading.value) return
    await loadWallpapers({ page: currentPage.value + 1, append: true })
  }

  /**
   * 设置筛选条件并重新加载
   */
  async function applyFilters(newFilters) {
    filters.value = { ...filters.value, ...newFilters }
    currentPage.value = 1
    await loadWallpapers({ page: 1 })
  }

  /**
   * 清除筛选条件
   */
  async function clearFilters() {
    filters.value = { orientation: '', style: '', color: '', tags: '' }
    await loadWallpapers({ page: 1 })
  }

  /**
   * 获取随机壁纸
   */
  async function getRandomWallpaper(opts = {}) {
    return fetchRandom({ ...filters.value, ...opts })
  }

  /**
   * 重置 store
   */
  function reset() {
    wallpapers.value = []
    loading.value = false
    error.value = null
    total.value = 0
    currentPage.value = 1
    totalPages.value = 1
    filters.value = { orientation: '', style: '', color: '', tags: '' }
  }

  return {
    // State
    wallpapers,
    loading,
    error,
    total,
    currentPage,
    totalPages,
    filters,
    // Getters
    loaded,
    hasMore,
    // Meta
    CATEGORY_META,
    // Actions
    loadWallpapers,
    loadMore,
    applyFilters,
    clearFilters,
    getRandomWallpaper,
    reset,
  }
})
