/**
 * POST /api/admin/login - 管理员登录
 * POST /api/admin/logout - 登出
 * GET  /api/admin/verify - 验证会话
 *
 * 环境变量：
 *   ADMIN_USER     管理员用户名
 *   ADMIN_PASS     管理员密码（明文，建议改为哈希）
 *   ADMIN_SECRET   JWT签名密钥（随机字符串，至少32位）
 */

const SESSION_COOKIE = 'wg_admin_session'
const SESSION_TTL = 7 * 24 * 3600  // 7天

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const action = url.pathname.split('/').pop()

  if (request.method === 'OPTIONS') {
    return corsPrelight()
  }

  if (action === 'login' && request.method === 'POST') {
    return handleLogin(request, env)
  }
  if (action === 'logout') {
    return handleLogout()
  }
  if (action === 'verify') {
    return handleVerify(request, env)
  }

  return new Response('Not found', { status: 404 })
}

async function handleLogin(request, env) {
  let body
  try {
    body = await request.json()
  } catch {
    return jsonResp({ error: 'Invalid JSON' }, 400)
  }

  const { username, password } = body
  const adminUser = env.ADMIN_USER || 'admin'
  const adminPass = env.ADMIN_PASS || 'changeme'

  if (username !== adminUser || password !== adminPass) {
    return jsonResp({ error: '用户名或密码错误' }, 401)
  }

  // 生成简单 session token（生产环境建议用 JWT）
  const token = await generateToken(env.ADMIN_SECRET || 'default-secret-change-me')
  const expires = new Date(Date.now() + SESSION_TTL * 1000).toUTCString()

  return new Response(JSON.stringify({ success: true, token }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Expires=${expires}`,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true'
    }
  })
}

function handleLogout() {
  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      'Access-Control-Allow-Origin': '*'
    }
  })
}

async function handleVerify(request, env) {
  const token = getSessionToken(request)
  if (!token) return jsonResp({ valid: false }, 401)

  const valid = await verifyToken(token, env.ADMIN_SECRET || 'default-secret-change-me')
  return jsonResp({ valid })
}

// ---- 工具函数 ----

async function generateToken(secret) {
  const payload = {
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL,
    role: 'admin'
  }
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const data = btoa(JSON.stringify(payload))
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return `${data}.${sigB64}`
}

async function verifyToken(token, secret) {
  try {
    const [data, sig] = token.split('.')
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data))
    if (!valid) return false
    const payload = JSON.parse(atob(data))
    return payload.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

function getSessionToken(request) {
  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  return match ? match[1] : null
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
}

function corsPrelight() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true'
    }
  })
}
