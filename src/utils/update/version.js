export function parseVersion(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(value))
    return null
  const parts = value.split('.').map(Number)
  return parts.every(Number.isSafeInteger) ? parts : null
}

export function compareVersions(a, b) {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left || !right)
    return null
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index])
      return left[index] > right[index] ? 1 : -1
  }
  return 0
}

function releaseLink(value) {
  try {
    const url = new URL(value)
    const trusted = url.protocol === 'https:' && url.hostname === 'github.com' && !url.port && !url.username && !url.password
      && url.pathname.startsWith('/IT-NuanxinPro/wallpaper-gallery/releases/')
    return trusted ? url.href : ''
  }
  catch { return '' }
}

export function validateDesktopRelease(value, userAgent = '') {
  if (value?.available !== true || !parseVersion(value.version))
    return null
  const releaseUrl = releaseLink(value.releaseUrl)
  const notesUrl = releaseLink(value.notesUrl) || releaseUrl
  if (!releaseUrl)
    return null
  const platform = /windows/i.test(userAgent) ? 'windows' : /macintosh|mac os x/i.test(userAgent) ? 'macos' : /linux/i.test(userAgent) ? 'linux' : ''
  return { latest: value.version, releaseUrl, notesUrl, downloadUrl: releaseLink(value.downloads?.[platform]) || releaseUrl, publishedAt: typeof value.publishedAt === 'string' ? value.publishedAt : '' }
}

export function isLegacyCapabilityError(error) {
  return /command[^\n]*(?:not found|does not exist)|unknown command|not allowed|not permitted|permission[^\n]*(?:denied|not found)|forbidden/i.test(String(error))
}

// 超时覆盖 fetch 和响应体；即使平台忽略 abort，调用方也按时结束。
export async function fetchUpdateJson(url, { fetchImpl = fetch, timeoutMs = 8000, signal } = {}) {
  const controller = new AbortController()
  let timer
  let cancel
  const cancelled = new Promise((resolve, reject) => {
    cancel = () => {
      controller.abort()
      reject(new Error('UPDATE_CANCELLED'))
    }
    timer = setTimeout(cancel, timeoutMs)
    signal?.addEventListener('abort', cancel, { once: true })
    if (signal?.aborted)
      cancel()
  })
  try {
    return await Promise.race([
      cancelled,
      (async () => {
        const response = await fetchImpl(url, { cache: 'no-store', signal: controller.signal })
        if (!response.ok)
          throw new Error('UPDATE_UNAVAILABLE')
        return response.json()
      })(),
    ])
  }
  finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}
