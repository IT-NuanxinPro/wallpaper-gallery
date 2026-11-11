import { loadWallpaperDetail } from '@/services/wallpaperDetailService'
import { encodeWallpaperShareToken } from '@/utils/wallpaper/share'

export function publicProfileName(profile) {
  return profile?.display_name?.trim() || profile?.username?.trim() || '壁纸爱好者'
}

// 每次路由、账号或可见性变化先清空旧内容，取消请求仍有序号保护。
export function createLatestCommunityRequest({ onState }) {
  let revision = 0
  let controller
  return {
    async run(load) {
      controller?.abort()
      controller = new AbortController()
      const current = ++revision
      const signal = controller.signal
      onState({ status: 'loading', data: null })
      try {
        const data = await load(signal)
        if (current === revision && !signal.aborted)
          onState({ status: data === null ? 'empty' : 'ready', data })
      }
      catch (error) {
        if (current === revision && !signal.aborted)
          onState({ status: 'error', data: null, error })
      }
    },
    cancel() {
      ++revision
      controller?.abort()
      onState({ status: 'idle', data: null })
    },
  }
}

// 只读取当前公开列表涉及的详情桶；同桶复用请求，不加载整系列目录。
export async function loadCommunityWallpapers(assetKeys, { signal, fetchImpl = fetch } = {}) {
  const buckets = new Map()
  const fetchBucket = (url, options) => {
    if (!buckets.has(url))
      buckets.set(url, fetchImpl(url, options))
    return buckets.get(url).then(response => response.clone())
  }
  const results = await Promise.allSettled([...new Set(assetKeys)].map(key => loadWallpaperDetail(encodeWallpaperShareToken(key), { signal, fetchImpl: fetchBucket })))
  if (signal?.aborted)
    throw new DOMException('Aborted', 'AbortError')
  const failed = results.filter(item => item.status === 'rejected' && item.reason?.status !== 404)
  if (failed.length)
    throw new Error('壁纸预览暂不可用，请重试。')
  return results.filter(item => item.status === 'fulfilled').map(item => item.value)
}
