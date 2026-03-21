import { computed, onMounted, onUnmounted, ref } from 'vue'

// ========================================
// 断点常量定义
// ========================================
export const BREAKPOINTS = {
  SM: 576, // 小屏手机
  MD: 768, // 大屏手机/小平板（移动端/平板分界线）
  LG: 1024, // 平板/小型桌面（平板/PC端分界线）
  XL: 1200, // 大型桌面
  XXL: 1440, // 超大桌面
}

// ========================================
// 设备类型常量
// ========================================
export const DEVICE_TYPES = {
  MOBILE: 'mobile', // 手机 (< 768px)
  TABLET: 'tablet', // 平板 (768px - 1024px)
  DESKTOP: 'desktop', // 桌面 (>= 1024px)
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
    'iphone',
    'ipod',
    'android.*mobile',
    'webos',
    'blackberry',
    'iemobile',
    'opera mini',
    'windows phone',
  ]

  // 检测平板设备
  const tabletKeywords = ['ipad', 'tablet', 'playbook', 'silk', 'android(?!.*mobile)']

  // iPad on iOS 13+ 检测（会标识为 Mac）
  if (ua.includes('macintosh') && detectTouchSupport()) {
    return DEVICE_TYPES.TABLET
  }

  // 检测是否为平板
  for (const keyword of tabletKeywords) {
    if (new RegExp(keyword).test(ua)) {
      return DEVICE_TYPES.TABLET
    }
  }

  // 检测是否为手机
  for (const keyword of mobileKeywords) {
    if (new RegExp(keyword).test(ua)) {
      return DEVICE_TYPES.MOBILE
    }
  }

  return DEVICE_TYPES.DESKTOP
}

/**
 * 综合判断设备类型
 * 结合 UA 检测、触摸支持、屏幕尺寸等多种因素
 *
 * 关键逻辑：
 * - 手机横屏仍然是手机（通过 UA 判断）
 * - 平板横屏仍然是平板（通过 UA 判断）
 * - 屏幕宽度只作为辅助判断，UA 检测优先
 */
function getDeviceType(windowWidth) {
  const uaDevice = detectDeviceByUserAgent()

  // UA 明确是手机 → 无论横屏还是竖屏都是手机
  // 这修复了手机横屏被错误识别为平板的问题
  if (uaDevice === DEVICE_TYPES.MOBILE) {
    return DEVICE_TYPES.MOBILE
  }

  // UA 明确是平板 → 无论横屏还是竖屏都是平板
  if (uaDevice === DEVICE_TYPES.TABLET) {
    return DEVICE_TYPES.TABLET
  }

  // UA 检测为桌面设备，使用屏幕尺寸判断
  // 小于 768px → 手机（小窗口桌面浏览器模拟）
  if (windowWidth < BREAKPOINTS.MD) {
    return DEVICE_TYPES.MOBILE
  }

  // 768px - 1024px 之间
  if (windowWidth < BREAKPOINTS.LG) {
    // 有触摸支持，可能是平板模式（如 Surface）
    if (detectTouchSupport()) {
      return DEVICE_TYPES.TABLET
    }
    // 否则认为是小桌面
    return DEVICE_TYPES.DESKTOP
  }

  // 1024px 以上 → 桌面
  return DEVICE_TYPES.DESKTOP
}

const sharedWindowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const sharedWindowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 768)
const sharedHasTouch = ref(detectTouchSupport())
const sharedDeviceType = computed(() => getDeviceType(sharedWindowWidth.value))
const sharedDeviceChangeCallbacks = ref([])

let activeDeviceConsumers = 0
let deviceCheckTimer = null
let isDeviceListenerBound = false

function notifyDeviceChange(oldDeviceType) {
  if (deviceCheckTimer) {
    clearTimeout(deviceCheckTimer)
  }

  deviceCheckTimer = window.setTimeout(() => {
    deviceCheckTimer = null
    const newDeviceType = sharedDeviceType.value
    if (oldDeviceType !== newDeviceType) {
      sharedDeviceChangeCallbacks.value.forEach((callback) => {
        callback(newDeviceType, oldDeviceType)
      })
    }
  }, 0)
}

