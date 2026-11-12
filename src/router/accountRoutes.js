// 悬停账号入口时预热代码，与路由复用模块缓存；不预取账号数据。
export const loadAccountView = () => import('@/views/Account.vue')
export const loadLibraryView = () => import('@/views/Library.vue')
export const loadPublicProfileView = () => import('@/views/PublicProfile.vue')

export function warmAccountViews() {
  return Promise.allSettled([loadAccountView(), loadPublicProfileView()])
}

export function preservesAccountScroll(to, from) {
  return to.path === from.path && to.name === from.name && ['Account', 'Library', 'PublicProfile'].includes(to.name)
}
