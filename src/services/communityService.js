import { getSupabaseClient } from '@/lib/supabase/client'

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const unavailable = () => new Error('社区服务暂不可用，请稍后重试。')

function userId(value) {
  if (!UUID.test(value || ''))
    throw new Error('主页地址无效。')
  return value
}

function pagination({ limit = 24, offset = 0 } = {}) {
  return {
    p_limit: Math.min(48, Math.max(1, Math.trunc(Number(limit)) || 24)),
    p_offset: Math.min(100000, Math.max(0, Math.trunc(Number(offset)) || 0)),
  }
}

function pageResult(data) {
  if (!data || !Array.isArray(data.items) || typeof data.has_more !== 'boolean')
    throw unavailable()
  return data
}

export function createCommunityService({ getClient = getSupabaseClient } = {}) {
  async function rpc(name, args = {}, { signal } = {}) {
    if (signal?.aborted)
      throw new DOMException('Aborted', 'AbortError')
    const client = getClient()
    if (!client)
      throw unavailable()
    const controller = new AbortController()
    const cancel = () => controller.abort(new DOMException('Aborted', 'AbortError'))
    signal?.addEventListener('abort', cancel, { once: true })
    const timeout = setTimeout(() => controller.abort(new DOMException('社区请求超时，请重试。', 'TimeoutError')), 15000)
    let onAbort
    const aborted = new Promise((resolve, reject) => {
      onAbort = () => reject(controller.signal.reason)
      controller.signal.addEventListener('abort', onAbort, { once: true })
    })
    try {
      const pending = Promise.resolve().then(() => {
        controller.signal.throwIfAborted()
        const query = client.rpc(name, args)
        return query.abortSignal ? query.abortSignal(controller.signal) : query
      })
      // SDK或网络实现忽略abort时，页面仍须按时结束等待，迟到写入结果不视为成功。
      const { data, error } = await Promise.race([pending, aborted])
      controller.signal.throwIfAborted()
      if (error)
        throw unavailable()
      return data
    }
    finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', cancel)
      controller.signal.removeEventListener('abort', onAbort)
    }
  }

  return {
    async getProfile(id, options) {
      return rpc('get_public_profile', { p_user_id: userId(id) }, options)
    },
    async getWallpapers(id, kind, options = {}) {
      if (!['collections', 'collection', 'likes'].includes(kind))
        throw new Error('内容类型无效。')
      return pageResult(await rpc('get_public_wallpapers', { p_user_id: userId(id), p_kind: kind, ...pagination(options), p_collection_id: options.collectionId ? userId(options.collectionId) : null }, options))
    },
    async getConnections(id, kind, options = {}) {
      if (!['following', 'followers'].includes(kind))
        throw new Error('关注类型无效。')
      return pageResult(await rpc('get_profile_connections', { p_user_id: userId(id), p_kind: kind, ...pagination(options) }, options))
    },
    async getRelatedCollections(assetKey, options = {}) {
      if (!assetKey || assetKey.length > 4096)
        return []
      const result = await rpc('get_related_public_collections', { p_asset_key: assetKey, p_limit: Math.min(12, pagination(options).p_limit) }, options)
      if (!Array.isArray(result))
        throw unavailable()
      return result
    },
    async setFollowing(id, following, actorId) {
      return rpc('set_profile_follow', { p_user_id: userId(id), p_following: Boolean(following), p_actor_id: userId(actorId) })
    },
    getSettings: options => rpc('get_my_public_settings', {}, options),
    async saveSettings(settings, actorId) {
      return rpc('set_my_public_settings', { p_enabled: Boolean(settings.enabled), p_show_likes: Boolean(settings.show_likes), p_actor_id: userId(actorId) })
    },
    async getMyCollections(options = {}) {
      const result = pageResult(await rpc('get_my_collection_visibility', pagination(options), options))
      // 旧版隐藏状态统一按私有展示；读取不写回，也不扩大公开范围。
      return { ...result, items: result.items.map(item => ({ ...item, visibility: item.visibility === 'public' ? 'public' : 'private' })) }
    },
    async setCollectionVisibility(id, visibility, actorId) {
      if (!['private', 'public'].includes(visibility))
        throw new Error('收藏夹可见性无效。')
      return rpc('set_my_collection_visibility', { p_collection_id: userId(id), p_visibility: visibility, p_actor_id: userId(actorId) })
    },
  }
}

export const communityService = createCommunityService()
