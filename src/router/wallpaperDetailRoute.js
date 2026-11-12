let pending

// 路由和卡片共用预加载任务；失败后允许下一次交互重试。
export function loadWallpaperDetailView() {
  pending ||= import('@/views/WallpaperDetail.vue').catch((error) => {
    pending = null
    throw error
  })
  return pending
}
