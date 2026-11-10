/** 限制实际导出的画布分配；设备偏好可更大，但不能静默截断输出。 */
export function getCropOutputSizeError(width, height) {
  if (![width, height].every(value => Number.isInteger(value) && value > 0))
    return '请输入有效的整数宽度和高度'
  if (width > 8192 || height > 8192 || width * height > 16_777_216)
    return '导出单边最多 8192 像素，总像素最多 16,777,216；请减小输出尺寸'
  return ''
}
