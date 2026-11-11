export const WALLPAPER_CARD_ASPECT_RATIOS = {
  desktop: '16/10',
  mobile: '9/16',
  avatar: '1/1',
  bing: '16/9',
  video: '16/9',
}

/** 展示裁切比例独立于原文件尺寸；已有调用方的静态卡片比例继续优先。 */
export function getWallpaperCardAspectRatio(record, imageAspectRatio = '') {
  const series = record?._series || record?.series || (record?.isBing ? 'bing' : '')
  if (series === 'video' || record?.mediaType === 'video')
    return ['mobile', 'social-cover'].includes(record?.usage || record?.category) ? WALLPAPER_CARD_ASPECT_RATIOS.mobile : WALLPAPER_CARD_ASPECT_RATIOS.video
  return imageAspectRatio || WALLPAPER_CARD_ASPECT_RATIOS[series] || WALLPAPER_CARD_ASPECT_RATIOS.desktop
}
