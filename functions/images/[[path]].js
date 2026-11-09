import { handleImageRequest } from '../../server/image-proxy.js'

export function onRequest(context) {
  return handleImageRequest(context.request, {
    cache: globalThis.caches?.default,
    waitUntil: promise => context.waitUntil(promise),
  })
}
