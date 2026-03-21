/**
 * 自定义 Flexible 适配方案
 *
 * 核心原理：
 * - postcss-pxtorem 会把 px 转成 rem（rootValue: 37.5，基于 375px 设计稿）
 * - 例如：14px → 14/37.5 = 0.3733rem
 *
 * 适配策略：
 * - 移动端（< 768px）：根字体 = 屏幕宽度 / 10，实现等比缩放
 * - PC 端（>= 768px）：根字体固定 37.5px，让 rem 还原为原始 px 值
 *
 * 这样设计的好处：
 * 1. 移动端：在 375px 屏幕下，根字体 37.5px，14px 显示为 14px
 *    在 320px 屏幕下，根字体 32px，14px 显示为 12px（等比缩小）
 * 2. PC 端：根字体固定 37.5px，0.3733rem × 37.5 = 14px（保持设计稿尺寸）
 */

// 设计稿宽度
const DESIGN_WIDTH = 375

// PC 端断点
const PC_BREAKPOINT = 768

// 基准字体大小（设计稿宽度 / 10）
const BASE_FONT_SIZE = DESIGN_WIDTH / 10

/**
 * 设置根元素字体大小
 */
function setRootFontSize() {
  const docEl = document.documentElement
  const clientWidth = docEl.clientWidth

  if (clientWidth >= PC_BREAKPOINT) {
    // PC 端：固定 37.5px，让 rem 值等于原始 px
    docEl.style.fontSize = `${BASE_FONT_SIZE}px`
  }
  else {
    // 移动端：动态计算，实现等比缩放
    // 限制最大宽度为设计稿的 1.5 倍（562.5px）
    const maxWidth = DESIGN_WIDTH * 1.5
    const width = Math.min(clientWidth, maxWidth)
    docEl.style.fontSize = `${width / 10}px`
  }
}

/**
 * 初始化 flexible 适配
 */
function initFlexible() {
  // 立即设置
  setRootFontSize()

  // 窗口大小变化时重新计算
  window.addEventListener('resize', setRootFontSize)

  // 屏幕方向变化时重新计算（移动端横竖屏切换）
  window.addEventListener('orientationchange', () => {
    setTimeout(setRootFontSize, 100)
  })

  // 页面显示时重新计算（从后台切回）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      setRootFontSize()
    }
  })
}

// 自动初始化
initFlexible()

export { initFlexible, setRootFontSize }
