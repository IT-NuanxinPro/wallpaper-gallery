import { handleDownloadFile } from '../../server/download-file.js'

export function onRequest({ request, env }) {
  return handleDownloadFile(request, env)
}
