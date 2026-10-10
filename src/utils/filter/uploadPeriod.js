/**
 * 按用户本地日历筛选新增壁纸：本周从周一零点开始，本月从一号零点开始。
 * 周/月热门使用累计热度排序，但候选壁纸必须在对应期间上传。
 */
export function filterByUploadPeriod(wallpapers, sortBy, now = new Date()) {
  if (!['weekly-hot', 'monthly-hot'].includes(sortBy)) {
    return wallpapers
  }

  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  if (sortBy === 'weekly-hot') {
    start.setDate(start.getDate() - (start.getDay() + 6) % 7)
  }
  else {
    start.setDate(1)
  }

  return wallpapers.filter((wallpaper) => {
    if (!wallpaper.createdAt)
      return false

    const uploadedAt = new Date(wallpaper.createdAt).getTime()
    return uploadedAt >= start.getTime() && uploadedAt <= now.getTime()
  })
}
