/**
 * GET /api/random - 随机图接口（公开）
 *
 * 参数：
 *   type         url(JSON) | img(直接输出图片流)
 *   orientation  horizontal | vertical | square
 *   style        风格大类
 *   color        主色调
 *   thumb        true(默认) | false
 *   w            缩略图宽度（type=img时生效，默认1920）
 */

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)

  const type = url.searchParams.get('type') || 'url'
  const thumb = url.searchParams.get('thumb') !== 'false'
  const w = parseInt(url.searchParams.get('w') || '1920')

  // 复用 wallpapers 接口逻辑
  const listUrl = new URL('/api/wallpapers', url.origin)
  listUrl.searchParams.set('random', 'true')
  listUrl.searchParams.set('limit', '1')
  listUrl.searchParams.set('thumb', String(thumb))
  listUrl.searchParams.set('thumb_width', String(w))

  // 透传筛选参数
  ;['orientation', 'style', 'color', 'tags'].forEach(k => {
    const v = url.searchParams.get(k)
    if (v) listUrl.searchParams.set(k, v)
  })

  const listResp = await fetch(listUrl.toString())
  const listData = await listResp.json()

  if (!listData.items || listData.items.length === 0) {
    return new Response(JSON.stringify({ error: 'No matching images' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }

  const item = listData.items[0]
  const imageUrl = item.thumb_url || item.url

  if (type === 'img') {
    const imgResp = await fetch(imageUrl)
    return new Response(imgResp.body, {
      headers: {
        'Content-Type': imgResp.headers.get('Content-Type') || 'image/webp',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'X-Image-Id': item.id,
        'X-Image-Style': item.style || '',
        'X-Image-Color': item.color || ''
      }
    })
  }

  return new Response(JSON.stringify(item), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    }
  })
}
