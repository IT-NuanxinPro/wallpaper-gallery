function normalizeErrorValue(value) {
  return String(value || '').trim()
}

function resolveErrorCode(error) {
  if (!error || typeof error !== 'object')
    return ''

  return normalizeErrorValue(
    error.code
    || error.status
    || error.statusCode
    || error.name,
  ).toLowerCase()
}

function resolveErrorMessage(error) {
  if (!error)
    return ''

  if (typeof error === 'string')
    return normalizeErrorValue(error)

  if (typeof error !== 'object')
    return normalizeErrorValue(error)

  return [
    error.message,
    error.details,
    error.hint,
    error.error_description,
    error.description,
    error.error,
  ]
    .map(normalizeErrorValue)
    .filter(Boolean)
    .join(' ')
}

export function formatInteractionError(error) {
  const code = resolveErrorCode(error)
  const message = resolveErrorMessage(error)
  const normalizedMessage = message.toLowerCase()

  if (message === '未登录') {
    return {
      message: '请先登录后再操作',
      type: 'warning',
    }
  }

  if (message === 'Supabase 未配置') {
    return {
      message: '当前环境未配置账号服务，暂时无法使用喜欢和收藏功能',
      type: 'warning',
    }
  }

  if (message === '无效的壁纸标识') {
    return {
      message: '当前壁纸信息异常，请刷新页面后重试',
      type: 'warning',
    }
  }

  if (message === '未找到默认收藏夹') {
    return {
      message: '默认收藏夹暂不可用，请刷新页面或重新登录后重试',
      type: 'warning',
    }
  }

  if (
    code === '401'
    || code === 'pgrst301'
    || code === 'authsessionmissingerror'
    || /jwt.*expired|invalid.*jwt|auth session missing|not authenticated|unauthorized/.test(normalizedMessage)
  ) {
    return {
      message: '登录状态已失效，请重新登录后再操作',
      type: 'warning',
    }
  }

  if (
    code === '429'
    || /^over_.*rate_limit$/.test(code)
    || /rate limit|too many requests/.test(normalizedMessage)
  ) {
    return {
      message: '操作过于频繁，请稍后再试',
      type: 'warning',
    }
  }

  if (
    /failed to fetch|networkerror|network error|network request failed|load failed|timeout|timed out/.test(normalizedMessage)
  ) {
    return {
      message: '网络连接异常，请检查网络后重试',
      type: 'error',
    }
  }

  if (
    code === '403'
    || code === '42501'
    || /row level security|permission denied|not authorized|forbidden/.test(normalizedMessage)
  ) {
    return {
      message: '当前账号暂无权限执行此操作，请重新登录后再试',
      type: 'warning',
    }
  }

  if (code === '23503' || /foreign key constraint/.test(normalizedMessage)) {
    return {
      message: '当前壁纸数据尚未同步完成，请刷新页面后再试',
      type: 'warning',
    }
  }

  if (code === '23505' || /duplicate key|unique constraint/.test(normalizedMessage)) {
    return {
      message: '状态已发生变化，请刷新页面后重试',
      type: 'warning',
    }
  }

  return {
    message: '操作失败，请稍后重试',
    type: 'error',
  }
}
