import { handleOnlinePresence } from '../../server/online-presence.js'

export function onRequest(context) {
  return handleOnlinePresence(context.request, context.env)
}
