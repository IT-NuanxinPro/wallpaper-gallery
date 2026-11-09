import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client'
// 下载历史由事件 RPC 在同一事务内写入，客户端只传递当前登录身份。
export async function getUserActivityAccessToken() {
  if (!isSupabaseConfigured()) {
    return
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return
  }

  const { data: { session }, error } = await supabase.auth.getSession()
  if (error)
    throw error
  return session?.access_token || null
}
