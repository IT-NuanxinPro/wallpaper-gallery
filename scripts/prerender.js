/**
 * 预渲染脚本
 * 使用 Puppeteer 为指定路由生成静态 HTML
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '../dist')

// 需要预渲染的路由
const routes = ['/', '/desktop', '/mobile', '/avatar', '/about']

// 本地服务器端口
const PORT = 4173

function startServer() {
  return new Promise((resolve) => {
    const server = spawn('npx', ['vite', 'preview', '--port', PORT], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    server.stdout.on('data', (data) => {
      if (data.toString().includes('Local:')) {
        resolve(server)
      }
    })

    // 超时后也 resolve
    setTimeout(() => resolve(server), 5000)
  })
}

async function prerender() {
  console.log('🚀 Starting prerender...\n')

  // 启动预览服务器
  console.log('📦 Starting preview server...')
  const server = await startServer()
  console.log(`   Server running on http://localhost:${PORT}\n`)

  // 启动浏览器
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()

  for (const route of routes) {
    const url = `http://localhost:${PORT}${route}`
    console.log(`📄 Rendering: ${route}`)

    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })

      // 等待 render-event 事件或超时
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (document.querySelector('#app')?.innerHTML) {
            resolve()
          }
          else {
            document.addEventListener('render-event', resolve, { once: true })
            setTimeout(resolve, 5000)
          }
        })
      })

      // 获取渲染后的 HTML
      const html = await page.content()

      // 确定输出路径
      const outputPath = route === '/'
        ? path.join(distDir, 'index.html')
        : path.join(distDir, route, 'index.html')

      // 创建目录
      const outputDir = path.dirname(outputPath)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      // 写入文件
      fs.writeFileSync(outputPath, html)
      console.log(`   ✅ Saved: ${outputPath.replace(distDir, 'dist')}`)
    }
    catch (error) {
      console.error(`   ❌ Failed: ${route}`, error.message)
    }
  }

  await browser.close()
  server.kill()
  console.log('\n✨ Prerender complete!')
}

prerender()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
