import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, Notification, shell } from 'electron'
import { downloadImageToTemp } from './utils/download.js'
import { setWallpaperMac, setWallpaperWindows } from './utils/wallpaper.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow = null
let isIpcInitialized = false // 防止重复注册 IPC 监听器

function createWindow() {
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1280,
    minHeight: 800,
    frame: isMac,
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 开发环境：加载开发服务器
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    mainWindow.webContents.openDevTools()
    mainWindow.webContents.session.clearCache()
  }
  else {
    // 生产环境：加载本地文件
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 监听页面加载完成，注入版本检查
  mainWindow.webContents.on('did-finish-load', () => {
    // 可以在这里注入版本检查逻辑
    console.log('页面加载完成')
  })

  // 禁用刷新快捷键（生产环境）
  if (!process.env.ELECTRON_RENDERER_URL) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // 禁用 Ctrl+R / Cmd+R (刷新)
      if ((input.control || input.meta) && input.key.toLowerCase() === 'r') {
        event.preventDefault()
      }
      // 禁用 F5 (刷新)
      if (input.key === 'F5') {
        event.preventDefault()
      }
      // 禁用 Ctrl+Shift+R / Cmd+Shift+R (强制刷新)
      if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'r') {
        event.preventDefault()
      }
      // 禁用 Ctrl+Shift+I / Cmd+Option+I (开发者工具)
      if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
        event.preventDefault()
      }
      // 禁用 F12 (开发者工具)
      if (input.key === 'F12') {
        event.preventDefault()
      }
    })
  }

  // 拦截所有新窗口打开请求，用系统默认浏览器打开外链
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 如果是外部链接（http/https），用系统浏览器打开
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
      return { action: 'deny' } // 阻止在 Electron 中打开新窗口
    }
    return { action: 'allow' }
  })

  // 拦截导航事件，防止在当前窗口打开外链
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // const currentUrl = mainWindow.webContents.getURL()

    // 如果是外部链接，阻止导航并用系统浏览器打开
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // 允许应用内部导航（同域名）
      if (process.env.ELECTRON_RENDERER_URL && url.startsWith(process.env.ELECTRON_RENDERER_URL)) {
        return // 允许应用内导航
      }

      // 阻止外部链接导航
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  // 监听新窗口创建事件（额外保护）
  mainWindow.webContents.on('did-create-window', (newWindow) => {
    // 如果还是创建了新窗口，也给它添加拦截
    newWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url)
        return { action: 'deny' }
      }
      return { action: 'allow' }
    })
  })
}

