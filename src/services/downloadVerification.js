import { shallowRef } from 'vue'

export const downloadChallenge = shallowRef(null)
let pending
let sequence = 0

function abortError() {
  return new DOMException('下载已取消', 'AbortError')
}

export function settleDownloadChallenge(id, token = '') {
  if (!pending || pending.id !== id)
    return
  const current = pending
  pending = null
  downloadChallenge.value = null
  current.signal?.removeEventListener('abort', current.abort)
  if (token)
    current.resolve(token)
  else
    current.reject(abortError())
}

/** 只在需要验证时挂载组件；取消、换图和卸载立即结束等待。 */
export function requestDownloadChallenge(siteKey, { signal } = {}) {
  signal?.throwIfAborted()
  if (pending)
    return Promise.reject(new Error('请先完成当前下载验证'))
  return new Promise((resolve, reject) => {
    const id = ++sequence
    const abort = () => settleDownloadChallenge(id)
    pending = { id, resolve, reject, signal, abort }
    signal?.addEventListener('abort', abort, { once: true })
    downloadChallenge.value = { id, siteKey }
  })
}
