export function classifyWallpaperError(error) {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'network'
  }

  if (error.message && error.message.includes('HTTP error')) {
    return 'network'
  }

  if (error instanceof SyntaxError || error.message.includes('JSON')) {
    return 'parse'
  }

  if (error.message && (error.message.includes('Invalid') || error.message.includes('format'))) {
    return 'format'
  }

  return 'unknown'
}

export function getWallpaperErrorMessage(error, errorType, context = '') {
  const contextStr = context ? ` (${context})` : ''

  switch (errorType) {
    case 'network':
      return `网络连接失败，请检查网络设置${contextStr}`
    case 'parse':
      return `数据解析失败，可能是数据格式错误${contextStr}`
    case 'format':
      return `数据格式错误${contextStr}`
    default:
      return error.message || `加载失败${contextStr}`
  }
}
