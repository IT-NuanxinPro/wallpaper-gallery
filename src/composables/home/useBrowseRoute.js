import { provide, shallowReactive, watch } from 'vue'
import { routeLocationKey, useRouter } from 'vue-router'

export function useBrowseRoute() {
  const router = useRouter()
  const route = shallowReactive({ ...router.currentRoute.value })
  // 缓存列表离屏期间保留自己的路由，避免详情参数清空筛选或卸载嵌套路由。
  watch(router.currentRoute, (next) => {
    if (next.meta.browseShell)
      Object.assign(route, next)
  }, { flush: 'sync' })
  provide(routeLocationKey, route)
  return route
}
