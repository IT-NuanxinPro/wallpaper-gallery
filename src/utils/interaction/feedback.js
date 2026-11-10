import { normalizeRedirectTarget } from '../auth/redirect.js'

// 喜欢/收藏状态仍由原 store 维护；这里只补充页面的登录导航和未处理异常提示。
export function createInteractionFeedback({ router, getRedirect, message }) {
  return action => async () => {
    try {
      const result = await action()
      if (result?.needsLogin) {
        message.info('请先登录后再喜欢或收藏')
        await router.push({ path: '/login', query: { redirect: normalizeRedirectTarget(getRedirect()) } })
      }
      else if (result?.success === false && !result.ignored && !result.error) {
        message.error('操作未完成，请稍后重试')
      }
      // store 返回 error 时已显示具体反馈并恢复状态，避免同一失败重复弹窗。
      return result
    }
    catch {
      message.error('操作失败，请稍后重试')
      return { success: false }
    }
  }
}
