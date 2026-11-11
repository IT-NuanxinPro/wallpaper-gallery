import { decodeWallpaperShareToken } from './share.js'

/** 详情分享地址携带稳定资源身份，直达与刷新也能立即高亮所属系列。 */
export function getActiveWallpaperSeries(route, currentSeries = 'desktop') {
  if (route.path === '/')
    return currentSeries
  if (route.name === 'WallpaperDetail' || route.path.startsWith('/wallpaper/')) {
    const token = route.params?.token || route.path.slice('/wallpaper/'.length)
    return decodeWallpaperShareToken(token).split(':')[0] || ''
  }
  const series = route.path.slice(1)
  return ['desktop', 'mobile', 'avatar', 'bing', 'video'].includes(series) ? series : ''
}
