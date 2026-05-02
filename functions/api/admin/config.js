/**
 * GET  /api/admin/config  读取API配置
 * POST /api/admin/config  保存API配置
 *
 * 配置存储在 D1 的 settings 表中（key = 'wg_api_config'）
 * 如果 settings 表不存在，降级使用内存默认值
 */

const SESSION_COOKIE = 'wg_admin_session'

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return corsResp()
  }

  if (!await checkAuth(request, env)) {
    return jsonResp({ error: '未授权' }, 401)
  }

  if (request.method === 'GET') return getConfig(env)
  if (request.method === 'POST') return saveConfig(request, env)
  return jsonResp({ error: 'Method not allowed' }, 405)
}

async function getConfig(env) {
  try {
    // 尝试从 D1 settings 表读取
    const result = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'wg_api_config'"
    ).first()
    const config = result ? JSON.parse(result.value) : defaultConfig()
    return jsonResp(config)
  } catch {
    return jsonResp(defaultConfig())
  }
}

async function saveConfig(request, env) {
  let body
  try { body = await request.json() }
  catch { return jsonResp({ error: 'Invalid JSON' }, 400) }

  const config = { ...defaultConfig(), ...body }
  const value = JSON.stringify(config)

  try {
    // INSERT OR REPLACE 写入 D1（settings 表需存在，否则创建）
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s','now'))
      )
    `).run()

    await env.DB.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('wg_api_config', ?)"
    ).bind(value).run()

    return jsonResp({ success: true, config })
  } catch (e) {
    return jsonResp({ error: 'Save failed: ' + e.message }, 500)
  }
}

function defaultConfig() {
  return {
    randomApi: {
      enabled: true,
      defaultThumb: true,
      defaultThumbWidth: 1920,
      defaultOrientation: '',
      defaultStyle: '',
      defaultColor: '',
      defaultStyles: [],
      defaultColors: []
    },
    gallery: {
      defaultPageSize: 30,
      enableSearch: true,
      enableColorFilter: true,
      enableStyleFilter: true,
      showResolution: true
    }
  }
}

async function checkAuth(request, env) {
  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  if (!match) return false
  try {
    const [data, sig] = match[1].split('.')
    const secret = env.ADMIN_SECRET || 'default-secret'
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data))
    if (!valid) return false
    const payload = JSON.parse(atob(data))
    return payload.exp > Math.floor(Date.now() / 1000)
  } catch { return false }
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
}

function corsResp() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
