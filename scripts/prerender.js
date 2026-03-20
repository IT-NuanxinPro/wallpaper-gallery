import { createReadStream, existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const DIST_DIR = path.resolve(ROOT_DIR, 'dist')
const HOST = '127.0.0.1'
const PORT = Number(process.env.PRERENDER_PORT || 0)
const PRERENDER_ROUTES = [
  '/desktop',
  '/mobile',
  '/avatar',
  '/bing',
  '/about',
]
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

  if (existsSync(absolutePath) && !absolutePath.endsWith(path.sep)) {
    return absolutePath
  }

  const htmlPath = path.join(DIST_DIR, normalizedPath, 'index.html')
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

  await page.waitForFunction(() => {
    const title = document.title || ''
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || ''
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
    return Boolean(title.trim()) && Boolean(canonical.trim()) && Boolean(description.trim())
  }, { timeout: 15000 })

  await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 15000 })
  await new Promise(resolve => setTimeout(resolve, 500))
}

async function writeRouteHtml(route, html) {
  const targetDir = path.join(DIST_DIR, route.replace(/^\//, ''))
  await fs.mkdir(targetDir, { recursive: true })
  await fs.writeFile(path.join(targetDir, 'index.html'), html, 'utf8')
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

    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')

    for (const route of PRERENDER_ROUTES) {
      console.log(`Prerendering ${route}...`)
      await waitForSeo(page, route, baseUrl)
      const html = await page.content()
      await writeRouteHtml(route, html)
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
