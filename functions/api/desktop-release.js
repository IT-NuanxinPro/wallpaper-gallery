import { handleDesktopReleaseRequest } from '../../server/desktop-release.js'

export function onRequest(context) {
  return handleDesktopReleaseRequest(context.request, { assets: context.env.ASSETS })
}
