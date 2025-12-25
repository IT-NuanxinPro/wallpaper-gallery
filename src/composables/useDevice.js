import { computed, onMounted, onUnmounted, ref } from 'vue'

// ========================================
// 断点常量定义
// ========================================
export const BREAKPOINTS = {
  SM: 576, // 小屏手机
  MD: 768, // 平板/大屏手机（移动端/PC端分界线）
  LG: 992, // 小型桌面
  XL: 1200, // 大型桌面
}

// ========================================
// 设备类型常量
// ========================================
export const DEVICE_TYPES = {
  MOBILE: 'mobile',
  TABLET: 'tablet',
  DESKTOP: 'desktop',
}

/**
 * 检测是否为触摸设备
 */
function detectTouchSupport() {
  if (typeof window === 'undefined')
    return false
  return (
    'ontouchstart' in window
    || navigator.maxTouchPoints > 0
    || (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0)
  )
}

/**
 * 通过 User Agent 检测设备类型
 * 注意：UA 检测不是100%准确，仅作为辅助判断
 */
function detectDeviceByUserAgent() {
  if (typeof navigator === 'undefined')
    return null

  const ua = navigator.userAgent.toLowerCase()

  // 检测移动设备
  const mobileKeywords = [
    'android',
    'webos',
    'iphone',
    'ipod',
    'blackberry',
    'iemobile',
    'opera mini',
    'mobile',
  ]

  // 检测平板设备
  const tabletKeywords = ['ipad', 'tablet', 'playbook', 'silk']

  // 检测是否为平板（iPad 特殊处理 - iOS 13+ 会标识为 Mac）
  if (tabletKeywords.some(keyword => ua.includes(keyword))) {
    return DEVICE_TYPES.TABLET
  }

  // iPad on iOS 13+ 检测
  if (ua.includes('macintosh') && detectTouchSupport()) {
    return DEVICE_TYPES.TABLET
  }

  // 检测是否为手机
  if (mobileKeywords.some(keyword => ua.includes(keyword))) {
    // 排除平板（Android 平板通常没有 'mobile' 关键字）
    if (ua.includes('android') && !ua.includes('mobile')) {
      return DEVICE_TYPES.TABLET
    }
    return DEVICE_TYPES.MOBILE
  }

  return DEVICE_TYPES.DESKTOP
}

/**
 * 综合判断设备类型
 * 结合 UA 检测、触摸支持、屏幕尺寸等多种因素
 */
function getDeviceType(windowWidth) {
  const uaDevice = detectDeviceByUserAgent()

  // 如果 UA 明确识别为移动设备或平板
  if (uaDevice === DEVICE_TYPES.MOBILE) {
    return DEVICE_TYPES.MOBILE
  }

  if (uaDevice === DEVICE_TYPES.TABLET) {
    // 平板归类为移动端（策略A：因为平板更适合竖屏壁纸）
    return DEVICE_TYPES.MOBILE
  }

  // 基于窗口尺寸判断
  if (windowWidth < BREAKPOINTS.MD) {
    return DEVICE_TYPES.MOBILE
  }

  // 大屏幕但有触摸支持，可能是平板或触屏电脑
  // 这种情况归类为 desktop（因为屏幕够大）
  return DEVICE_TYPES.DESKTOP
}

/**
 * 设备检测 Composable
 * 用于响应式检测当前设备类型
 */
export function useDevice() {
  const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

  // 设备类型
  const deviceType = computed(() => getDeviceType(windowWidth.value))

  // 便捷判断属性
  const isMobile = computed(() => deviceType.value === DEVICE_TYPES.MOBILE)
  const isDesktop = computed(() => deviceType.value === DEVICE_TYPES.DESKTOP)

  // 基于窗口尺寸的响应式断点判断（与 SCSS 保持一致）
  const isSmallMobile = computed(() => windowWidth.value < BREAKPOINTS.SM)
  const isTabletSize = computed(() =>
    windowWidth.value >= BREAKPOINTS.MD && windowWidth.value < BREAKPOINTS.LG,
  )
  const isLargeDesktop = computed(() => windowWidth.value >= BREAKPOINTS.XL)

  // 触摸设备检测
  const hasTouch = ref(detectTouchSupport())

  // 设备变化回调
  const deviceChangeCallbacks = ref([])

  // 定时器引用（用于清理）
  let deviceCheckTimer = null

  function updateWidth() {
    const newWidth = window.innerWidth
    const oldDeviceType = deviceType.value
    windowWidth.value = newWidth

    // 清除之前的定时器
    if (deviceCheckTimer) {
      clearTimeout(deviceCheckTimer)
    }

    // 检测设备类型是否变化（在 computed 更新后）
    deviceCheckTimer = setTimeout(() => {
      deviceCheckTimer = null
      const newDeviceType = deviceType.value
      if (oldDeviceType !== newDeviceType) {
        // 触发设备变化回调
        deviceChangeCallbacks.value.forEach((callback) => {
          callback(newDeviceType, oldDeviceType)
        })
      }
    }, 0)
  }

  /**
   * 注册设备类型变化监听器
   * @param {Function} callback - 回调函数 (newDeviceType, oldDeviceType) => void
   * @returns {Function} 取消注册的函数
   */
  function onDeviceChange(callback) {
    deviceChangeCallbacks.value.push(callback)
    return () => {
      const index = deviceChangeCallbacks.value.indexOf(callback)
      if (index > -1) {
        deviceChangeCallbacks.value.splice(index, 1)
      }
    }
  }

  onMounted(() => {
    window.addEventListener('resize', updateWidth)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateWidth)
    // 清除未完成的定时器
    if (deviceCheckTimer) {
      clearTimeout(deviceCheckTimer)
      deviceCheckTimer = null
    }
  })

  return {
    // 核心属性
    windowWidth,
    deviceType,
    isMobile,
    isDesktop,
    hasTouch,

    // 细粒度断点
    isSmallMobile,
    isTabletSize,
    isLargeDesktop,

    // 设备变化监听
    onDeviceChange,

    // 常量导出
    BREAKPOINTS,
    DEVICE_TYPES,
  }
}

/**
 * 非响应式的设备类型检测（用于初始化时）
 * 可在 composable 外部使用
 */
export function detectDevice() {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1024
  return getDeviceType(width)
}

/**
 * 检测是否为移动设备（非响应式）
 */
export function isMobileDevice() {
  return detectDevice() === DEVICE_TYPES.MOBILE
}
