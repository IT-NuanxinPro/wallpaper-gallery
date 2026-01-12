/**
 * 壁纸数据生成脚本
 * 在构建前运行，为三个系列（desktop, mobile, avatar）分别生成 JSON 文件
 * 支持分类文件夹结构：wallpaper/desktop/动漫/xxx.jpg
 */

import { Buffer } from 'node:buffer'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { CHAR_MAP_ENCODE, VERSION_PREFIX } from '../src/utils/codec-config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 命令行参数：--github 强制使用 GitHub API（用于调试）
const FORCE_GITHUB = process.argv.includes('--github')

/**
 * 自定义编码（Base64 + 字符映射 + 反转）
 * @param {string} str - 原始字符串
 * @returns {string} 编码后的字符串
 */
function encodeData(str) {
  const base64 = Buffer.from(str, 'utf-8').toString('base64')
  const mapped = base64.split('').map(c => CHAR_MAP_ENCODE[c] || c).join('')
  return VERSION_PREFIX + mapped.split('').reverse().join('')
}

// cdnTag 缓存（从 timestamps-backup-all.txt 加载）
let cdnTagCache = null

/**
 * 加载 cdnTag 缓存
 * 从 timestamps-backup-all.txt 读取每张图片的 cdnTag
 * 格式: series|relative_path|timestamp|cdnTag
 */
function loadCdnTagCache(repoPath) {
  if (cdnTagCache !== null) {
    return cdnTagCache
  }

  cdnTagCache = new Map()
  const backupFile = path.join(repoPath, 'timestamps-backup-all.txt')

  if (!fs.existsSync(backupFile)) {
    console.log('  ⚠️ timestamps-backup-all.txt not found, cdnTag will use default')
    return cdnTagCache
  }

  try {
    const content = fs.readFileSync(backupFile, 'utf-8')
    const lines = content.trim().split('\n')

    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length >= 4) {
        const [series, relativePath, , cdnTag] = parts
        // key 格式: series/relativePath
        const key = `${series}/${relativePath}`
        cdnTagCache.set(key, cdnTag)
      }
    }

    console.log(`  ✅ Loaded ${cdnTagCache.size} cdnTag entries from backup`)
  }
  catch (e) {
    console.warn(`  ⚠️ Failed to load cdnTag cache: ${e.message}`)
  }

  return cdnTagCache
}

/**
 * 获取图片的 cdnTag
 * @param {string} seriesId - 系列ID (desktop/mobile/avatar)
 * @param {string} relativePath - 相对路径
 * @param {string} repoPath - 仓库路径
 * @returns {string|undefined} cdnTag 或 undefined
 */
function getCdnTag(seriesId, relativePath, repoPath) {
  const cache = loadCdnTagCache(repoPath)
  const key = `${seriesId}/${relativePath}`
  return cache.get(key)
}

// 配置
const CONFIG = {
  // GitHub 图床仓库信息
  GITHUB_OWNER: 'IT-NuanxinPro',
  GITHUB_REPO: 'nuanXinProPic',
  GITHUB_BRANCH: 'main',

  // 本地图床仓库路径（优先级从高到低）
  // 1. 环境变量 LOCAL_REPO_PATH（推荐，在 .env.local 中配置）
  // 2. CI 环境：项目根目录下的 nuanXinProPic
  // 3. 本地开发：同级目录的 nuanXinProPic
  LOCAL_REPO_PATHS: [
    process.env.LOCAL_REPO_PATH, // 优先使用环境变量
    path.resolve(__dirname, '../nuanXinProPic'), // CI 环境
    path.resolve(__dirname, '../../nuanXinProPic'), // 本地开发（同级目录）
  ].filter(Boolean), // 过滤掉 undefined

  // 线上数据源（开源用户使用）
  // 当本地图床仓库不存在时，直接从线上拉取已生成的 JSON 数据
  ONLINE_DATA_BASE_URL: 'https://wallpaper.061129.xyz/data',

  // 支持的图片格式
  IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],

  // 输出路径
  OUTPUT_DIR: path.resolve(__dirname, '../public/data'),

  // 是否启用分类拆分（按分类生成独立 JSON）
  ENABLE_CATEGORY_SPLIT: true,

  // 三大系列配置
  SERIES: {
    desktop: {
      id: 'desktop',
      name: '电脑壁纸',
      wallpaperDir: 'wallpaper/desktop',
      thumbnailDir: 'thumbnail/desktop',
      previewDir: 'preview/desktop',
      outputFile: 'desktop.json',
      hasPreview: true,
    },
    mobile: {
      id: 'mobile',
      name: '手机壁纸',
      wallpaperDir: 'wallpaper/mobile',
      thumbnailDir: 'thumbnail/mobile',
      previewDir: 'preview/mobile',
      outputFile: 'mobile.json',
      hasPreview: true,
    },
    avatar: {
      id: 'avatar',
      name: '头像',
      wallpaperDir: 'wallpaper/avatar',
      thumbnailDir: 'thumbnail/avatar',
      outputFile: 'avatar.json',
      hasPreview: false,
    },
    bing: {
      id: 'bing',
      name: '每日Bing',
      metadataDir: 'bing/meta',
      outputFile: 'bing',
      isBing: true,
    },
  },
}

