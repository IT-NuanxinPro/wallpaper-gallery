import { spawn } from 'node:child_process'
import path from 'node:path'

/**
 * 设置 macOS 壁纸
 * @param {string} imagePath - 图片的绝对路径
 * @returns {Promise<void>}
 */
export function setWallpaperMac(imagePath) {
  return new Promise((resolve, reject) => {
    // 修正点：
    // 1. 不再使用 set desktop picture (新版 macOS 不支持)
    // 2. 改为遍历 every desktop (每个显示器)
    // 3. 将路径作为字符串传递给 picture 属性
    const script = `
      on run argv
        tell application "System Events"
          -- 获取所有显示器的桌面对象
          set allDesktops to every desktop
          
          -- 遍历每个桌面设置壁纸
          repeat with aDesktop in allDesktops
            try
              -- 尝试直接设置路径字符串
              set picture of aDesktop to (item 1 of argv)
            on error
              -- 如果失败，尝试作为文件对象设置 (兼容旧版系统)
              set picture of aDesktop to (POSIX file (item 1 of argv))
            end try
          end repeat
        end tell
      end run
    `

    const child = spawn('osascript', ['-e', script, imagePath])

    let errorOutput = ''
    child.stderr.on('data', data => (errorOutput += data.toString()))

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      }
      else {
        // 错误信息处理：去除换行符，方便阅读
        const cleanError = errorOutput.replace(/\n/g, ' ').trim()
        reject(new Error(`macOS 设置脚本失败 (Code ${code}): ${cleanError}`))
      }
    })

    child.on('error', err => reject(err))
  })
}

/**
 * 设置 Windows 壁纸
 * @param {string} imagePath - 图片的绝对路径
 * @returns {Promise<void>}
 */
export function setWallpaperWindows(imagePath) {
  return new Promise((resolve, reject) => {
    // 1. 规范化路径
    const safePath = path.normalize(imagePath)

    // 2. PowerShell 脚本 (注意缩进要求：'@ 必须在行首)
    const script = `
$code = @'
using System.Runtime.InteropServices;
public class Wallpaper {
  [DllImport("user32.dll", CharSet=CharSet.Auto)]
  public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
'@
Add-Type -TypeDefinition $code
[Wallpaper]::SystemParametersInfo(20, 0, "${safePath}", 3)
`

    // 3. 执行
    const child = spawn('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script,
    ])

    let errorOutput = ''
    child.stderr.on('data', data => (errorOutput += data.toString()))

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      }
      else {
        reject(new Error(`Windows 设置壁纸失败 (Exit Code ${code}): ${errorOutput}`))
      }
    })

    child.on('error', err => reject(err))
  })
}
