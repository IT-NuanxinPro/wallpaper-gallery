/**
 * GET /api/wallpapers - 壁纸列表接口（公开，无需认证）
 *
 * D1 数据库表结构（ImgBed 存储）：
 *   files 表: id(key), FileName, FileType, Width, Height,
 *             Directory, Tags(JSON), Channel, ChannelName,
 *             TgFileId, TgChatId, TimeStamp, ListType
 *
 * 查询参数：
 *   orientation  horizontal | vertical | square
 *   style        动漫_二次元 | 魅力_迷人 | 自然_风景 | 自制_艺术 | 游戏_玩具 | 安逸_自由 | 科幻_星云 | 程序_代码
 *   color        偏蓝 | 灰_白 | 暗色 | 紫_粉 | 偏黄 | 偏绿 | 偏红 | 其他颜色
 *   tags         额外标签，逗号分隔（模糊匹配）
 *   page         页码（默认1）
 *   limit        每页数量（默认30，最大100）
 *   random       是否随机（true/false）
 *   thumb        是否返回缩略图URL（true/false）
 *   thumb_width  缩略图宽度（默认800）
 */

const ORIENTATION_TAG = {
  horizontal: '横图',
  vertical: '竖图',
  square: '方图'
}

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)

  if (request.method === 'OPTIONS') {
    return corsResp()
  }

  const orientation = url.searchParams.get('orientation') || ''
  const style = url.searchParams.get('style') || ''
  const color = url.searchParams.get('color') || ''
  const tagsParam = url.searchParams.get('tags') || ''
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '30')))
  const isRandom = url.searchParams.get('random') === 'true'
  const needThumb = url.searchParams.get('thumb') !== 'false'  // 默认开启缩略图
  const thumbWidth = parseInt(url.searchParams.get('thumb_width') || '800')

  // 构建 SQL WHERE 条件
  // D1 中 Tags 字段存储为 JSON 数组字符串，用 LIKE 模糊匹配
  const conditions = ["Channel = 'TelegramNew'", "ListType != 'Block'"]
  const bindings = []

  // 目录前缀匹配（利用 Directory 字段加速）
  // Directory 格式: wallpaper/static/{方向}/{风格}/
  let dirPrefix = 'wallpaper/static/'
  if (orientation && ORIENTATION_TAG[orientation]) {
    dirPrefix += ORIENTATION_TAG[orientation] + '/'
    if (style) dirPrefix += style + '/'
  } else if (style) {
    // 无方向限制时，用 Tags 匹配
    conditions.push("Tags LIKE ?")
    bindings.push(`%"${style}"%`)
  }

  if (dirPrefix !== 'wallpaper/static/') {
    conditions.push("Directory LIKE ?")
    bindings.push(dirPrefix + '%')
  }

  // 颜色匹配（Tags[3]）
  if (color) {
    conditions.push("Tags LIKE ?")
    bindings.push(`%"${color}"%`)
  }

  // 额外标签匹配
  if (tagsParam) {
    tagsParam.split(',').forEach(tag => {
      const t = tag.trim()
      if (t) {
        conditions.push("Tags LIKE ?")
        bindings.push(`%"${t}"%`)
      }
    })
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  // 查询总数
  let total = 0
  try {
    const countStmt = env.DB.prepare(`SELECT COUNT(*) as cnt FROM files ${whereClause}`)
    const countResult = await countStmt.bind(...bindings).first()
    total = countResult?.cnt || 0
  } catch (e) {
    return jsonResp({ error: 'D1 count error: ' + e.message }, 500)
  }

  // 查询数据
  const offset = (page - 1) * limit
  const orderBy = isRandom ? 'ORDER BY RANDOM()' : 'ORDER BY TimeStamp DESC'
  const query = `
    SELECT id, FileName, FileType, Width, Height, Directory, Tags,
           ChannelName, TimeStamp, TgFileId, TgChatId
    FROM files
    ${whereClause}
    ${orderBy}
    LIMIT ? OFFSET ?
  `

  let rows = []
  try {
    const stmt = env.DB.prepare(query)
    const result = await stmt.bind(...bindings, limit, offset).all()
    rows = result.results || []
  } catch (e) {
    return jsonResp({ error: 'D1 query error: ' + e.message }, 500)
  }

  // 构建返回数据
  const baseUrl = `${url.protocol}//${url.host}`
  const items = rows.map(row => {
    let tags = []
    try {
      tags = JSON.parse(row.Tags || '[]')
    } catch {}

    const encodedKey = encodeURIComponent(row.id)
    const origUrl = `${baseUrl}/api/file/${encodedKey}`
    const thumbUrl = needThumb ? `${origUrl}?w=${thumbWidth}` : origUrl

    return {
      id: row.id,
      url: origUrl,
      thumb_url: thumbUrl,
      width: row.Width,
      height: row.Height,
      orientation: tags[1] || 'unknown',
      style: tags[2] || '',
      color: tags[3] || '',
      tags: tags.slice(4),
      fileName: row.FileName,
      timeStamp: row.TimeStamp,
      channel: row.ChannelName
    }
  })

  return jsonResp({
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    items
  })
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    }
  })
}

function corsResp() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