/**
 * 递归扫描目录获取所有图片文件
 * 支持二级分类文件夹结构：wallpaper/desktop/游戏/原神/xxx.jpg
 * @param {string} dir - 目录路径
 * @param {string} baseDir - 基础目录（用于计算相对路径）
 * @returns {Array<{name: string, size: number, category: string, subcategory: string|null, relativePath: string}>}
 */
function scanDirectoryRecursive(dir, baseDir = dir) {
  const files = []

  if (!fs.existsSync(dir)) {
    return files
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      // 递归扫描子目录
      files.push(...scanDirectoryRecursive(fullPath, baseDir))
    }
    else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (CONFIG.IMAGE_EXTENSIONS.includes(ext)) {
        const stats = fs.statSync(fullPath)
        const relativePath = path.relative(baseDir, fullPath)
        // 从相对路径提取分类（支持二级分类结构）
        // 路径格式: L1/L2/filename.jpg 或 L1/filename.jpg 或 filename.jpg
        const pathParts = relativePath.split(path.sep)

        let category = '未分类'
        let subcategory = null

        if (pathParts.length >= 3) {
          // 二级分类结构: L1/L2/filename.jpg
          category = pathParts[0]
          const l2 = pathParts[1]
          // "通用" 表示没有二级分类，设为 null
          subcategory = l2 === '通用' ? null : l2
        }
        else if (pathParts.length === 2) {
          // 一级分类结构: L1/filename.jpg（兼容旧结构）
          category = pathParts[0]
          subcategory = null
        }
        else {
          // 根目录文件，从文件名提取分类
          category = extractCategoryFromFilename(entry.name)
          subcategory = null
        }

        files.push({
          name: entry.name,
          size: stats.size,
          sha: '',
          type: 'file',
          category,
          subcategory,
          relativePath, // 相对于 wallpaperDir 的路径
          fullPath,
        })
      }
    }
  }

  return files
}

/**
 * 从文件名中提取分类（兼容旧的文件名格式）
 * 文件名格式: {分类}--{原文件名}.{ext}
 * 例如: 游戏--原神_雷电将军.png -> 游戏
 */
function extractCategoryFromFilename(filename) {
  const filenameNoExt = path.basename(filename, path.extname(filename))

  // 检查是否包含分类前缀（使用 -- 分隔）
  if (filenameNoExt.includes('--')) {
    const parts = filenameNoExt.split('--')
    if (parts.length >= 2 && parts[0].trim()) {
      return parts[0].trim()
    }
  }

  // 没有分类前缀，返回 '未分类'
  return '未分类'
}

/**
 * 从线上拉取已生成的 JSON 数据（开源用户使用）
 * @param {string} seriesId - 系列ID
 * @returns {Promise<{indexData: object, categoryData: object}>}
 */
