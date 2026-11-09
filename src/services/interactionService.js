import { getSupabaseClient } from '@/lib/supabase/client'
import { buildWallpaperAssetKey } from '@/utils/wallpaper/identity'

function getClient() {
  const client = getSupabaseClient()
  if (!client)
    throw new Error('Supabase 未配置')
  return client
}

/**
 * 批量获取当前用户在指定系列下的所有喜欢
 * @param {string} series - 系列 ID (desktop/mobile/avatar/bing)
 * @returns {Promise<string[]>} asset_key 数组
 */
export async function fetchUserLikes(series) {
  const supabase = getClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session)
    return []

  const { data, error } = await supabase
    .from('user_wallpaper_likes')
    .select('asset_key')
    .eq('user_id', session.user.id)
    .like('asset_key', `${series}:%`)

  if (error) {
    console.warn('[interactionService] fetchUserLikes failed:', error.message)
    return []
  }

  return data.map(row => row.asset_key)
}

/**
 * 批量获取当前用户在指定系列下的所有收藏
 * @param {string} series - 系列 ID
 * @returns {Promise<string[]>} asset_key 数组
 */
export async function fetchUserCollections(series) {
  const supabase = getClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session)
    return []

  return await fetchUserCollectionsTwoStep(session.user.id, series)
}

async function fetchUserCollectionsTwoStep(userId, series) {
  const supabase = getClient()
  const { data: collections, error: colError } = await supabase
    .from('user_collections')
    .select('id')
    .eq('user_id', userId)

  if (colError || !collections?.length)
    return []

  const collectionIds = collections.map(c => c.id)

  const { data: items, error: itemError } = await supabase
    .from('user_collection_items')
    .select('asset_key')
    .in('collection_id', collectionIds)
    .like('asset_key', `${series}:%`)

  if (itemError) {
    console.warn('[interactionService] fetchUserCollections failed:', itemError.message)
    return []
  }

  return items.map(row => row.asset_key)
}

/**
 * 获取用户的默认收藏夹 ID
 */
export async function fetchDefaultCollectionId() {
  const supabase = getClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session)
    return null

  const { data, error } = await supabase
    .from('user_collections')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('is_default', true)
    .single()

  if (error) {
    console.warn('[interactionService] fetchDefaultCollectionId failed:', error.message)
    return null
  }

  return data?.id || null
}

/**
 * 切换喜欢状态
 * @returns {Promise<boolean>} 操作后的状态 (true=已喜欢)
 */
export async function toggleLike(wallpaperOrKey, series) {
  const supabase = getClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session)
    throw new Error('未登录')

  const assetKey = buildWallpaperAssetKey(wallpaperOrKey, series)
  if (!assetKey)
    throw new Error('无效的壁纸标识')

  // 检查是否已喜欢
  const { data: existing } = await supabase
    .from('user_wallpaper_likes')
    .select('asset_key')
    .eq('user_id', session.user.id)
    .eq('asset_key', assetKey)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('user_wallpaper_likes')
      .delete()
      .eq('user_id', session.user.id)
      .eq('asset_key', assetKey)

    if (error)
      throw error
    return false
  }
  else {
    const { error } = await supabase
      .from('user_wallpaper_likes')
      .insert({ user_id: session.user.id, asset_key: assetKey })

    if (error)
      throw error
    return true
  }
}

/**
 * 切换收藏状态（加入/移出默认收藏夹）
 * @returns {Promise<boolean>} 操作后的状态 (true=已收藏)
 */
export async function toggleCollect(wallpaperOrKey, series, collectionId) {
  const supabase = getClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session)
    throw new Error('未登录')

  const assetKey = buildWallpaperAssetKey(wallpaperOrKey, series)
  if (!assetKey)
    throw new Error('无效的壁纸标识')

  if (!collectionId) {
    collectionId = await fetchDefaultCollectionId()
    if (!collectionId)
      throw new Error('未找到默认收藏夹')
  }

  // 检查是否已收藏
  const { data: existing } = await supabase
    .from('user_collection_items')
    .select('asset_key')
    .eq('collection_id', collectionId)
    .eq('asset_key', assetKey)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('user_collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .eq('asset_key', assetKey)

    if (error)
      throw error
    return false
  }
  else {
    const { error } = await supabase
      .from('user_collection_items')
      .insert({ collection_id: collectionId, asset_key: assetKey })

    if (error)
      throw error
    return true
  }
}

/**
 * 获取用户所有喜欢（跨系列），用于 Library 页面
 * @returns {Promise<Array<{asset_key: string, created_at: string}>>}
 */
export async function fetchAllUserLikes() {
  const supabase = getClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session)
    return []

  const { data, error } = await supabase
    .from('user_wallpaper_likes')
    .select('asset_key, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[interactionService] fetchAllUserLikes failed:', error.message)
    return []
  }

  return data || []
}

/**
 * 获取用户所有收藏（跨系列），用于 Library 页面
 * @returns {Promise<Array<{asset_key: string, added_at: string, collection_id: string}>>}
 */
export async function fetchAllUserCollectionItems() {
  const supabase = getClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session)
    return []

  // 先获取用户的所有收藏夹
  const { data: collections, error: colError } = await supabase
    .from('user_collections')
    .select('id, name, is_default')
    .eq('user_id', session.user.id)

  if (colError || !collections?.length)
    return []

  const collectionIds = collections.map(c => c.id)

  const { data: items, error: itemError } = await supabase
    .from('user_collection_items')
    .select('asset_key, added_at, collection_id')
    .in('collection_id', collectionIds)
    .order('added_at', { ascending: false })

  if (itemError) {
    console.warn('[interactionService] fetchAllUserCollectionItems failed:', itemError.message)
    return []
  }

  return items || []
}

/**
 * 获取用户交互统计
 */
export async function fetchUserInteractionStats() {
  const supabase = getClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session)
    return { likes: 0, collections: 0, downloads: 0 }

  const [likesRes, collectionsRes, downloadsRes] = await Promise.all([
    supabase
      .from('user_wallpaper_likes')
      .select('asset_key', { count: 'exact', head: true })
      .eq('user_id', session.user.id),
    supabase
      .from('user_collection_items')
      .select('asset_key', { count: 'exact', head: true })
      .in(
        'collection_id',
        (await supabase
          .from('user_collections')
          .select('id')
          .eq('user_id', session.user.id)).data?.map(c => c.id) || [],
      ),
    supabase
      .from('user_download_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id),
  ])

  return {
    likes: likesRes.count || 0,
    collections: collectionsRes.count || 0,
    downloads: downloadsRes.count || 0,
  }
}
