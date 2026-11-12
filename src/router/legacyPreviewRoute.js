import { BROWSE_ROUTE_NAMES } from '../composables/home/browseShell.js'
import { validateBrowseQuery } from '../composables/home/useBrowseState.js'
import { encodeWallpaperShareToken } from '../utils/wallpaper/share.js'

export function resolveLegacyPreviewRoute(route) {
  if (!BROWSE_ROUTE_NAMES.includes(route.name) || !Object.hasOwn(route.query, 'image'))
    return null
  const { image, ...query } = route.query
  const token = encodeWallpaperShareToken(validateBrowseQuery({ image }, { series: route.meta.series }).image)
  const returnTo = { path: route.path, query, hash: route.hash || '' }
  return token
    ? { location: { path: `/wallpaper/${token}`, replace: true }, returnTo }
    : { location: { ...returnTo, replace: true }, returnTo: null }
}