async function fetchDataFromOnline(seriesId) {
  console.log(`  Fetching from online: ${CONFIG.ONLINE_DATA_BASE_URL}/${seriesId}/`)

  try {
    // 1. 拉取分类索引
    const indexUrl = `${CONFIG.ONLINE_DATA_BASE_URL}/${seriesId}/index.json`
    const indexResponse = await fetch(indexUrl)
    if (!indexResponse.ok) {
      throw new Error(`Failed to fetch index: ${indexResponse.status}`)
    }
    const indexData = await indexResponse.json()

    // 2. 解析分类列表（需要解密 blob）
    let categories = []
    if (indexData.blob) {
      const { decodeData } = await import('../src/utils/codec.js')
      const jsonStr = decodeData(indexData.blob)
      categories = JSON.parse(jsonStr)
    }

    // 3. 拉取每个分类的数据
    const categoryData = {}
    for (const cat of categories) {
      const categoryUrl = `${CONFIG.ONLINE_DATA_BASE_URL}/${seriesId}/${cat.file}`
      const catResponse = await fetch(categoryUrl)
      if (catResponse.ok) {
        categoryData[cat.name] = await catResponse.json()
      }
    }

    return { indexData, categoryData, categories }
  }
  catch (e) {
    console.error(`  Failed to fetch from online:`, e.message)
    return null
  }
}

/**
 * 通过本地目录获取壁纸列表（支持分类文件夹结构）
 * @returns {{ files: Array, repoPath: string } | null}
 */
function fetchWallpapersFromLocal(seriesConfig) {
  for (const repoPath of CONFIG.LOCAL_REPO_PATHS) {
    const localWallpaperDir = path.join(repoPath, seriesConfig.wallpaperDir)

    if (!fs.existsSync(localWallpaperDir)) {
      console.log(`  Path not found: ${localWallpaperDir}`)
      continue
    }

    console.log(`  Fetching from local: ${localWallpaperDir}`)

    // 递归扫描目录
    const files = scanDirectoryRecursive(localWallpaperDir)

    console.log(`  Found ${files.length} image files`)
    return { files, repoPath }
  }

  console.log('  No local repository found')
  return null
}

/**
 * 通过 GitHub API 获取壁纸列表
 */
async function fetchWallpapersFromGitHub(seriesConfig) {
  const apiUrl = `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${seriesConfig.wallpaperDir}?ref=${CONFIG.GITHUB_BRANCH}`

  console.log(`  Fetching from GitHub API: ${apiUrl}`)

  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Wallpaper-Gallery-Builder',
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      console.log(`  Directory not found on GitHub (this is OK for new series)`)
      return []
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }

  const entries = await response.json()
  const files = []

  // 处理目录和文件
  for (const entry of entries) {
    if (entry.type === 'dir') {
      // 递归获取子目录内容
      const subFiles = await fetchSubdirectoryFromGitHub(seriesConfig, entry.name)
      files.push(...subFiles)
    }
    else if (entry.type === 'file') {
      const ext = path.extname(entry.name).toLowerCase()
      if (CONFIG.IMAGE_EXTENSIONS.includes(ext)) {
        files.push({
          ...entry,
          category: extractCategoryFromFilename(entry.name),
          relativePath: entry.name,
        })
      }
    }
  }

  console.log(`  Found ${files.length} image files`)
  return files
}

/**
 * 从 GitHub API 获取子目录内容
 */
async function fetchSubdirectoryFromGitHub(seriesConfig, subdir) {
  const apiUrl = `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${seriesConfig.wallpaperDir}/${subdir}?ref=${CONFIG.GITHUB_BRANCH}`

  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Wallpaper-Gallery-Builder',
    },
  })

  if (!response.ok) {
    console.log(`  Failed to fetch subdirectory: ${subdir}`)
    return []
  }

  const entries = await response.json()
  const files = []

  for (const entry of entries) {
    if (entry.type === 'file') {
      const ext = path.extname(entry.name).toLowerCase()
      if (CONFIG.IMAGE_EXTENSIONS.includes(ext)) {
        files.push({
          ...entry,
          category: subdir, // 子目录名即为分类
          relativePath: `${subdir}/${entry.name}`,
        })
      }
    }
  }

  return files
}

/**
 * 获取图片分辨率信息
 */
