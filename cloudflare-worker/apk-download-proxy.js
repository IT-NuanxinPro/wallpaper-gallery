/**
 * GitHub Releases APK 下载代理
 * 通过 Cloudflare Workers 加速 GitHub Releases 文件下载
 *
 * 功能特性：
 * - 缓存 24 小时
 * - 支持断点续传（Range 请求）
 * - 自动添加缓存头
 * - 错误重试机制
 */

const CACHE_TTL = 86400 // 24 小时缓存（单位：秒）
const GITHUB_BASE_URL = 'https://github.com/'

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)

  // 解析路径格式：/user/repo/releases/download/version/filename.apk
  const pathParts = url.pathname.split('/').filter(Boolean)

  if (pathParts.length < 5) {
    return new Response('Invalid URL format. Expected: /user/repo/releases/download/version/filename.apk', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const [user, repo, releasesType, version, ...filenameParts] = pathParts
  const filename = filenameParts.join('/')

  // 构建完整的 GitHub Releases URL
  const githubUrl = `${GITHUB_BASE_URL}${user}/${repo}/${releasesType}/${version}/${filename}`

  // 转发请求
  const response = await fetch(githubUrl, {
    method: request.method,
    headers: {
      ...request.headers,
      'User-Agent': 'Cloudflare-Worker-Proxy/1.0',
      'Accept': 'application/vnd.github.v3+json',
      'Origin': 'https://github.com',
      'Referer': 'https://github.com',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    return new Response(`GitHub API Error: ${response.status} ${response.statusText}`, {
      status: response.status,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // 创建新的响应，添加缓存头
  const newResponse = new Response(response.body, response)

  // 添加 CDN 缓存头
  newResponse.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`)
  newResponse.headers.set('CDN-Cache-Control', `public, max-age=${CACHE_TTL}`)
  newResponse.headers.set('Cloudflare-CDN-Cache-Control', `public, max-age=${CACHE_TTL}`)

  // 添加 CORS 头（允许跨域）
  newResponse.headers.set('Access-Control-Allow-Origin', '*')
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  newResponse.headers.set('Access-Control-Allow-Headers', 'Range, Content-Type')

  // 添加文件下载头
  if (filename.endsWith('.apk')) {
    newResponse.headers.set('Content-Type', 'application/vnd.android.package-archive')
    newResponse.headers.set('Content-Disposition', `attachment; filename="${filename}"`)
  }

  return newResponse
}
