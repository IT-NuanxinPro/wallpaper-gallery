// ========================================
// Umami Analytics 事件追踪工具函数
// ========================================

let analyticsDisabled = false

function shouldDisableAnalytics(error) {
  const message = String(error?.message || error || '')
  return message.includes('429') || message.includes('Too Many Requests')
}

function handleTrackingError(error) {
  if (shouldDisableAnalytics(error))
    analyticsDisabled = true

  if (import.meta.env.DEV)
    console.warn('[Analytics] tracking skipped:', error)
}

/**
 * 追踪自定义事件
 * @param {string} eventName - 事件名称
 * @param {object} [eventData] - 事件数据（可选）
 */
export function trackEvent(eventName, eventData = {}) {
  // 只在生产环境且 umami 可用时追踪
  if (analyticsDisabled)
    return

  if (import.meta.env.PROD && typeof window !== 'undefined' && window.umami) {
    try {
      const result = Object.keys(eventData).length > 0
        ? window.umami.track(eventName, eventData)
        : window.umami.track(eventName)

      if (result && typeof result.catch === 'function')
        result.catch(handleTrackingError)
    }
    catch (error) {
      handleTrackingError(error)
    }
  }
  else if (import.meta.env.DEV) {
    // 开发环境打印日志

    console.log('📊 [Analytics]', eventName, eventData)
  }
}

/**
 * 追踪壁纸下载事件
 * @param {object} wallpaper - 壁纸对象
 * @param {string} [series] - 壁纸系列(desktop/mobile/avatar)
 */
export function trackWallpaperDownload(wallpaper, series = 'unknown') {
  // 提取文件扩展名
  const ext = wallpaper.filename.split('.').pop().toLowerCase()

  trackEvent('wallpaper_download', {
    filename: wallpaper.filename,
    category: wallpaper.category,
    series,
    format: ext,
    size: wallpaper.size,
    resolution: wallpaper.resolution?.label || 'unknown',
  })
}

/**
 * 追踪搜索事件
 * @param {string} query - 搜索关键词
 * @param {number} resultCount - 搜索结果数量
 */
export function trackSearch(query, resultCount) {
  trackEvent('search', {
    query,
    results: resultCount,
  })
}

/**
 * 追踪系列切换事件
 * @param {string} fromType - 切换前的系列
 * @param {string} toType - 切换后的系列
 */
export function trackSeriesSwitch(fromType, toType) {
  trackEvent('series_switch', {
    from: fromType,
    to: toType,
  })
}

/**
 * 追踪视图模式切换事件
 * @param {string} mode - 视图模式（grid/list/waterfall）
 */
export function trackViewModeChange(mode) {
  trackEvent('view_mode_change', {
    mode,
  })
}

/**
 * 追踪筛选事件
 * @param {string} filterType - 筛选类型（category/format/sort）
 * @param {string} filterValue - 筛选值
 */
export function trackFilter(filterType, filterValue) {
  trackEvent('filter_apply', {
    type: filterType,
    value: filterValue,
  })
}

/**
 * 追踪主题切换事件
 * @param {string} theme - 主题（light/dark）
 */
export function trackThemeChange(theme) {
  trackEvent('theme_change', {
    theme,
  })
}

/**
 * 追踪壁纸预览事件（打开弹窗）
 * @param {object} wallpaper - 壁纸对象
 */
export function trackWallpaperPreview(wallpaper) {
  trackEvent('wallpaper_preview', {
    filename: wallpaper.filename,
    category: wallpaper.category,
  })
}

/**
 * 追踪全屏浏览事件
 */
export function trackFullscreenToggle(isFullscreen) {
  trackEvent('fullscreen_toggle', {
    action: isFullscreen ? 'enter' : 'exit',
  })
}

/**
 * 追踪 DIY 头像工具点击事件
 */
export function trackDiyAvatarClick() {
  trackEvent('diy_avatar_click', {
    source: 'banner',
    target_url: 'http://diyavatar.061129.xyz/',
  })
}

/**
 * 追踪分页事件
 * @param {number} page - 页码
 * @param {string} series - 当前系列
 * @param {string} category - 当前分类
 */
export function trackPagination(page, series, category) {
  trackEvent('pagination', {
    page,
    series,
    category,
  })
}

/**
 * 追踪返回顶部点击事件
 * @param {number} scrollPosition - 点击时的滚动位置
 */
export function trackBackToTop(scrollPosition) {
  trackEvent('back_to_top', {
    scroll_position: scrollPosition,
  })
}

/**
 * 追踪图片裁剪事件
 * @param {string} action - 动作（open/complete/cancel）
 * @param {object} data - 附加数据
 */
export function trackImageCrop(action, data = {}) {
  trackEvent('image_crop', {
    action,
    ...data,
  })
}
