import { Buffer } from 'node:buffer'
import { createReadStream, existsSync, statSync } from 'node:fs'
import fs from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { getRouteSeo, PUBLIC_SITE_PATHS } from '../src/utils/seo/routes.js'
import { buildDetailShell } from './lib/detailShell.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const DIST_DIR = path.resolve(ROOT_DIR, 'dist')
const HOST = '127.0.0.1'
const PORT = Number(process.env.PRERENDER_PORT || 0)
const PRERENDER_ROUTES = PUBLIC_SITE_PATHS
const BROWSER_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean)

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.br': 'application/octet-stream',
}

function getContentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

async function ensureFile(filePath) {
  try {
    await fs.access(filePath)
    return true
  }
  catch {
    return false
  }
}

function resolveRequestPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0])
  const normalizedPath = cleanPath === '/' ? '/index.html' : cleanPath
  const absolutePath = path.join(DIST_DIR, normalizedPath)

  if (existsSync(absolutePath) && statSync(absolutePath).isFile()) {
    return absolutePath
  }

  const htmlPath = path.join(DIST_DIR, `${normalizedPath}.html`)
  if (existsSync(htmlPath)) {
    return htmlPath
  }

  return path.join(DIST_DIR, 'index.html')
}

async function resolveExecutablePath() {
  for (const candidate of BROWSER_CANDIDATES) {
    if (await ensureFile(candidate)) {
      return candidate
    }
  }
  return undefined
}

function startStaticServer() {
  const server = createServer((req, res) => {
    const filePath = resolveRequestPath(req.url || '/')
    res.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Cache-Control': 'no-store',
    })
    createReadStream(filePath).pipe(res)
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(PORT, HOST, () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('无法获取 prerender 静态服务端口。'))
        return
      }

      resolve({
        server,
        baseUrl: `http://${HOST}:${address.port}`,
      })
    })
  })
}

async function waitForSeo(page, route, baseUrl) {
  await page.goto(`${baseUrl}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })

  const expected = getRouteSeo(route)
  await page.waitForFunction(({ title, canonical }) => {
    return document.title === title
      && document.querySelector('link[rel="canonical"]')?.getAttribute('href') === canonical
      && document.querySelector('#app')?.children.length > 0
  }, { timeout: 30000 }, expected)
  if (['/', '/desktop', '/mobile', '/avatar', '/bing', '/video'].includes(route)) {
    await page.waitForFunction(() => document.querySelector('[data-browse-ready="ready"]')
      && document.querySelectorAll('.wallpaper-card a[href^="/wallpaper/"]').length > 0, { timeout: 45000 })
  }
  if (route.startsWith('/collections')) {
    await page.waitForFunction(() => document.querySelector('[data-collection-ready]')?.dataset.collectionReady === 'ready', { timeout: 30000 })
  }
}

async function writeRouteHtml(route, html) {
  const file = route === '/' ? 'index.html' : `${route.slice(1)}.html`
  const target = path.join(DIST_DIR, file)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, html, 'utf8')
}

async function main() {
  const indexExists = await ensureFile(path.join(DIST_DIR, 'index.html'))
  if (!indexExists) {
    throw new Error('dist/index.html 不存在，请先执行构建。')
  }

  const executablePath = await resolveExecutablePath()
  const { server, baseUrl } = await startStaticServer()
  let browser

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: {
        width: 1440,
        height: 1024,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    })

    // 详情模板必须保持空应用容器，避免边缘详情混入预渲染首页。
    const detailCss = await fs.readFile(path.join(ROOT_DIR, 'src/assets/styles/wallpaper-detail.css'), 'utf8')
    const detailShell = buildDetailShell(await fs.readFile(path.join(DIST_DIR, 'index.html'), 'utf8'), detailCss)
    await fs.writeFile(path.join(DIST_DIR, 'detail-shell.html'), detailShell)
    const missingPage = (await fs.readFile(path.join(DIST_DIR, 'index.html'), 'utf8'))
      .replace(/<meta name="robots"[^>]+>/, '<meta name="robots" content="noindex, follow">')
      .replace(/<link rel="canonical"[^>]+>/, '')
      .replace(/<meta\s+(?:property="og:[^"]+"|name="twitter:[^"]+")[\s\S]*?>/g, '')
      .replace(/<meta\s+name="description"[\s\S]*?>/, '<meta name="description" content="此地址不存在，请返回壁纸图库继续浏览。">')
      .replace(/<title>[^<]*<\/title>/, '<title>页面不存在 | Wallpaper Gallery</title>')
    await fs.writeFile(path.join(DIST_DIR, '404.html'), missingPage)
    for (const route of PRERENDER_ROUTES) {
      const page = await browser.newPage()
      await page.setRequestInterception(true)
      page.on('request', (request) => {
        const url = new URL(request.url())
        // 生成 HTML 不下载图床图片，成功占位响应保持真实 src，避免失败触发备用原图。
        if (request.resourceType() === 'image')
          void request.respond({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') })
        else if (url.origin !== baseUrl && !['data:', 'blob:'].includes(url.protocol))
          void request.abort()
        else
          void request.continue()
      })
      try {
        console.log(`Prerendering ${route}...`)
        await waitForSeo(page, route, baseUrl)
        await page.evaluate(() => document.documentElement.setAttribute('data-static-page', ''))
        const html = await page.content()
        await writeRouteHtml(route, html)
      }
      finally {
        await page.close()
      }
    }

    console.log('Prerender complete.')
  }
  finally {
    if (browser)
      await browser.close()

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error)
          reject(error)
        else
          resolve()
      })
    })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
