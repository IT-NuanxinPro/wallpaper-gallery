import { describe, expect, it } from 'vitest'
import { formatInteractionError } from '../src/utils/interaction/errors.js'

describe('formatInteractionError', () => {
  it('maps unauthenticated errors to a login hint', () => {
    expect(formatInteractionError(new Error('未登录'))).toEqual({
      message: '请先登录后再操作',
      type: 'warning',
    })
  })

  it('maps foreign key errors to a data sync hint', () => {
    expect(formatInteractionError({
      code: '23503',
      message: 'insert or update on table violates foreign key constraint',
    })).toEqual({
      message: '当前壁纸数据尚未同步完成，请刷新页面后再试',
      type: 'warning',
    })
  })

  it('maps row level security errors to a permission hint', () => {
    expect(formatInteractionError({
      code: '42501',
      message: 'new row violates row-level security policy',
    })).toEqual({
      message: '当前账号暂无权限执行此操作，请重新登录后再试',
      type: 'warning',
    })
  })

  it('maps network failures to a network hint', () => {
    expect(formatInteractionError(new Error('Failed to fetch'))).toEqual({
      message: '网络连接异常，请检查网络后重试',
      type: 'error',
    })
  })

  it('does not expose unknown backend messages', () => {
    expect(formatInteractionError({
      message: 'relation user_wallpaper_likes_internal does not exist',
    })).toEqual({
      message: '操作失败，请稍后重试',
      type: 'error',
    })
  })
})
