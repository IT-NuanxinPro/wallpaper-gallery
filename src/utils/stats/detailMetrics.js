export const DETAIL_STATS_METRICS = [
  { key: 'views', label: '浏览', title: '有效预览次数', path: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0' },
  { key: 'likes', label: '喜欢', title: '喜欢数', path: 'm12 20-1.4-1.3C5.6 14.2 3 11.8 3 8.5A4.5 4.5 0 0 1 7.5 4c1.7 0 3.3.8 4.5 2.1A6 6 0 0 1 16.5 4 4.5 4.5 0 0 1 21 8.5c0 3.3-2.6 5.7-7.6 10.2Z' },
  { key: 'collects', label: '收藏', title: '收藏数', path: 'm12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9Z' },
  { key: 'downloads', label: '下载', title: '已发起下载次数', path: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5' },
]

export function formatDetailStatsCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString('zh-CN') : '—'
}
