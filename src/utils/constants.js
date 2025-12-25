// ========================================
// 常量定义
// ========================================

// CDN 版本号
// - 本地开发：使用此默认值
// - 线上构建：GitHub Actions 会自动替换为图床最新 tag
// - jsdelivr 缓存策略：@main 分支有缓存，@tag 版本无缓存
export const CDN_VERSION = 'v1.0.4'

// CDN URL 动态构建（防止静态分析提取完整链接）
const _cdnParts = {
  p: 'https:/',
  h: '/cdn.jsdelivr.net',
  g: '/gh/IT-NuanxinPro',
  r: `/nuanXinProPic@${CDN_VERSION}`,
}
const CDN_BASE = `${_cdnParts.p}${_cdnParts.h}${_cdnParts.g}${_cdnParts.r}`

// 备用：raw.githubusercontent.com（如 jsdelivr 不可用时切换）
// const _cdnParts = { p: 'https:/', h: '/raw.githubusercontent.com', g: '/IT-NuanxinPro', r: '/nuanXinProPic/main' }

// ========================================
// 三大系列配置
// ========================================
export const SERIES_CONFIG = {
  desktop: {
    id: 'desktop',
    name: '电脑壁纸',
    icon: 'monitor',
    imageBaseUrl: `${CDN_BASE}/wallpaper/desktop`,
    thumbnailBaseUrl: `${CDN_BASE}/thumbnail/desktop`,
    dataUrl: `${import.meta.env.BASE_URL}data/desktop.json`,
    aspectRatio: '16/10',
  },
  mobile: {
    id: 'mobile',
    name: '手机壁纸',
    icon: 'smartphone',
    imageBaseUrl: `${CDN_BASE}/wallpaper/mobile`,
    thumbnailBaseUrl: `${CDN_BASE}/thumbnail/mobile`,
    dataUrl: `${import.meta.env.BASE_URL}data/mobile.json`,
    aspectRatio: '9/16',
  },
  avatar: {
    id: 'avatar',
    name: '头像',
    icon: 'user',
    imageBaseUrl: `${CDN_BASE}/wallpaper/avatar`,
    thumbnailBaseUrl: `${CDN_BASE}/thumbnail/avatar`,
    dataUrl: `${import.meta.env.BASE_URL}data/avatar.json`,
    aspectRatio: '1/1',
  },
}

// 设备可见的系列（PC端显示desktop+avatar，移动端显示mobile+avatar）
export const DEVICE_SERIES = {
  desktop: ['desktop', 'avatar'], // PC端可见的系列
  mobile: ['mobile', 'avatar'], // 移动端可见的系列
}

// 默认系列（根据设备类型）
export const DEFAULT_SERIES = {
  desktop: 'desktop', // PC端默认显示电脑壁纸
  mobile: 'mobile', // 移动端默认显示手机壁纸
}

// 所有系列ID列表
export const ALL_SERIES = ['desktop', 'mobile', 'avatar']

// ========================================
// 图片代理服务配置（备用方案，如本地缩略图不可用时使用）
// ========================================
export const IMAGE_PROXY = {
  BASE_URL: 'https://wsrv.nl/',
  THUMB_WIDTH: 400,
  THUMB_QUALITY: 80,
  FORMAT: 'webp',
}

// 排序选项
export const SORT_OPTIONS = [
  { value: 'newest', label: '最新优先', icon: 'clock' },
  { value: 'oldest', label: '最早优先', icon: 'clock-reverse' },
  { value: 'largest', label: '最大优先', icon: 'arrow-down' },
  { value: 'smallest', label: '最小优先', icon: 'arrow-up' },
  { value: 'name-asc', label: '名称 A-Z', icon: 'sort-alpha' },
  { value: 'name-desc', label: '名称 Z-A', icon: 'sort-alpha-reverse' },
]

// 格式过滤选项
export const FORMAT_OPTIONS = [
  { value: 'all', label: '全部格式' },
  { value: 'jpg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WEBP' },
  { value: 'gif', label: 'GIF' },
]

// ========================================
// 分辨率标签阈值（按长边判断，用于弹窗中根据真实图片尺寸动态生成标签）
// ========================================
export const RESOLUTION_THRESHOLDS = [
  { minWidth: 5120, label: '5K+', type: 'danger' },
  { minWidth: 3841, label: '4K+', type: 'warning' },
  { minWidth: 3840, label: '4K', type: 'success' },
  { minWidth: 2560, label: '2K', type: 'info' },
  { minWidth: 1920, label: '超清', type: 'primary' },
  { minWidth: 1280, label: '高清', type: 'secondary' },
  { minWidth: 0, label: '标清', type: 'secondary' },
]

// 主题
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
}

// localStorage 键名
export const STORAGE_KEYS = {
  THEME: 'wallpaper-gallery-theme',
  SORT: 'wallpaper-gallery-sort',
  CATEGORY: 'wallpaper-gallery-category',
  VIEW_MODE: 'wallpaper-gallery-view-mode',
  CURRENT_SERIES: 'wallpaper-gallery-current-series', // 当前选择的系列
}
