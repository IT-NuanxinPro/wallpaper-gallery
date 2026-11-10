import { handleWallpaperDetailRequest } from '../../server/wallpaper-detail.js'

export function onRequest(context) {
  return handleWallpaperDetailRequest(context.request, { assets: context.env.ASSETS })
}
