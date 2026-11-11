import { buildWallpaperAssetKey } from '@/utils/wallpaper/identity'
import { encodeWallpaperShareToken } from '@/utils/wallpaper/share'
import { requestDownloadChallenge } from './downloadVerification'

export function downloadProtectionEnabled() {
  return import.meta.env.VITE_DOWNLOAD_PROTECTION_ENABLED === 'true'
}

export async function authorizeWallpaperDownload(wallpaper, series, { signal, fetchImpl = fetch, challenge = requestDownloadChallenge } = {}) {
  const resource = encodeWallpaperShareToken(buildWallpaperAssetKey(wallpaper, series))
  if (!resource)
    throw new Error('无法识别这张壁纸，请刷新后重试')
  let challengeToken = ''
  // 最多两轮验证，网络异常与验证失败都不能落到原始地址下载。
  for (let attempt = 0; attempt < 3; attempt++) {
    signal?.throwIfAborted()
    const timeout = AbortSignal.timeout(12000)
    let response
    try {
      response = await fetchImpl('/api/download-permit', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource, challengeToken }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      })
    }
    catch {
      signal?.throwIfAborted()
      throw new Error('下载验证服务暂时不可用，请稍后重试')
    }
    signal?.throwIfAborted()
    let result
    try {
      result = await response.json()
    }
    catch { throw new Error('下载验证服务暂时不可用，请稍后重试') }
    if (response.ok && result.code === 'allowed' && /^\/api\/download-file\?ticket=[\w-]+\.[\w-]+$/.test(result.downloadUrl || ''))
      return new URL(result.downloadUrl, globalThis.location?.origin || 'https://wallpaper.061129.xyz').href
    if (response.status === 429)
      throw new Error('下载较频繁，请等待 60 秒后重试')
    if (response.status === 403 && result.code === 'challenge_required' && /^[\w-]{10,100}$/.test(result.siteKey || '') && attempt < 2) {
      challengeToken = await challenge(result.siteKey, { signal })
      continue
    }
    throw new Error(response.status === 403 ? '验证未通过，请重新点击下载' : '下载验证服务暂时不可用，请稍后重试')
  }
}
