import { buildWallpaperAssetKey } from '@/utils/wallpaper/identity'

export async function loadWallpaperStats(assetKey, { signal, fetchImpl = fetch } = {}) {
  if (!assetKey || buildWallpaperAssetKey(assetKey) !== assetKey || (!assetKey.includes(':path:') && !assetKey.startsWith('bing:bing-')))
    throw new Error('单图统计资源身份无效')
  const origin = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!origin || !anonKey)
    throw new Error('统计服务尚未配置')
  const url = new URL('/rest/v1/image_stats_with_asset_key', origin)
  url.search = new URLSearchParams({
    select: 'asset_key,total_views,total_downloads,total_likes,total_collects,updated_at',
    asset_key: `eq.${assetKey}`,
    limit: '1',
  }).toString()
  const timeout = AbortSignal.timeout(10000)
  const response = await fetchImpl(url.href, {
    method: 'GET',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  if (!response.ok)
    throw new Error('单图统计暂不可用')
  const rows = await response.json()
  if (!Array.isArray(rows) || rows.length > 1)
    throw new Error('单图统计格式无效')
  if (!rows.length)
    return null
  const row = rows[0]
  if (row.asset_key !== assetKey)
    throw new Error('单图统计资源身份不匹配')
  return Object.fromEntries(['views', 'downloads', 'likes', 'collects'].map((field) => {
    const value = row[`total_${field}`]
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error('单图统计计数无效')
    return [field, value]
  }))
}
