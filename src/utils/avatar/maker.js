/**
 * 头像自制工具函数
 */

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
export const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export const AVATAR_OUTPUT_CONFIG = {
  size: 440,
  quality: 0.92,
  format: 'png',
}

/**
 * 验证图片文件
 */
export function validateImageFile(file) {
  if (!file || !(file instanceof File)) {
    return { valid: false, error: '请选择有效的文件' }
  }
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: '不支持的图片格式，请上传 JPG、PNG、GIF 或 WebP 格式' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: '图片大小不能超过 10MB' }
  }
  return { valid: true }
}

/**
 * 验证图片 URL
 */
export function validateImageUrl(url) {
  if (!url || typeof url !== 'string')
    return false
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  }
  catch {
    return false
  }
}

/**
 * 生成头像文件名
 */
export function generateAvatarFilename(shape = 'circle') {
  const now = new Date()
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')
  const shapeLabel = shape === 'square' ? 'square' : 'circle'
  return `avatar_${shapeLabel}_${timestamp}.png`
}
