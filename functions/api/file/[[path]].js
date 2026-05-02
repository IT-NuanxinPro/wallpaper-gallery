/**
 * GET /api/file/<encoded_key> - 图片代理层
 *
 * 从 D1 数据库读取文件元数据，用 Bot Token 代理 Telegram 图片
 * Bot Token 存在环境变量 WG_BOT_TOKENS 中，前端永远看不到
 *
 * 参数：
 *   ?w=800      缩略图宽度（利用 CF Image Resizing，返回 WebP）
 *   ?q=80       图片质量（默认80）
 *
 * 环境变量（CF Pages 设置）：
 *   WG_BOT_TOKENS  JSON: { "-100xxxx": "botToken", ... }
 *   DB             D1 数据库绑定（变量名固定为 DB）
 */

export async function onRequest(context) {
  const { request, env, params } = context
  const url = new URL(request.url)

  // 拼接文件 key（支持多级路径）
  const rawPath = params.path
  const fileKey = Array.isArray(rawPath)
    ? rawPath.map(decodeURIComponent).join('/')
    : decodeURIComponent(rawPath || '')

  if (!fileKey) {
    return new Response('Missing file key', { status: 400 })
  }

  // 从 D1 查询文件元数据
  let row
  try {
    const stmt = env.DB.prepare(
      'SELECT TgFileId, TgChatId, TgBotToken, FileType, Width, Height FROM files WHERE id = ?'
    )
    const result = await stmt.bind(fileKey).first()
    row = result
  } catch (e) {
    return new Response('D1 query error: ' + e.message, { status: 500 })
  }

  if (!row) {
    return new Response('File not found', { status: 404 })
  }

  // 获取 Bot Token（优先从 WG_BOT_TOKENS 环境变量，其次用 D1 里存的，但不暴露给前端）
  let botToken
  try {
    const tokenMap = JSON.parse(env.WG_BOT_TOKENS || '{}')
    botToken = tokenMap[row.TgChatId] || row.TgBotToken
  } catch {
    botToken = row.TgBotToken
  }

  if (!botToken) {
    return new Response('No bot token configured', { status: 500 })
  }

  // 调用 Telegram getFile API 获取真实文件路径
  let tgFilePath
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${row.TgFileId}`
    )
    const data = await resp.json()
    if (!data.ok) {
      return new Response('Telegram getFile failed', { status: 502 })
    }
    tgFilePath = data.result.file_path
  } catch (e) {
    return new Response('Telegram API error: ' + e.message, { status: 502 })
  }

  const originalUrl = `https://api.telegram.org/file/bot${botToken}/${tgFilePath}`

  // 解析缩略图参数
  const width = parseInt(url.searchParams.get('w') || '0')
  const quality = parseInt(url.searchParams.get('q') || '80')

  // 构建 fetch 选项（CF Image Resizing 无需付费套餐，在 Workers/Pages 中免费可用）
  const fetchOptions = {}
  if (width > 0) {
    fetchOptions.cf = {
      image: {
        width,
        quality,
        format: 'webp'
      }
    }
  }

  let imgResp
  try {
    imgResp = await fetch(originalUrl, fetchOptions)
  } catch (e) {
    return new Response('Image fetch failed: ' + e.message, { status: 502 })
  }

  const headers = new Headers()
  headers.set('Content-Type', width > 0 ? 'image/webp' : (row.FileType || 'image/jpeg'))
  headers.set('Cache-Control', 'public, max-age=86400')
  headers.set('Access-Control-Allow-Origin', '*')
  if (row.Width) headers.set('X-Image-Width', String(row.Width))
  if (row.Height) headers.set('X-Image-Height', String(row.Height))

  return new Response(imgResp.body, { status: 200, headers })
}
