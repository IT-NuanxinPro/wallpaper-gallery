/**
 * 按用户本地日历筛选新增壁纸：本周从周一零点开始，本月从一号零点开始。
 * 仅用于明确的新增筛选，周/月热门按期间互动统计，不限制上传时间。
 */
export function filterByUploadPeriod(wallpapers, sortBy, now = new Date()) {
  if (!['weekly-new', 'monthly-new'].includes(sortBy)) {
    return wallpapers
  }

  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  if (sortBy === 'weekly-new') {
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
