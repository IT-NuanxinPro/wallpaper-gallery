import { buildImageFetchUrls } from './imageDelivery'

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_BYTES = 32 * 1024 * 1024

function isAllowedType(type, allowMedia) {
  return type.startsWith('image/') || (allowMedia && (!type || type.startsWith('video/') || type === 'application/octet-stream'))
}

async function readImage(response, signal, maxBytes, allowMedia) {
  const type = response.headers?.get('Content-Type')?.split(';')[0].trim().toLowerCase() || ''
  if (!response.ok || (response.headers && !isAllowedType(type, allowMedia)) || Number(response.headers?.get('Content-Length')) > maxBytes) {
    void response.body?.cancel().catch(() => {})
    throw new Error(!response.ok ? '图片来源暂不可用' : !isAllowedType(type, allowMedia) ? '响应不是有效图片' : '图片超过大小限制')
  }

  const reader = response.body?.getReader()
  let blob
  if (reader) {
    const chunks = []
    let size = 0
    const cancel = () => {
      void reader.cancel().catch(() => {})
    }
    signal.addEventListener('abort', cancel, { once: true })
    try {
      while (true) {
        signal.throwIfAborted()
        const { done, value } = await reader.read()
        signal.throwIfAborted()
        if (done)
          break
        size += value.byteLength
        if (size > maxBytes) {
          cancel()
          throw new Error('图片超过大小限制')
        }
        chunks.push(value)
      }
      blob = new Blob(chunks, { type })
    }
    finally {
      signal.removeEventListener('abort', cancel)
      reader.releaseLock()
    }
  }
  else {
    // 兼容缺少流式 Response 的旧 WebView，完成后仍检查实际大小和媒体类型。
    blob = await response.blob()
  }
  signal.throwIfAborted()
  if (!blob.size)
    throw new Error('图片内容为空')
  if (blob.size > maxBytes)
    throw new Error('图片超过大小限制')
  if (!isAllowedType(blob.type.split(';')[0].trim().toLowerCase(), allowMedia))
    throw new Error('响应不是有效图片')
  return blob
}

/** 超时覆盖所有来源与完整响应体；取消和超时均停止来源回退。 */
export async function fetchWallpaperImage(url, { signal, timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES, allowMedia = false } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(maxBytes) || maxBytes <= 0)
    throw new Error('图片加载限制无效')
  const controller = new AbortController()
  const abort = () => controller.abort(new DOMException('图片加载已取消', 'AbortError'))
  if (signal?.aborted)
    abort()
  else
    signal?.addEventListener('abort', abort, { once: true })
  let timer
  const aborted = new Promise((_, reject) => {
    const rejectAbort = () => reject(controller.signal.reason)
    if (controller.signal.aborted)
      rejectAbort()
    else
      controller.signal.addEventListener('abort', rejectAbort, { once: true })
    timer = setTimeout(() => controller.abort(new DOMException('图片加载超时，请重试', 'TimeoutError')), timeoutMs)
  })
  const load = async () => {
    let lastError = new Error('图片地址不可用')
    for (const source of buildImageFetchUrls(url)) {
      controller.signal.throwIfAborted()
      try {
        const response = await fetch(source, { signal: controller.signal, credentials: 'omit' })
        if (controller.signal.aborted)
          void response.body?.cancel().catch(() => {})
        controller.signal.throwIfAborted()
        return await readImage(response, controller.signal, maxBytes, allowMedia)
      }
      catch (error) {
        controller.signal.throwIfAborted()
        lastError = error
      }
    }
    throw lastError
  }
  try {
    return await Promise.race([load(), aborted])
  }
  finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
