import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function pad(value) {
  return String(value).padStart(2, '0')
}

export function formatBuildTime(date = new Date()) {
  const utcTime = date instanceof Date ? date : new Date()
  const beijingTime = new Date(utcTime.getTime() + 8 * 60 * 60 * 1000)
  const year = beijingTime.getUTCFullYear()
  const month = pad(beijingTime.getUTCMonth() + 1)
  const day = pad(beijingTime.getUTCDate())
  const hours = pad(beijingTime.getUTCHours())
  const minutes = pad(beijingTime.getUTCMinutes())
  const seconds = pad(beijingTime.getUTCSeconds())

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

export function versionPlugin(options = {}) {
  const {
    version = '1.0.0',
    buildTime = formatBuildTime(),
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
