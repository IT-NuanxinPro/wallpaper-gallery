import { describe, expect, it } from 'vitest'
import { handleDesktopReleaseRequest, parseDesktopRelease } from '../server/desktop-release.js'

const version = '5.2.0'
const names = ['Wallpaper-Gallery-Windows-x64.msi', 'Wallpaper-Gallery-macOS-universal.dmg', 'Wallpaper-Gallery-linux-x86_64.AppImage', 'Wallpaper-Gallery-linux-x86_64.deb']
const release = () => ({
  draft: false,
  prerelease: false,
  body: `Desktop\n<!-- wallpaper-desktop-version:${version} -->`,
  assets: names.map(name => ({ name, state: 'uploaded', size: 1024, updated_at: '2026-11-10T01:00:00Z', browser_download_url: `https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/download/desktop/${name}` })),
})

describe('客户端发布通知', () => {
  it('只在所有平台文件上传且版本发布标记存在时公开升级', () => {
    const payload = parseDesktopRelease(release())
    expect(payload).toMatchObject({ available: true, version, notesUrl: `https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/tag/v${version}` })
    expect(payload.downloads.windows).toContain('Windows-x64.msi')
    expect(parseDesktopRelease({ ...release(), body: '' })).toEqual({ available: false })
    expect(parseDesktopRelease({ ...release(), assets: release().assets.slice(1) })).toEqual({ available: false })
    expect(parseDesktopRelease({ ...release(), draft: true })).toEqual({ available: false })
  })

  it('拒绝非法版本及不可信下载地址', () => {
    expect(parseDesktopRelease({ ...release(), body: '<!-- wallpaper-desktop-version:garbage -->' })).toEqual({ available: false })
    const data = release()
    data.assets[0].browser_download_url = 'https://evil.example/setup.exe'
    expect(parseDesktopRelease(data)).toEqual({ available: false })
  })

  it('固定上游，缓存可用响应；GitHub失败不声称无更新', async () => {
    let target
    const response = await handleDesktopReleaseRequest(new Request('https://wallpaper.061129.xyz/api/desktop-release'), {
      fetch: async (url) => { target = url; return Response.json(release()) },
    })
    expect(target).toBe('https://api.github.com/repos/IT-NuanxinPro/wallpaper-gallery/releases/tags/desktop')
    expect((await response.json()).version).toBe(version)
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=300')
    const failed = await handleDesktopReleaseRequest(new Request('https://wallpaper.061129.xyz/api/desktop-release'), { fetch: async () => new Response(null, { status: 403 }) })
    expect(failed.status).toBe(503)
    expect(failed.headers.get('Cache-Control')).toBe('no-store')
  })

  it('生产从已核验的本站发布清单读取，不依赖访问者请求GitHub API', async () => {
    const manifest = parseDesktopRelease(release())
    const response = await handleDesktopReleaseRequest(new Request('https://wallpaper.061129.xyz/api/desktop-release'), {
      assets: { fetch: async request => { expect(new URL(request.url).pathname).toBe('/desktop-release.json'); return Response.json(manifest) } },
      fetch: () => { throw new Error('Unexpected external request') },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(manifest)
  })
})
