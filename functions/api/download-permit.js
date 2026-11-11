import { handleDownloadPermit } from '../../server/download-permit.js'

export function onRequest({ request, env }) {
  return handleDownloadPermit(request, env)
}
