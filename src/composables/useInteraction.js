import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useInteractionStore } from '@/stores/interaction'
import { buildWallpaperAssetKey, resolveWallpaperSeries } from '@/utils/wallpaper/identity'

/**
 * 为单个壁纸卡片提供交互逻辑（喜欢/收藏）
 * @param {import('vue').Ref<object>} wallpaper - 壁纸对象
 * @param {import('vue').Ref<string>} series - 当前系列
 */
export function useInteraction(wallpaper, series) {
  const authStore = useAuthStore()
  const interactionStore = useInteractionStore()
  const { isAuthenticated } = storeToRefs(authStore)

  const currentSeries = computed(() => resolveWallpaperSeries(wallpaper.value, series.value || ''))
  const assetKey = computed(() => buildWallpaperAssetKey(wallpaper.value, currentSeries.value))
  const likePending = computed(() => interactionStore.isPending(`like:${assetKey.value}`))
  const collectPending = computed(() => interactionStore.isPending(`collect:${assetKey.value}`))
  const likeError = computed(() => interactionStore.getOperationError(`like:${assetKey.value}`))
  const collectError = computed(() => interactionStore.getOperationError(`collect:${assetKey.value}`))

  const liked = computed(() =>
    isAuthenticated.value && interactionStore.isLiked(wallpaper.value, currentSeries.value),
  )

  const collected = computed(() =>
    isAuthenticated.value && interactionStore.isCollected(wallpaper.value, currentSeries.value),
  )

  async function toggleLike() {
    if (!isAuthenticated.value) {
      return { needsLogin: true }
    }

    return interactionStore.handleToggleLike(wallpaper.value, currentSeries.value)
  }

  async function toggleCollect() {
    if (!isAuthenticated.value) {
      return { needsLogin: true }
    }

    return interactionStore.handleToggleCollect(wallpaper.value, currentSeries.value)
  }

  return {
    liked,
    collected,
    likePending,
    collectPending,
    likeError,
    collectError,
    isAuthenticated,
    toggleLike,
    toggleCollect,
  }
}
