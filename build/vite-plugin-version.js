import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * 版本文件更新插件
 * 在构建时自动更新 public/version.json
 */

/**
 * 获取北京时间字符串
 */
function getBeijingTime() {
  const now = new Date()
  // UTC+8
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return beijingTime.toISOString().replace('Z', '+08:00')
}

/**
 * 版本插件
 * @param {object} options 配置选项
 * @param {string} options.version - 应用版本号
 * @param {string} options.buildTime - 构建时间
 * @param {string} options.outputPath - 输出文件路径（相对于项目根目录）
 * @returns {import('vite').Plugin}
 */
export function versionPlugin(options = {}) {
  const {
    version = '1.0.0',
    buildTime = getBeijingTime(),
    outputPath = 'public/version.json',
  } = options

  const isProduction = process.env.NODE_ENV === 'production'

  return {
    name: 'vite-plugin-version',
    buildStart() {
      if (isProduction) {
        // 获取项目根目录
        const rootDir = process.cwd()
        const versionFile = path.resolve(rootDir, outputPath)

        // 确保目录存在
        const dir = path.dirname(versionFile)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }

        // 写入版本信息
        const versionData = {
          version,
          buildTime,
        }
        fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2))

        console.log(`[version-plugin] Updated ${outputPath} to v${version}`)
      }
    },
  }
}

export default versionPlugin