// 初始化 IPC 监听器（只执行一次）
function initializeIPC() {
  if (isIpcInitialized)
    return
  isIpcInitialized = true

  // 读取本地 JSON 文件
  ipcMain.handle('read-local-file', async (_event, filePath) => {
    try {
      // 去除查询参数（如 ?v=xxx）
      const cleanPath = filePath.split('?')[0]
      const fullPath = path.join(__dirname, '../renderer', cleanPath)

      console.log('读取文件:', fullPath)
      const data = await fs.promises.readFile(fullPath, 'utf-8')
      return { success: true, data }
    }
    catch (error) {
      console.error('读取文件失败:', filePath, error)
      return { success: false, message: `${error.code}, ${filePath} not found in ${__dirname}` }
    }
  })

  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    }
    else {
      mainWindow?.maximize()
    }
  })

  ipcMain.on('window-close', () => {
    mainWindow?.close()
  })

  // 打开壁纸文件夹
  ipcMain.handle('open-wallpaper-folder', async () => {
    try {
      const wallpaperDir = path.join(app.getPath('userData'), 'wallpapers')

      // 如果文件夹不存在，先创建
      if (!fs.existsSync(wallpaperDir)) {
        fs.mkdirSync(wallpaperDir, { recursive: true })
      }

      // 用系统文件管理器打开文件夹
      await shell.openPath(wallpaperDir)

      return { success: true, path: wallpaperDir }
    }
    catch (error) {
      console.error('打开文件夹失败:', error)
      return { success: false, message: error.message }
    }
  })

  // 下载图片
  ipcMain.handle('download-image', async (_event, url, suggestedFilename) => {
    try {
      // 弹出保存对话框
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '保存壁纸',
        defaultPath: path.join(app.getPath('downloads'), suggestedFilename || 'wallpaper.jpg'),
        filters: [
          { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      })

      if (canceled || !filePath) {
        return { success: false, message: '用户取消下载' }
      }

      // 下载文件到临时目录，然后复制到目标位置
      const tempPath = await downloadImageToTemp(url)
      await fs.promises.copyFile(tempPath, filePath)
      await fs.promises.unlink(tempPath) // 删除临时文件

      // 显示系统通知
      if (Notification.isSupported()) {
        new Notification({
          title: '下载成功',
          body: `壁纸已保存到：${filePath}`,
        }).show()
      }

      return { success: true, filePath }
    }
    catch (error) {
      console.error('下载失败:', error)
      return { success: false, message: error.message }
    }
  })

  // 设置为壁纸
  // ipcMain.handle('set-wallpaper', async (event, url) => {
  //   try {
  //     // 从 URL 中提取文件名
  //     const urlObj = new URL(url)
  //     const filename = path.basename(urlObj.pathname) || `wallpaper-${Date.now()}.jpg`

  //     // 创建应用专属的壁纸目录（在用户数据目录下）
  //     const wallpaperDir = path.join(app.getPath('userData'), 'wallpapers')
  //     if (!fs.existsSync(wallpaperDir)) {
  //       fs.mkdirSync(wallpaperDir, { recursive: true })
  //     }

  //     // 下载到壁纸目录
  //     const wallpaperPath = path.join(wallpaperDir, filename)

  //     // 如果文件已存在，直接使用（避免重复下载）
  //     if (!fs.existsSync(wallpaperPath)) {
  //       await downloadFile(url, wallpaperPath)
  //     }

  //     // 设置为壁纸
  //     await setSystemWallpaper(wallpaperPath)

  //     // 清理旧壁纸（保留最近 10 个）
  //     cleanupOldWallpapers(wallpaperDir, 10)

  //     // 显示系统通知
  //     if (Notification.isSupported()) {
  //       new Notification({
  //         title: '设置成功',
  //         body: '壁纸已设置为桌面背景',
  //       }).show()
  //     }

  //     return { success: true, filePath: wallpaperPath }
  //   }
  //   catch (error) {
  //     console.error('设置壁纸失败:', error)
  //     return { success: false, message: error.message }
  //   }
  // })
  // 设置为壁纸（使用原生方案）
  ipcMain.handle('set-wallpaper', async (_event, url) => {
    try {
      console.log('[Wallpaper] 收到设置请求:', url)

      // 1. 下载图片到临时目录
      const tempFilePath = await downloadImageToTemp(url)
      console.log('[Wallpaper] 图片已下载:', tempFilePath)

      // 2. 根据平台设置壁纸
      if (process.platform === 'darwin') {
        await setWallpaperMac(tempFilePath)
      }
      else if (process.platform === 'win32') {
        await setWallpaperWindows(tempFilePath)
      }
      else {
        throw new Error(`暂不支持 ${process.platform} 平台`)
      }

      // 3. 发送系统通知
      if (Notification.isSupported()) {
        new Notification({
          title: '设置成功',
          body: '壁纸已更新 ✨',
          silent: true,
        }).show()
      }

      return { success: true, filePath: tempFilePath }
    }
    catch (error) {
      console.error('[Wallpaper] 设置失败:', error)
      return {
        success: false,
        message: error.message || '未知错误',
      }
    }
  })

  // 更新壁纸数据
  ipcMain.handle('update-wallpaper-data', async () => {
    try {
      console.log('[DataUpdate] 开始更新壁纸数据...')

      // 1. 从 Web 的 version.json 获取图床版本号（这是图床的 tag 版本）
      const versionInfo = await new Promise((resolve, reject) => {
        https.get('https://wallpaper.061129.xyz/version.json', (res) => {
          let data = ''
          res.on('data', chunk => data += chunk)
          res.on('end', () => {
            try {
              const json = JSON.parse(data)
              resolve(json)
            }
            catch (error) {
              reject(error)
            }
          })
        }).on('error', reject)
      })

      // 2. 使用 Web 版本号作为 CDN 版本参数（Web 定时部署会自动更新）
      const cdnVersion = `v${versionInfo.version}`
      console.log(`[DataUpdate] 使用版本号: ${cdnVersion}`)

      // 3. 直接从线上域名下载最新数据
      const baseUrl = 'https://wallpaper.061129.xyz/data'

      // 获取应用资源目录
      const resourcesPath = process.resourcesPath || path.join(__dirname, '../renderer')
      const dataDir = path.join(resourcesPath, 'data')

      // 4. 下载主要的汇总文件
      const mainFiles = [
        'desktop.json',
        'mobile.json',
        'avatar.json',
      ]

      console.log('[DataUpdate] 下载主文件...')
      for (const file of mainFiles) {
        const url = `${baseUrl}/${file}?v=${cdnVersion}`
        const destPath = path.join(dataDir, file)
        await downloadDataFile(url, destPath)
      }

      // 5. 下载各个系列的分类文件
      const series = ['desktop', 'mobile', 'avatar']

      for (const seriesName of series) {
        console.log(`[DataUpdate] 下载 ${seriesName} 分类...`)

        // 读取汇总文件获取分类列表
        const summaryPath = path.join(dataDir, `${seriesName}.json`)
        if (fs.existsSync(summaryPath)) {
          const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))
          const categories = summary.categories || []

          // 确保分类目录存在
          const seriesDir = path.join(dataDir, seriesName)
          if (!fs.existsSync(seriesDir)) {
            fs.mkdirSync(seriesDir, { recursive: true })
          }

          // 下载 index.json
          await downloadDataFile(
            `${baseUrl}/${seriesName}/index.json?v=${cdnVersion}`,
            path.join(seriesDir, 'index.json'),
          )

          // 下载各个分类文件
          for (const category of categories) {
            const categoryFile = `${category.name}.json`
            await downloadDataFile(
              `${baseUrl}/${seriesName}/${encodeURIComponent(categoryFile)}?v=${cdnVersion}`,
              path.join(seriesDir, categoryFile),
            )
          }
        }
      }

      // 6. 下载 Bing 数据
      console.log('[DataUpdate] 下载 Bing 数据...')
      const bingDir = path.join(dataDir, 'bing')
      if (!fs.existsSync(bingDir)) {
        fs.mkdirSync(bingDir, { recursive: true })
      }

      await downloadDataFile(
        `${baseUrl}/bing/index.json?v=${cdnVersion}`,
        path.join(bingDir, 'index.json'),
      )

      // 下载当前年份的 Bing 数据
      const currentYear = new Date().getFullYear()
      await downloadDataFile(
        `${baseUrl}/bing/${currentYear}.json?v=${cdnVersion}`,
        path.join(bingDir, `${currentYear}.json`),
      )

      // 7. 下载热门数据（stats）
      console.log('[DataUpdate] 下载热门数据...')
      const statsDir = path.join(dataDir, 'stats')
      if (!fs.existsSync(statsDir)) {
        fs.mkdirSync(statsDir, { recursive: true })
      }

      // 尝试下载 stats 文件（可能不存在）
      try {
        await downloadDataFile(
          `${baseUrl}/stats/hot.json?v=${cdnVersion}`,
          path.join(statsDir, 'hot.json'),
        )
      }
      catch {
        console.log('[DataUpdate] stats 文件不存在，跳过')
      }

      console.log('[DataUpdate] 壁纸数据更新成功')

      // 显示通知
      if (Notification.isSupported()) {
        new Notification({
          title: '更新成功',
          body: `壁纸数据已更新到 ${cdnVersion}，请重启应用查看最新内容`,
        }).show()
      }

      return {
        success: true,
        message: '数据更新成功，请重启应用',
        version: cdnVersion,
      }
    }
    catch (error) {
      console.error('[DataUpdate] 更新失败:', error)
      return { success: false, message: error.message }
    }
  })

  // 打开外部链接
  ipcMain.handle('open-external', async (_event, url) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    }
    catch (error) {
      return { success: false, message: error.message }
    }
  })
}

