/**
 * Vercel 构建脚本
 * 用于测试环境部署，包含 CDN 同步和数据生成
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

// 配置
const CONFIG = {
  GITHUB_OWNER: 'IT-NuanxinPro',
  GITHUB_REPO: 'nuanXinProPic',
  CONSTANTS_FILE: path.join(ROOT_DIR, 'src/utils/constants.js'),
  REPO_DIR: path.join(ROOT_DIR, 'nuanXinProPic'),
  DEFAULT_CDN_VERSION: 'v1.1.1',
  MAX_RETRIES: 3,
  RETRY_DELAYS: [1000, 2000, 4000], // 指数退避延迟（毫秒）
}

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 带重试的 fetch 请求
 */
async function fetchWithRetry(url, options = {}, retries = CONFIG.MAX_RETRIES) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Wallpaper-Gallery-Vercel-Build',
          ...options.headers,
        },
      })

      if (response.ok) {
        return response
      }

      // 如果是 rate limit，等待更长时间
      if (response.status === 403 || response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        const waitTime = retryAfter ? Number.parseInt(retryAfter) * 1000 : CONFIG.RETRY_DELAYS[attempt]
        console.log(`  ⚠️ Rate limited, waiting ${waitTime / 1000}s before retry...`)
        await delay(waitTime)
        continue
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    catch (error) {
      if (attempt < retries - 1) {
        const waitTime = CONFIG.RETRY_DELAYS[attempt]
        console.log(`  ⚠️ Attempt ${attempt + 1} failed: ${error.message}`)
        console.log(`  Retrying in ${waitTime / 1000}s...`)
        await delay(waitTime)
      }
      else {
        throw error
      }
    }
  }
}

/**
 * 获取最新的 CDN 版本（从 GitHub API）
 */
async function fetchLatestCDNVersion() {
  console.log('📦 Fetching latest CDN version...')

  try {
    const response = await fetchWithRetry(
      `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/tags`,
    )

    const tags = await response.json()

    if (tags && tags.length > 0) {
      const latestTag = tags[0].name
      console.log(`  ✅ Latest CDN version: ${latestTag}`)
      return latestTag
    }

    console.log(`  ⚠️ No tags found, using default: ${CONFIG.DEFAULT_CDN_VERSION}`)
    return CONFIG.DEFAULT_CDN_VERSION
  }
  catch (error) {
    console.log(`  ❌ Failed to fetch CDN version: ${error.message}`)
    console.log(`  Using fallback: ${CONFIG.DEFAULT_CDN_VERSION}`)
    return CONFIG.DEFAULT_CDN_VERSION
  }
}

/**
 * 更新 constants.js 中的 CDN 版本
 */
function updateCDNVersion(version) {
  console.log(`📝 Updating CDN_VERSION to: ${version}`)

  try {
    let content = fs.readFileSync(CONFIG.CONSTANTS_FILE, 'utf-8')
    const originalContent = content

    // 替换 CDN_VERSION
    content = content.replace(
      /export const CDN_VERSION = '[^']*'/,
      `export const CDN_VERSION = '${version}'`,
    )

    if (content === originalContent) {
      console.log('  ⚠️ CDN_VERSION pattern not found, no changes made')
      return false
    }

    fs.writeFileSync(CONFIG.CONSTANTS_FILE, content)
    console.log('  ✅ CDN_VERSION updated successfully')
    return true
  }
  catch (error) {
    console.log(`  ❌ Failed to update CDN_VERSION: ${error.message}`)
    return false
  }
}

/**
 * 克隆图床仓库
 */
function cloneImageRepo(version) {
  console.log(`📥 Cloning image repository (${version})...`)

  try {
    // 删除旧目录
    if (fs.existsSync(CONFIG.REPO_DIR)) {
      console.log('  Removing old repository...')
      fs.rmSync(CONFIG.REPO_DIR, { recursive: true, force: true })
    }

    // 克隆指定版本
    const cloneCmd = `git clone --depth 1 --branch ${version} https://github.com/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}.git nuanXinProPic`
    console.log(`  Running: ${cloneCmd}`)

    execSync(cloneCmd, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    })

    console.log('  ✅ Repository cloned successfully')
    return true
  }
  catch (error) {
    console.log(`  ❌ Failed to clone repository: ${error.message}`)
    return false
  }
}

