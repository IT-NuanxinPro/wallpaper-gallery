/**
 * src/services/imgbed/api.js
 *
 * 从自建 /api/wallpapers 接口获取数据，替代原有从 CDN JSON 读取的方式。
 * 保持与原项目 wallpaperStore.js 期望的数据格式兼容。
 *
 * 分类体系（来自你的实际数据）：
 *   方向: 横图 / 竖图 / 方图
 *   风格: 动漫_二次元 / 魅力_迷人 / 自然_风景 / 自制_艺术 /
 *          游戏_玩具 / 安逸_自由 / 科幻_星云 / 程序_代码
 *   颜色: 偏蓝 / 灰_白 / 暗色 / 紫_粉 / 偏黄 / 偏绿 / 偏红 / 其他颜色
 */

// ======== 分类元数据 ========

export const STYLES = [
  { key: '动漫_二次元', label: '动漫二次元', icon: '🎌' },
  { key: '魅力_迷人',   label: '魅力迷人',   icon: '✨' },
  { key: '自然_风景',   label: '自然风景',   icon: '🌿' },
  { key: '自制_艺术',   label: '自制艺术',   icon: '🎨' },
  { key: '游戏_玩具',   label: '游戏玩具',   icon: '🎮' },
  { key: '安逸_自由',   label: '安逸自由',   icon: '🕊' },
  { key: '科幻_星云',   label: '科幻星云',   icon: '🚀' },
  { key: '程序_代码',   label: '程序代码',   icon: '💻' },
]

export const COLORS = [
  { key: '偏蓝',   label: '偏蓝',   hex: '#60a5fa' },
  { key: '灰_白',  label: '灰白',   hex: '#e2e8f0' },
  { key: '暗色',   label: '暗色',   hex: '#374151' },
  { key: '紫_粉',  label: '紫粉',   hex: '#c084fc' },
  { key: '偏黄',   label: '偏黄',   hex: '#fbbf24' },
  { key: '偏绿',   label: '偏绿',   hex: '#34d399' },
  { key: '偏红',   label: '偏红',   hex: '#f87171' },
  { key: '其他颜色', label: '其他', hex: '#94a3b8' },
]

export const ORIENTATIONS = [
  { key: 'horizontal', label: '横图', tag: '横图' },
  { key: 'vertical',   label: '竖图', tag: '竖图' },
  { key: 'square',     label: '方图', tag: '方图' },
]

// ======== 数据映射：将 API 返回格式转换为原项目期望格式 ========

/**
 * 将 /api/wallpapers 返回的 item 转换为 wallpaperStore 期望的格式
 */
function toWallpaperItem(item) {
  return {
    id: item.id,
    filename: item.fileName,
    url: item.url,                  // 原图（代理）
    thumbnailUrl: item.thumb_url,   // 缩略图（代理+压缩）
    width: item.width,
    height: item.height,
    createdAt: item.timeStamp ? new Date(item.timeStamp).toISOString() : null,
    tags: item.tags || [],
    // 自定义扩展字段
    _style: item.style,
    _color: item.color,
    _orientation: item.orientation,
    _channel: item.channel,
    // 兼容原项目的 category 字段
    category: item.style || '',
  }
}

// ======== 核心 API 函数 ========

/**
 * 获取壁纸列表
 */
export async function fetchWallpapers(opts = {}) {
  const params = new URLSearchParams()
  if (opts.orientation) params.set('orientation', opts.orientation)
  if (opts.style)       params.set('style', opts.style)
  if (opts.color)       params.set('color', opts.color)
  if (opts.tags)        params.set('tags', opts.tags)
  params.set('page',        String(opts.page  || 1))
  params.set('limit',       String(opts.limit || 30))
  params.set('random',      opts.random ? 'true' : 'false')
  params.set('thumb',       opts.thumb !== false ? 'true' : 'false')
  params.set('thumb_width', String(opts.thumbWidth || 800))

  const resp = await fetch(`/api/wallpapers?${params}`)
  if (!resp.ok) throw new Error(`API ${resp.status}`)
  const data = await resp.json()

  return {
    total:      data.total,
    page:       data.page,
    limit:      data.limit,
    totalPages: data.totalPages,
    items:      (data.items || []).map(toWallpaperItem),
  }
}

/**
 * 获取随机壁纸
 */
export async function fetchRandom(opts = {}) {
  const params = new URLSearchParams()
  params.set('type', opts.type || 'url')
  if (opts.orientation) params.set('orientation', opts.orientation)
  if (opts.style)       params.set('style', opts.style)
  if (opts.color)       params.set('color', opts.color)
  params.set('thumb', opts.thumb !== false ? 'true' : 'false')
  if (opts.w) params.set('w', String(opts.w))

  const resp = await fetch(`/api/random?${params}`)
  if (!resp.ok) throw new Error(`API ${resp.status}`)

  if (opts.type === 'img') return resp
  const item = await resp.json()
  return toWallpaperItem(item)
}

/**
 * 获取指定风格的分类数据（模拟原项目的 loadCategory 行为）
 */
export async function loadStyleCategory(style, orientation = '') {
  const result = await fetchWallpapers({
    style,
    orientation,
    limit: 100,
    thumb: true,
    thumbWidth: 800,
  })
  return result.items
}

/**
 * 获取系列索引（模拟原项目的 loadSeriesIndex 行为）
 * 返回该系列下所有分类的概要信息
 */
export async function loadSeriesIndex(seriesId) {
  // seriesId 映射到方向
  const orientationMap = {
    desktop: 'horizontal',
    mobile:  'vertical',
    avatar:  'square',
  }
  const orientation = orientationMap[seriesId] || ''

  // 获取各风格的数量
  const categories = await Promise.all(
    STYLES.map(async s => {
      try {
        const r = await fetchWallpapers({ orientation, style: s.key, limit: 1 })
        return { key: s.key, label: s.label, icon: s.icon, total: r.total }
      } catch {
        return { key: s.key, label: s.label, icon: s.icon, total: 0 }
      }
    })
  )

  return {
    series: seriesId,
    categories: categories.filter(c => c.total > 0),
  }
}

/**
 * 获取图片代理URL
 */
export function getImageUrl(fileKey, opts = {}) {
  const encoded = encodeURIComponent(fileKey)
  let url = `/api/file/${encoded}`
  const params = new URLSearchParams()
  if (opts.w) params.set('w', String(opts.w))
  if (opts.q) params.set('q', String(opts.q))
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}
