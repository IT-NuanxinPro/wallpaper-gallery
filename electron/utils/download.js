import fs from 'node:fs'
import path from 'node:path'
import { app, net } from 'electron'

/**
 * 下载图片到临时目录
 * @param {string} url - 图片 URL
 * @returns {Promise<string>} - 下载后的文件绝对路径
 */
export function downloadImageToTemp(url) {
  return new Promise((resolve, reject) => {
    try {
      // 1. 生成安全的文件名 (避免文件名过长或包含非法字符)
      const urlObj = new URL(url)
      const ext = path.extname(urlObj.pathname) || '.jpg'
      const timestamp = Date.now()
      const filename = `wallpaper-${timestamp}${ext}`

      // 2. 确定临时文件路径
      const tempDir = app.getPath('temp')
      const destPath = path.join(tempDir, filename)

      console.log(`[Download] 开始下载: ${url} -> ${destPath}`)

      // 3. 创建写入流
      const fileStream = fs.createWriteStream(destPath)

      // 4. 使用 Electron net 模块发起请求
      const request = net.request(url)

      request.on('response', (response) => {
        // 检查状态码
        if (response.statusCode !== 200) {
          fs.unlink(destPath, () => {})
          reject(new Error(`下载失败: HTTP ${response.statusCode}`))
          return
        }

        // 将网络流管道传输到文件流
        response.pipe(fileStream)

        // 监听响应错误
        response.on('error', (error) => {
          fs.unlink(destPath, () => {})
          reject(error)
        })
      })

      // 监听文件写入完成
      fileStream.on('finish', () => {
        fileStream.close()
        resolve(destPath)
      })

      // 监听文件写入错误
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {})
        reject(new Error(`文件写入失败: ${err.message}`))
      })

      // 监听请求本身错误
      request.on('error', (error) => {
        fs.unlink(destPath, () => {})
        reject(new Error(`网络请求错误: ${error.message}`))
      })

      // 发送请求
      request.end()
    }
    catch (error) {
      reject(error)
    }
  })
}