/**
 * 恢复图片文件时间戳
 */
function restoreFileTimestamps() {
  console.log('📅 Restoring file timestamps...')

  try {
    const backupAllFile = path.join(CONFIG.REPO_DIR, 'timestamps-backup-all.txt')
    const backupFile = path.join(CONFIG.REPO_DIR, 'timestamps-backup.txt')
    const restoreScript = path.join(CONFIG.REPO_DIR, 'scripts/restore-timestamps.sh')

    // 检查恢复脚本是否存在
    if (!fs.existsSync(restoreScript)) {
      console.log('  ⚠️ restore-timestamps.sh not found, skipping timestamp restoration')
      return false
    }

    // 优先使用完整备份文件
    if (fs.existsSync(backupAllFile)) {
      console.log('  Found timestamps-backup-all.txt, restoring all file timestamps...')
      execSync(`chmod +x scripts/restore-timestamps.sh && BACKUP_FILE=timestamps-backup-all.txt ./scripts/restore-timestamps.sh`, {
        cwd: CONFIG.REPO_DIR,
        stdio: 'inherit',
      })
      console.log('  ✅ All file timestamps restored from backup')
      return true
    }
    else if (fs.existsSync(backupFile)) {
      console.log('  Found timestamps-backup.txt, restoring desktop file timestamps...')
      execSync(`chmod +x scripts/restore-timestamps.sh && ./scripts/restore-timestamps.sh`, {
        cwd: CONFIG.REPO_DIR,
        stdio: 'inherit',
      })
      console.log('  ✅ Desktop file timestamps restored from backup')
      return true
    }
    else {
      console.log('  ⚠️ No timestamps backup file found, skipping timestamp restoration')
      return false
    }
  }
  catch (error) {
    console.log(`  ❌ Failed to restore timestamps: ${error.message}`)
    return false
  }
}

/**
 * 生成壁纸数据
 */
function generateWallpaperData() {
  console.log('🖼️ Generating wallpaper data...')

  try {
    execSync('node scripts/generate-data.js', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    })

    console.log('  ✅ Wallpaper data generated successfully')
    return true
  }
  catch (error) {
    console.log(`  ❌ Failed to generate wallpaper data: ${error.message}`)
    return false
  }
}

/**
 * 构建应用
 */
function buildApplication() {
  console.log('🔨 Building application...')

  try {
    execSync('pnpm build --mode staging', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    })

    console.log('  ✅ Application built successfully')
    return true
  }
  catch (error) {
    console.log(`  ❌ Build failed: ${error.message}`)
    return false
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(50))
  console.log('Vercel Build Script')
  console.log('='.repeat(50))
  console.log('')

  const startTime = Date.now()

  try {
    // 1. 获取最新 CDN 版本
    const cdnVersion = await fetchLatestCDNVersion()
    console.log('')

    // 2. 更新 CDN 版本
    updateCDNVersion(cdnVersion)
    console.log('')

    // 3. 克隆图床仓库
    const cloneSuccess = cloneImageRepo(cdnVersion)
    if (!cloneSuccess) {
      console.log('⚠️ Repository clone failed, continuing with existing data...')
    }
    console.log('')

    // 4. 恢复文件时间戳（重要：确保图片排序正确）
    if (cloneSuccess) {
      restoreFileTimestamps()
      console.log('')
    }

    // 5. 生成壁纸数据
    const generateSuccess = generateWallpaperData()
    if (!generateSuccess) {
      throw new Error('Failed to generate wallpaper data')
    }
    console.log('')

    // 6. 构建应用
    const buildSuccess = buildApplication()
    if (!buildSuccess) {
      throw new Error('Build failed')
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log('')
    console.log('='.repeat(50))
    console.log(`✅ Build completed successfully in ${duration}s`)
    console.log('='.repeat(50))
  }
  catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log('')
    console.log('='.repeat(50))
    console.log(`❌ Build failed after ${duration}s`)
    console.log(`Error: ${error.message}`)
    console.log('='.repeat(50))
    process.exit(1)
  }
}

main()
