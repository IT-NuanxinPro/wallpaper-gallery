/** 统一展示名称；文件格式继续由 filename / format 提供，不改资源身份。 */
export function getWallpaperDisplayTitle(record) {
  const value = typeof record === 'string' ? record : record?.displayTitle || record?.title || record?.filename
  return String(value || '').trim().replace(/\.(?=[a-z\d]*[a-z])[a-z\d]+$/i, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim()
}
