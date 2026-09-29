/**
 * OAuth redirect overlay copy.
 * Kept short so AuthFlowPanel layout stays unchanged.
 */

export function getOAuthOverlayTitle(providerLabel) {
  if (!providerLabel) {
    return '正在发起授权登录'
  }
  return `正在打开 ${providerLabel} 授权`
}

export function getOAuthOverlayText(providerLabel) {
  if (!providerLabel) {
    return '请稍候...'
  }
  return '授权页将在应用内新窗口打开。完成后关闭该窗口即可返回，也可使用 ⌘+[ 或 Ctrl+←。成功后将自动同步账号资料。'
}
