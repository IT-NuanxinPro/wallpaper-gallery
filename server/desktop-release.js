const RELEASE_API = 'https://api.github.com/repos/IT-NuanxinPro/wallpaper-gallery/releases/tags/desktop'
const RELEASE_BASE = 'https://github.com/IT-NuanxinPro/wallpaper-gallery/releases'
const ASSET_NAMES = {
  windows: 'Wallpaper-Gallery-Windows-x64.msi',
  macos: 'Wallpaper-Gallery-macOS-universal.dmg',
  linux: 'Wallpaper-Gallery-linux-x86_64.AppImage',
  deb: 'Wallpaper-Gallery-linux-x86_64.deb',
}

// 发布流程完成所有安装包上传后才写标记，网页版本先更新不代表安装包已就绪。
export function parseDesktopRelease(release) {
  const version = release?.body?.match(/<!-- wallpaper-desktop-version:((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)) -->/)?.[1]
  if (!version || version.length > 32 || release.draft || release.prerelease || !Array.isArray(release.assets))
    return { available: false }
  const downloads = {}
  let publishedAt = ''
  for (const [platform, name] of Object.entries(ASSET_NAMES)) {
    const asset = release.assets.find(item => item.name === name)
    const url = `${RELEASE_BASE}/download/desktop/${name}`
    if (!asset || asset.state !== 'uploaded' || !(asset.size > 0) || asset.browser_download_url !== url)
      return { available: false }
    downloads[platform] = url
    if (typeof asset.updated_at === 'string' && Number.isFinite(Date.parse(asset.updated_at)) && asset.updated_at > publishedAt)
      publishedAt = asset.updated_at
  }
  return { available: true, version, publishedAt, releaseUrl: `${RELEASE_BASE}/tag/desktop`, notesUrl: `${RELEASE_BASE}/tag/v${version}`, downloads }
}

export async function handleDesktopReleaseRequest(request, { fetch: fetchImpl = fetch, cache, assets } = {}) {
  if (!['GET', 'HEAD'].includes(request.method))
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
  if (assets) {
    try {
      const source = await assets.fetch(new Request(new URL('/desktop-release.json', request.url)))
      if (!source.ok)
        throw new Error('Release manifest unavailable')
      const info = await source.json()
      if (info.available !== false) {
        if (info.available !== true || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(info.version)
          || info.releaseUrl !== `${RELEASE_BASE}/tag/desktop` || info.notesUrl !== `${RELEASE_BASE}/tag/v${info.version}`
          || Object.entries(ASSET_NAMES).some(([platform, name]) => info.downloads?.[platform] !== `${RELEASE_BASE}/download/desktop/${name}`)) {
          throw new Error('Invalid release manifest')
        }
      }
      return new Response(request.method === 'HEAD' ? null : JSON.stringify(info), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60, s-maxage=300', 'X-Content-Type-Options': 'nosniff' } })
    }
    catch {
      return Response.json({ error: '发布信息暂不可用' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
  }
  const key = new Request(new URL('/api/desktop-release', request.url), { method: 'GET' })
  let response
  try {
    response = await cache?.match(key)
  }
  catch {}
  if (!response) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const upstream = await fetchImpl(RELEASE_API, {
        signal: controller.signal,
        redirect: 'error',
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'Wallpaper-Gallery-Update-Check' },
      })
      if (!upstream.ok)
        throw new Error('Release unavailable')
      const info = parseDesktopRelease(await upstream.json())
      response = Response.json(info, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300', 'X-Content-Type-Options': 'nosniff' } })
      try {
        await cache?.put(key, response.clone())
      }
      catch {}
    }
    catch {
      response = Response.json({ error: '发布信息暂不可用' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
    finally {
      clearTimeout(timeout)
    }
  }
  return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response
}