function updateDeviceViewport() {
  if (typeof window === 'undefined')
    return

  const oldDeviceType = sharedDeviceType.value
  sharedWindowWidth.value = window.innerWidth
  sharedWindowHeight.value = window.innerHeight
  sharedHasTouch.value = detectTouchSupport()

  notifyDeviceChange(oldDeviceType)
}

function bindDeviceListeners() {
  if (typeof window === 'undefined' || isDeviceListenerBound)
    return

  window.addEventListener('resize', updateDeviceViewport)
  window.addEventListener('orientationchange', updateDeviceViewport)
  window.visualViewport?.addEventListener('resize', updateDeviceViewport)
  isDeviceListenerBound = true
}

function unbindDeviceListeners() {
  if (typeof window === 'undefined' || !isDeviceListenerBound || activeDeviceConsumers > 0)
    return

  window.removeEventListener('resize', updateDeviceViewport)
  window.removeEventListener('orientationchange', updateDeviceViewport)
  window.visualViewport?.removeEventListener('resize', updateDeviceViewport)

  if (deviceCheckTimer) {
    clearTimeout(deviceCheckTimer)
    deviceCheckTimer = null
  }

  isDeviceListenerBound = false
}

/**
 * 设备检测 Composable
 * 用于响应式检测当前设备类型
 */
export function useDevice() {
  const windowWidth = sharedWindowWidth
  const windowHeight = sharedWindowHeight
  const deviceType = sharedDeviceType

  // 便捷判断属性
  const isMobile = computed(() => deviceType.value === DEVICE_TYPES.MOBILE)
  const isTablet = computed(() => deviceType.value === DEVICE_TYPES.TABLET)
  const isDesktop = computed(() => deviceType.value === DEVICE_TYPES.DESKTOP)

  // 组合判断：是否为移动端（手机或平板）
  const isMobileOrTablet = computed(() => isMobile.value || isTablet.value)

  // 基于窗口尺寸的响应式断点判断（与 SCSS 保持一致）
  const isSmallMobile = computed(() => windowWidth.value < BREAKPOINTS.SM)
  const isTabletSize = computed(() =>
    windowWidth.value >= BREAKPOINTS.MD && windowWidth.value < BREAKPOINTS.LG,
  )
  const isLargeDesktop = computed(() => windowWidth.value >= BREAKPOINTS.XL)

  // 触摸设备检测
  const hasTouch = sharedHasTouch

  // 屏幕方向检测（横屏/竖屏）
  const isLandscape = computed(() => windowWidth.value > windowHeight.value)
  const isPortrait = computed(() => !isLandscape.value)

  /**
   * 注册设备类型变化监听器
   * @param {Function} callback - 回调函数 (newDeviceType, oldDeviceType) => void
   * @returns {Function} 取消注册的函数
   */
  function onDeviceChange(callback) {
    sharedDeviceChangeCallbacks.value.push(callback)
    return () => {
      const index = sharedDeviceChangeCallbacks.value.indexOf(callback)
      if (index > -1) {
        sharedDeviceChangeCallbacks.value.splice(index, 1)
      }
    }
  }

  onMounted(() => {
    activeDeviceConsumers += 1
    bindDeviceListeners()
    updateDeviceViewport()
  })

  onUnmounted(() => {
    activeDeviceConsumers = Math.max(0, activeDeviceConsumers - 1)
    unbindDeviceListeners()
  })

  return {
    // 核心属性
    windowWidth,
    deviceType,
    isMobile,
    isTablet,
    isDesktop,
    isMobileOrTablet,
    hasTouch,

    // 屏幕方向
    isLandscape,
    isPortrait,

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
  return sharedDeviceType.value
}

/**
 * 检测是否为移动设备（非响应式）- 仅手机
 */
export function isMobileDevice() {
  return detectDevice() === DEVICE_TYPES.MOBILE
}

/**
 * 检测是否为平板设备（非响应式）
 */
export function isTabletDevice() {
  return detectDevice() === DEVICE_TYPES.TABLET
}

/**
 * 检测是否为移动端（手机或平板，非响应式）
 */
export function isMobileOrTabletDevice() {
  const device = detectDevice()
  return device === DEVICE_TYPES.MOBILE || device === DEVICE_TYPES.TABLET
}

export function getDeviceTypeRef() {
  return sharedDeviceType
}
