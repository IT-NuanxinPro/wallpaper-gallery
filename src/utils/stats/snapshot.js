// 前端与 Node 导出共用统计协议，避免两端采用不同的字段或分页规则。
export const STATS_SCHEMA = 2
export const STATS_PAGE_SIZE = 500
export const STATS_STALE_AFTER = 36 * 60 * 60 * 1000

const COUNT_FIELDS = ['views', 'downloads', 'likes', 'collects', 'week_views', 'week_downloads', 'month_views', 'month_downloads']

function validDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function compareAssetKeys(left, right) {
  const leftPoints = Array.from(left, value => value.codePointAt(0))
  const rightPoints = Array.from(right, value => value.codePointAt(0))
  for (let index = 0; index < Math.min(leftPoints.length, rightPoints.length); index++) {
    if (leftPoints[index] !== rightPoints[index])
      return leftPoints[index] - rightPoints[index]
  }
  return leftPoints.length - rightPoints.length
}

function calendarPeriod(value, period) {
  const date = new Date(Date.parse(value) + 8 * 60 * 60 * 1000)
  date.setUTCHours(0, 0, 0, 0)
  if (period === 'week')
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  else
    date.setUTCDate(1)
  return date.toISOString().slice(0, 10)
}

function validPeriodStart(value, period) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    && (period === 'week' ? date.getUTCDay() === 1 : date.getUTCDate() === 1)
}

export function refreshStatsMetadata(metadata) {
  const now = new Date().toISOString()
  return {
    ...metadata,
    stale: !validDate(metadata.exportedAt) || Date.now() - Date.parse(metadata.exportedAt) > STATS_STALE_AFTER,
    weekAvailable: Boolean(metadata.periodAvailable && metadata.weekStart === calendarPeriod(now, 'week')),
    monthAvailable: Boolean(metadata.periodAvailable && metadata.monthStart === calendarPeriod(now, 'month')),
  }
}

export function normalizeStatsRow(row, series, fromRpc = false) {
  if (!row || typeof row.asset_key !== 'string' || !row.asset_key.startsWith(`${series}:`)
    || row.asset_key.length <= series.length + 1 || typeof row.image_id !== 'string'
    || row.asset_key !== `${series}:${row.image_id}`) {
    throw new Error('统计资源身份无效')
  }

  const item = { asset_key: row.asset_key, image_id: row.image_id, legacy_ambiguous: row.legacy_ambiguous === true }
  for (const field of COUNT_FIELDS) {
    const value = row[fromRpc && !field.startsWith('week_') && !field.startsWith('month_') ? `total_${field}` : field]
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error(`统计字段无效: ${field}`)
    item[field] = value
  }
  return item
}

export async function fetchStatsPages(fetchPage, series, pageSize = STATS_PAGE_SIZE) {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000)
    throw new Error('统计分页大小无效')

  const items = []
  let after = ''
  let periodStartedAt = null
  let weekStart = null
  let monthStart = null
  let totalRows = null
  const seen = new Set()
  for (let pageIndex = 0; pageIndex < 10000; pageIndex++) {
    const page = await fetchPage({ p_series: series, p_after: after, p_limit: pageSize })
    if (!Array.isArray(page) || page.length > pageSize)
      throw new Error('统计分页响应无效')

    for (const row of page) {
      const item = normalizeStatsRow(row, series, true)
      if (seen.has(item.asset_key) || compareAssetKeys(item.asset_key, after) <= 0)
        throw new Error('统计分页游标未推进或资源重复')
      if (!validDate(row.period_started_at))
        throw new Error('统计期间开始时间无效')
      if (periodStartedAt && periodStartedAt !== row.period_started_at)
        throw new Error('统计期间开始时间不一致')
      if (!validPeriodStart(row.week_start, 'week') || !validPeriodStart(row.month_start, 'month'))
        throw new Error('统计周/月边界无效')
      if ((weekStart && weekStart !== row.week_start) || (monthStart && monthStart !== row.month_start))
        throw new Error('统计分页跨越周/月边界，请重新导出')
      if (!Number.isSafeInteger(row.total_rows) || row.total_rows < 1)
        throw new Error('统计总行数无效')
      if (totalRows !== null && totalRows !== row.total_rows)
        throw new Error('统计总行数发生变化，请重新导出')
      periodStartedAt = row.period_started_at
      weekStart = row.week_start
      monthStart = row.month_start
      totalRows = row.total_rows
      seen.add(item.asset_key)
      after = item.asset_key
      items.push(item)
    }
    if (page.length === 0) {
      if (items.length !== (totalRows ?? 0))
        throw new Error('统计分页未返回完整数据')
      return { items, periodStartedAt, weekStart, monthStart }
    }
  }
  throw new Error('统计分页超出安全上限')
}

export function createStatsSnapshot({ items, periodStartedAt, weekStart, monthStart }, exportedAt = new Date().toISOString()) {
  return { schema: STATS_SCHEMA, exportedAt, periodStartedAt, weekStart, monthStart, rowCount: items.length, items }
}

export function parseStatsSnapshot(payload, series) {
  const stats = new Map()
  if (payload?.schema !== STATS_SCHEMA || !Array.isArray(payload.items) || !validDate(payload.exportedAt)
    || !Number.isSafeInteger(payload.rowCount) || payload.rowCount !== payload.items.length
    || (payload.periodStartedAt !== null && !validDate(payload.periodStartedAt))
    || (payload.weekStart !== null && !validPeriodStart(payload.weekStart, 'week'))
    || (payload.monthStart !== null && !validPeriodStart(payload.monthStart, 'month'))
    || (payload.items.length > 0 && (!payload.periodStartedAt || !payload.weekStart || !payload.monthStart))) {
    throw new Error('统计快照格式无效')
  }
  for (const row of payload.items) {
    const item = normalizeStatsRow(row, series)
    if (stats.has(item.asset_key))
      throw new Error('统计快照包含重复资源')
    stats.set(item.asset_key, item)
  }
  stats.metadata = refreshStatsMetadata({
    schema: STATS_SCHEMA,
    exportedAt: payload.exportedAt,
    periodStartedAt: payload.periodStartedAt,
    weekStart: payload.weekStart,
    monthStart: payload.monthStart,
    periodAvailable: Boolean(payload.periodStartedAt),
  })
  return stats
}
