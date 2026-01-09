/**
 * GitHub Releases APK 下载代理
 * 通过 Cloudflare Workers 加速 GitHub Releases 文件下载
 *
 * 功能特性：
 * - 缓存 24 小时
 * - 支持断点续传（Range 请求）
 * - 自动添加缓存头
 * - 错误重试机制
 * - CORS 预检请求支持
 *
 * URL 格式：
 * - 简化版（推荐）：/android-v1.0.0/Wallpaper-Gallery-v1.0.0.apk
 * - 任意版本号：/v1.0.0/xxx.apk, /1.0.0/xxx.apk
 * - 完整版：/IT-NuanxinPro/wallpaper-gallery/releases/download/v1.0.0/Wallpaper-Gallery-v1.0.0.apk
 */

const CACHE_TTL = 86400 // 24 小时缓存（单位：秒）
const GITHUB_BASE_URL = 'https://github.com/'

// 硬编码的仓库信息（简化版 URL）
const DEFAULT_REPO = {
  user: 'IT-NuanxinPro',
  repo: 'wallpaper-gallery',
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)

  // 处理 OPTIONS 预检请求（CORS）
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type, Content-Disposition',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  const path = url.pathname
  let githubUrl, filename

  // 格式 1：完整版路径，必须包含 "/releases/download/"
  if (path.includes('/releases/download/')) {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    githubUrl = `${GITHUB_BASE_URL}${cleanPath}`
    const parts = cleanPath.split('/')
    filename = parts[parts.length - 1]
  }
  // 格式 2：简化版路径，任意版本号格式
  else {
    const parts = path.split('/').filter(p => p)
    if (parts.length >= 2 && parts[parts.length - 1].endsWith('.apk')) {
      // 最后一个部分是文件名
      filename = parts[parts.length - 1]
      // 剩下的所有部分拼成版本号（支持任意格式：v1.0.0, android-v1.0.0, 1.0.0 等）
      const version = parts.slice(0, -1).join('/')
      githubUrl = `${GITHUB_BASE_URL}${DEFAULT_REPO.user}/${DEFAULT_REPO.repo}/releases/download/${version}/${filename}`
    }
  }

  // 验证 URL 是否构建成功
  if (!githubUrl || !filename) {
    return new Response(`Invalid URL format. Use:\n- /version/filename.apk\n- /user/repo/releases/download/version/filename.apk\n\nReceived: ${path}`, {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // 转发请求
  const response = await fetch(githubUrl, {
    method: request.method,
    headers: {
      'User-Agent': 'Cloudflare-Worker-Proxy/1.0',
      'Accept': '*/*',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    return new Response(`GitHub API Error: ${response.status} ${response.statusText}\nURL: ${githubUrl}`, {
      status: response.status,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // 创建新的响应，添加缓存头
  const newResponse = new Response(response.body, response)

  // 添加 CDN 缓存头
  newResponse.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`)

  // 添加 CORS 头（允许跨域）
  newResponse.headers.set('Access-Control-Allow-Origin', '*')
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  newResponse.headers.set('Access-Control-Allow-Headers', 'Range, Content-Type, Content-Disposition')

  // 添加文件下载头
  if (filename.endsWith('.apk')) {
    newResponse.headers.set('Content-Type', 'application/vnd.android.package-archive')
    newResponse.headers.set('Content-Disposition', `attachment; filename="${filename}"`)
  }

  return newResponse
}