// 下载数据文件（支持多个 CDN 备用）
// 下载数据文件
function downloadDataFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location
        console.log(`[DataUpdate] 重定向到: ${redirectUrl}`)
        return https.get(redirectUrl, handleResponse).on('error', reject)
      }

      handleResponse(response)

      function handleResponse(res) {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`))
          return
        }

        const dir = path.dirname(destPath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }

        const fileStream = fs.createWriteStream(destPath)
        res.pipe(fileStream)

        fileStream.on('finish', () => {
          fileStream.close()
          console.log(`[DataUpdate] 已下载: ${path.basename(destPath)}`)
          resolve()
        })

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {})
          reject(err)
        })
      }
    }).on('error', reject)
  })
}

app.whenReady().then(() => {
  // 初始化 IPC 监听器
  initializeIPC()

  createWindow()

  // 全局拦截所有新窗口创建
  app.on('web-contents-created', (_event, contents) => {
    // 拦截所有 webContents 的新窗口打开
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url)
        return { action: 'deny' }
      }
      return { action: 'deny' } // 默认阻止所有新窗口
    })

    // 拦截导航
    contents.on('will-navigate', (event, url) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        // const currentUrl = contents.getURL()
        // 如果是外部链接（不是应用自己的域名）
        if (process.env.ELECTRON_RENDERER_URL && !url.startsWith(process.env.ELECTRON_RENDERER_URL)) {
          event.preventDefault()
          shell.openExternal(url)
        }
        else if (!process.env.ELECTRON_RENDERER_URL && !url.startsWith('file://')) {
          event.preventDefault()
          shell.openExternal(url)
        }
      }
    })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