function getImageDimensions(filePath) {
  // 如果设置了跳过标志,直接返回 null(用于加速 CI 构建)
  if (process.env.SKIP_IMAGE_DIMENSIONS === 'true') {
    return null
  }

  try {
    let cmd = 'magick identify'
    try {
      execSync('magick --version', { stdio: 'ignore' })
    }
    catch {
      cmd = 'identify'
    }

    const result = execSync(`${cmd} -format "%w %h" "${filePath}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()

    const [width, height] = result.split(' ').map(Number)
    if (width > 0 && height > 0) {
      return { width, height }
    }
  }
  catch {
    // ImageMagick 不可用或执行失败，静默忽略
  }
  return null
}

/**
 * 根据分辨率生成标签信息
 */
function getResolutionLabel(width, height) {
  const maxDim = Math.max(width, height)

  if (maxDim >= 15360) {
    return { label: '16K', type: 'danger' }
  }
  else if (maxDim >= 7680) {
    return { label: '8K', type: 'danger' }
  }
  else if (maxDim >= 5760) {
    return { label: '6K', type: 'warning' }
  }
  else if (maxDim >= 5120) {
    return { label: '5K+', type: 'danger' }
  }
  else if (maxDim >= 4096) {
    return { label: '4K+', type: 'warning' }
  }
  else if (maxDim >= 3840) {
    return { label: '4K', type: 'success' }
  }
  else if (maxDim >= 2048) {
    return { label: '2K', type: 'info' }
  }
  else if (maxDim >= 1920) {
    return { label: '超清', type: 'primary' }
  }
  else if (maxDim >= 1280) {
    return { label: '高清', type: 'secondary' }
  }
  else {
    return { label: '标清', type: 'secondary' }
  }
}

/**
 * 生成壁纸数据（支持二级分类文件夹结构）
 */
function generateWallpaperData(files, seriesConfig, localRepoPath = null) {
  return files.map((file, index) => {
    const ext = path.extname(file.name).replace('.', '').toUpperCase()

    // 使用文件的真实修改时间，而不是生成假时间
    let uploadDate
    if (file.fullPath && fs.existsSync(file.fullPath)) {
      const stats = fs.statSync(file.fullPath)
      uploadDate = new Date(stats.mtime)
    }
    else {
      // 回退：如果无法获取文件时间，使用当前时间
      uploadDate = new Date()
    }

    // 文件名（不含扩展名）
    const filenameNoExt = path.basename(file.name, path.extname(file.name))

    // 分类（优先使用文件对象中的 category，否则从文件名提取）
    const category = file.category || extractCategoryFromFilename(file.name)
    // 二级分类（null 表示没有二级分类）
    const subcategory = file.subcategory || null

    // 构建路径（支持二级分类文件夹结构）
    // relativePath 可能是 "游戏/原神/xxx.jpg" 或 "动漫/通用/xxx.jpg" 或 "xxx.jpg"
    const relativePath = file.relativePath || file.name
    const pathParts = relativePath.split(path.sep)
    const isInSubfolder = pathParts.length > 1

    // 壁纸路径
    const imagePath = `/${seriesConfig.wallpaperDir}/${encodeURIComponent(relativePath).replace(/%2F/g, '/')}`

    // 缩略图和预览图路径（与壁纸保持相同的目录结构）
    let thumbnailPath, previewPath
    if (isInSubfolder) {
      const subdir = pathParts.slice(0, -1).join('/')
      thumbnailPath = `/${seriesConfig.thumbnailDir}/${subdir}/${encodeURIComponent(filenameNoExt)}.webp`
      previewPath = seriesConfig.hasPreview
        ? `/${seriesConfig.previewDir}/${subdir}/${encodeURIComponent(filenameNoExt)}.webp`
        : null
    }
    else {
      thumbnailPath = `/${seriesConfig.thumbnailDir}/${encodeURIComponent(filenameNoExt)}.webp`
      previewPath = seriesConfig.hasPreview
        ? `/${seriesConfig.previewDir}/${encodeURIComponent(filenameNoExt)}.webp`
        : null
    }

    // 获取图片分辨率
    let resolution = null
    if (localRepoPath && file.fullPath) {
      if (fs.existsSync(file.fullPath)) {
        const dimensions = getImageDimensions(file.fullPath)
        if (dimensions) {
          const labelInfo = getResolutionLabel(dimensions.width, dimensions.height)
          resolution = {
            width: dimensions.width,
            height: dimensions.height,
            label: labelInfo.label,
            type: labelInfo.type,
          }
        }
      }
    }

    // 获取图片专属的 cdnTag（用于精准 CDN 缓存控制）
    let cdnTag
    if (localRepoPath) {
      cdnTag = getCdnTag(seriesConfig.id, relativePath, localRepoPath)
    }

    const wallpaperData = {
      id: `${seriesConfig.id}-${index + 1}`,
      filename: file.name,
      category,
      path: imagePath,
      thumbnailPath,
      size: file.size,
      format: ext,
      createdAt: uploadDate.toISOString(),
      sha: file.sha || '',
    }

    // 添加 cdnTag（仅当存在时）
    if (cdnTag) {
      wallpaperData.cdnTag = cdnTag
    }

    // 添加二级分类（仅当存在时）
    if (subcategory) {
      wallpaperData.subcategory = subcategory
    }

    // 自动生成 tags（包含分类信息，便于搜索）
    const autoTags = [category]
    if (subcategory) {
      autoTags.push(subcategory)
    }
    wallpaperData.tags = autoTags

    if (previewPath) {
      wallpaperData.previewPath = previewPath
    }

    if (resolution) {
      wallpaperData.resolution = resolution
    }

    return wallpaperData
  })
}

/**
 * 按分类拆分并生成独立的 JSON 文件（支持二级分类）
 */
function generateCategorySplitData(wallpapers, seriesId, seriesConfig) {
  const seriesDir = path.join(CONFIG.OUTPUT_DIR, seriesId)
  if (!fs.existsSync(seriesDir)) {
    fs.mkdirSync(seriesDir, { recursive: true })
  }

  // 按分类分组
  const categoryGroups = {}
  wallpapers.forEach((wallpaper) => {
    const category = wallpaper.category
    if (!categoryGroups[category]) {
      categoryGroups[category] = []
    }
    categoryGroups[category].push(wallpaper)
  })

  // 生成分类索引（包含二级分类信息）
  const categories = Object.entries(categoryGroups).map(([categoryName, items]) => {
    const thumbnail = items[0]?.thumbnailPath || items[0]?.path || ''

    // 统计该分类下的二级分类
    const subcategoryMap = {}
    items.forEach((item) => {
      const subcat = item.subcategory || null
      if (!subcategoryMap[subcat]) {
        subcategoryMap[subcat] = 0
      }
      subcategoryMap[subcat]++
    })

    // 转换为数组格式
    const subcategories = Object.entries(subcategoryMap)
      .map(([name, count]) => ({
        name: name === 'null' ? null : name,
        count,
      }))
      .filter(s => s.name !== null) // 过滤掉 null（无二级分类）
      .sort((a, b) => b.count - a.count)

    return {
      id: categoryName.replace(/\s+/g, '-').toLowerCase(),
      name: categoryName,
      count: items.length,
      thumbnail,
      file: `${categoryName}.json`,
      // 二级分类列表（仅当存在时）
      ...(subcategories.length > 0 && { subcategories }),
    }
  })

  categories.sort((a, b) => b.count - a.count)

  const categoriesBlob = encodeData(JSON.stringify(categories))

  const indexData = {
    generatedAt: new Date().toISOString(),
    series: seriesId,
    seriesName: seriesConfig.name,
    total: wallpapers.length,
    categoryCount: categories.length,
    blob: categoriesBlob,
    schema: 2,
    env: process.env.NODE_ENV || 'production',
  }

  const indexPath = path.join(seriesDir, 'index.json')
  fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2))
  console.log(`  Generated: ${seriesId}/index.json`)

  // 为每个分类生成独立的 JSON 文件
  Object.entries(categoryGroups).forEach(([categoryName, items]) => {
    const blob = encodeData(JSON.stringify(items))
    const encryptedData = {
      generatedAt: new Date().toISOString(),
      series: seriesId,
      category: categoryName,
      total: items.length,
      blob,
      schema: 2,
    }

    const categoryPath = path.join(seriesDir, `${categoryName}.json`)
    fs.writeFileSync(categoryPath, JSON.stringify(encryptedData, null, 2))
    console.log(`  Generated: ${seriesId}/${categoryName}.json (${items.length} items)`)
  })

  return categories
}

/**
 * 处理单个系列
 *
 * 数据获取优先级：
 * 1. 本地图床仓库：优先检查（项目维护者或 CI 环境 checkout）
 * 2. 线上数据源：从 wallpaper.061129.xyz 获取（开源用户）
 * 3. GitHub API：最后备用（数据可能不完整）
 *
 * 注意：CI 环境会自动 checkout nuanXinProPic 仓库到本地
 */

/**
 * 处理每日 Bing 壁纸系列（纯元数据模式）
 * 从本地图床仓库或线上数据源复制 JSON 元数据文件
 */
async function processBingSeries(seriesId, seriesConfig) {
  console.log('')
  console.log(`Processing series: ${seriesConfig.name} (${seriesId})`)
  console.log('-'.repeat(40))

  const bingOutputDir = path.join(CONFIG.OUTPUT_DIR, 'bing')

  // 确保输出目录存在
  if (!fs.existsSync(bingOutputDir)) {
    fs.mkdirSync(bingOutputDir, { recursive: true })
  }

  // 1. 优先尝试从本地图床仓库复制
  for (const repoPath of CONFIG.LOCAL_REPO_PATHS) {
    if (fs.existsSync(repoPath)) {
      const bingSrcDir = path.join(repoPath, seriesConfig.metadataDir)

      if (fs.existsSync(bingSrcDir)) {
        console.log(`  Found local Bing metadata: ${bingSrcDir}`)

        // 复制所有 JSON 文件
        const files = fs.readdirSync(bingSrcDir).filter(f => f.endsWith('.json'))
        let totalItems = 0

        for (const file of files) {
          const srcPath = path.join(bingSrcDir, file)
          const destPath = path.join(bingOutputDir, file)
          fs.copyFileSync(srcPath, destPath)
          console.log(`  Copied: ${file}`)

          // 统计总数
          if (file === 'index.json') {
            try {
              const indexData = JSON.parse(fs.readFileSync(srcPath, 'utf-8'))
              totalItems = indexData.total || 0
            }
            catch {
              // 忽略解析错误
            }
          }
        }

        console.log(`  ✅ Copied ${files.length} files from local repository`)
        return { seriesId, count: totalItems, wallpapers: [], fromLocal: true }
      }
    }
  }

  // 2. 从线上拉取
  console.log('  Fetching Bing data from online...')

  try {
    // 获取 index.json
    const indexUrl = `${CONFIG.ONLINE_DATA_BASE_URL}/bing/index.json`
    const indexResponse = await fetch(indexUrl)

    if (!indexResponse.ok) {
      throw new Error(`Failed to fetch ${indexUrl}`)
    }

    const indexData = await indexResponse.json()
    fs.writeFileSync(path.join(bingOutputDir, 'index.json'), JSON.stringify(indexData, null, 2))
    console.log('  Downloaded: index.json')

    // 获取 latest.json
    try {
      const latestUrl = `${CONFIG.ONLINE_DATA_BASE_URL}/bing/latest.json`
      const latestResponse = await fetch(latestUrl)
      if (latestResponse.ok) {
        const latestData = await latestResponse.json()
        fs.writeFileSync(path.join(bingOutputDir, 'latest.json'), JSON.stringify(latestData, null, 2))
        console.log('  Downloaded: latest.json')
      }
    }
    catch {
      console.log('  ⚠️ latest.json not available')
    }

    // 获取年度数据文件
    if (indexData.years && Array.isArray(indexData.years)) {
      for (const yearInfo of indexData.years) {
        try {
          const yearUrl = `${CONFIG.ONLINE_DATA_BASE_URL}/bing/${yearInfo.file}`
          const yearResponse = await fetch(yearUrl)
          if (yearResponse.ok) {
            const yearData = await yearResponse.json()
            fs.writeFileSync(path.join(bingOutputDir, yearInfo.file), JSON.stringify(yearData, null, 2))
            console.log(`  Downloaded: ${yearInfo.file}`)
          }
        }
        catch {
          console.log(`  ⚠️ Failed to download ${yearInfo.file}`)
        }
      }
    }

    console.log(`  ✅ Downloaded Bing data: ${indexData.total || 0} items`)
    return { seriesId, count: indexData.total || 0, wallpapers: [], fromOnline: true }
  }
  catch (e) {
    console.log(`  ❌ Failed to fetch Bing data: ${e.message}`)
    return { seriesId, count: 0, wallpapers: [], fromOnline: false }
  }
}

async function processSeries(seriesId, seriesConfig) {
  // Bing 系列使用特殊处理逻辑
  if (seriesConfig.isBing) {
    return processBingSeries(seriesId, seriesConfig)
  }

  console.log('')
  console.log(`Processing series: ${seriesConfig.name} (${seriesId})`)
  console.log('-'.repeat(40))

  let files = null
  let localRepoPath = null

  // 优先尝试从本地图床仓库读取（项目维护者使用 --local，CI 环境自动检测）
  const localResult = fetchWallpapersFromLocal(seriesConfig)
  if (localResult) {
    files = localResult.files
    localRepoPath = localResult.repoPath
  }

  // 数据获取策略：
  // 1. 本地图床仓库：优先使用（项目维护者 --local 或 CI checkout）
  // 2. 线上数据源：从 wallpaper.061129.xyz 获取（开源用户）
  // 3. GitHub API：最后备用（数据可能不完整，会有警告）

  if (!files) {
    if (FORCE_GITHUB) {
      // 强制模式：直接使用 GitHub API（调试用）
      console.log('  --github flag detected, fetching from GitHub API...')
      files = await fetchWallpapersFromGitHub(seriesConfig)
    }
    else {
      // 尝试从线上拉取数据
      console.log('  Fetching from online...')
      const onlineData = await fetchDataFromOnline(seriesId, seriesConfig)

      if (onlineData && onlineData.indexData && onlineData.indexData.total > 0) {
        // 线上数据可用，直接使用
        console.log(`  ✅ Online data available: ${onlineData.indexData.total} items`)

        // 确保输出目录存在
        const seriesDir = path.join(CONFIG.OUTPUT_DIR, seriesId)
        if (!fs.existsSync(seriesDir)) {
          fs.mkdirSync(seriesDir, { recursive: true })
        }

        // 写入索引文件
        const indexPath = path.join(seriesDir, 'index.json')
        fs.writeFileSync(indexPath, JSON.stringify(onlineData.indexData, null, 2))
        console.log(`  Copied: ${seriesId}/index.json`)

        // 写入分类文件
        for (const [categoryName, categoryData] of Object.entries(onlineData.categoryData)) {
          const categoryPath = path.join(seriesDir, `${categoryName}.json`)
          fs.writeFileSync(categoryPath, JSON.stringify(categoryData, null, 2))
          console.log(`  Copied: ${seriesId}/${categoryName}.json`)
        }

        // 同时生成传统的单文件（向后兼容）
        try {
          const legacyUrl = `${CONFIG.ONLINE_DATA_BASE_URL}/${seriesConfig.outputFile}`
          const legacyResponse = await fetch(legacyUrl)
          if (legacyResponse.ok) {
            const legacyData = await legacyResponse.json()
            const legacyPath = path.join(CONFIG.OUTPUT_DIR, seriesConfig.outputFile)
            fs.writeFileSync(legacyPath, JSON.stringify(legacyData, null, 2))
            console.log(`  Copied: ${seriesConfig.outputFile}`)
          }
        }
        catch (e) {
          console.warn(`  Failed to fetch legacy file: ${e.message}`)
        }

        return {
          seriesId,
          count: onlineData.indexData.total || 0,
          wallpapers: [],
          fromOnline: true,
        }
      }
      else {
        // 线上数据不可用，记录警告
        console.warn(`  ⚠️ Online data unavailable, will try local/GitHub sources`)
      }
    }
  }

  // 如果线上数据不可用，继续尝试本地或 GitHub API
  if (!files) {
    console.warn(`  ⚠️ No data source available for ${seriesConfig.name}`)
    console.warn(`  📝 This may indicate a production issue if online source is down`)
    console.warn(`  💡 Falling back to GitHub API (may have incomplete data)`)

    // 最后尝试 GitHub API
    console.log(`  Fetching from GitHub API as last resort...`)
    files = await fetchWallpapersFromGitHub(seriesConfig)
  }

  if (!files || files.length === 0) {
    console.log(`  No image files found for ${seriesConfig.name}`)
    const wallpapers = []
    const blob = encodeData(JSON.stringify(wallpapers))

    const outputData = {
      generatedAt: new Date().toISOString(),
      series: seriesId,
      seriesName: seriesConfig.name,
      total: 0,
      schema: 1,
      env: process.env.NODE_ENV || 'production',
      blob,
    }

    const outputPath = path.join(CONFIG.OUTPUT_DIR, seriesConfig.outputFile)
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2))
    console.log(`  Created empty: ${seriesConfig.outputFile}`)

    return { seriesId, count: 0, wallpapers }
  }

  const wallpapers = generateWallpaperData(files, seriesConfig, localRepoPath)
  wallpapers.sort((a, b) => b.size - a.size)

  const outputPath = path.join(CONFIG.OUTPUT_DIR, seriesConfig.outputFile)
  const blob = encodeData(JSON.stringify(wallpapers))

  const outputData = {
    generatedAt: new Date().toISOString(),
    series: seriesId,
    seriesName: seriesConfig.name,
    total: wallpapers.length,
    schema: 1,
    env: process.env.NODE_ENV || 'production',
    blob,
  }

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2))
  console.log(`  Output: ${seriesConfig.outputFile} (${wallpapers.length} items)`)

  // 分类统计（包含二级分类）
  const categoryStats = {}
  const subcategoryStats = {}
  wallpapers.forEach((w) => {
    categoryStats[w.category] = (categoryStats[w.category] || 0) + 1
    if (w.subcategory) {
      const key = `${w.category}/${w.subcategory}`
      subcategoryStats[key] = (subcategoryStats[key] || 0) + 1
    }
  })

  console.log('  Categories:')
  Object.entries(categoryStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`    ${cat}: ${count}`)
    })

  // 显示二级分类统计
  if (Object.keys(subcategoryStats).length > 0) {
    console.log('  Subcategories:')
    Object.entries(subcategoryStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // 只显示前10个
      .forEach(([subcat, count]) => {
        console.log(`    ${subcat}: ${count}`)
      })
    if (Object.keys(subcategoryStats).length > 10) {
      console.log(`    ... and ${Object.keys(subcategoryStats).length - 10} more`)
    }
  }

  // 分辨率统计
  const resolutionStats = {}
  wallpapers.forEach((w) => {
    if (w.resolution) {
      resolutionStats[w.resolution.label] = (resolutionStats[w.resolution.label] || 0) + 1
    }
  })

  if (Object.keys(resolutionStats).length > 0) {
    console.log('  Resolutions:')
    Object.entries(resolutionStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([res, count]) => {
        console.log(`    ${res}: ${count}`)
      })
  }

  if (CONFIG.ENABLE_CATEGORY_SPLIT) {
    console.log('')
    console.log('  Generating category split data...')
    generateCategorySplitData(wallpapers, seriesId, seriesConfig)
  }

  return { seriesId, count: wallpapers.length, wallpapers }
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(50))
  console.log('Wallpaper Data Generator (Category Folders Support)')
  console.log('='.repeat(50))

  try {
    if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
      fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true })
    }

    const results = []
    for (const [seriesId, seriesConfig] of Object.entries(CONFIG.SERIES)) {
      const result = await processSeries(seriesId, seriesConfig)
      results.push(result)
    }

    console.log('')
    console.log('='.repeat(50))
    console.log('Generation Complete!')
    console.log('='.repeat(50))

    let totalCount = 0
    let hasOnlineData = false
    results.forEach((result) => {
      const config = CONFIG.SERIES[result.seriesId]
      if (result.fromOnline) {
        console.log(`${config.name}: ${result.count} items (from online)`)
        hasOnlineData = true
      }
      else {
        console.log(`${config.name}: ${result.count} items -> ${config.outputFile}`)
      }
      totalCount += result.count
    })

    console.log('-'.repeat(50))
    console.log(`Total: ${totalCount} wallpapers across ${results.length} series`)
    console.log(`Output directory: ${CONFIG.OUTPUT_DIR}`)

    if (hasOnlineData) {
      console.log('')
      console.log('📦 Data was fetched from online source.')
      console.log('   This is normal for open-source users without local image repository.')
    }

    console.log('')

    // 只有本地生成时才统计格式
    const localResults = results.filter(r => !r.fromOnline)
    if (localResults.length > 0) {
      const formatStats = { jpg: 0, png: 0 }
      localResults.forEach((result) => {
        result.wallpapers.forEach((w) => {
          if (w.format === 'JPG' || w.format === 'JPEG')
            formatStats.jpg++
          else if (w.format === 'PNG')
            formatStats.png++
        })
      })

      console.log('Format Statistics (All Series):')
      console.log(`  JPG: ${formatStats.jpg}`)
      console.log(`  PNG: ${formatStats.png}`)
    }
  }
  catch (error) {
    console.error('Error generating wallpaper data:', error)
    process.exit(1)
  }
}

main()
