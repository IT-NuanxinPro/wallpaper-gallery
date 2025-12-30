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

// 命令行参数：--local 使用本地图床仓库（仅项目维护者使用）
const USE_LOCAL = process.argv.includes('--local')
// 命令行参数：--github 强制使用 GitHub API（用于 CI 或调试）
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

// 配置
const CONFIG = {
  // GitHub 图床仓库信息
  GITHUB_OWNER: 'IT-NuanxinPro',
  GITHUB_REPO: 'nuanXinProPic',
  GITHUB_BRANCH: 'main',

  // 本地图床仓库路径（仅 CI 环境使用）
  // 开源用户无需配置，会自动从线上拉取数据
  LOCAL_REPO_PATHS: [
    path.resolve(__dirname, '../nuanXinProPic'), // CI 环境：项目根目录下
    path.resolve(__dirname, '../../nuanXinProPic'), // 本地开发：同级目录（仅项目维护者使用）
  ],

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

  if (maxDim >= 7680) {
    return { label: '8K', type: 'danger' }
  }
  else if (maxDim >= 3840) {
    return { label: '4K', type: 'warning' }
  }
  else if (maxDim >= 2560) {
    return { label: '2K', type: 'info' }
  }
  else if (maxDim >= 1920) {
    return { label: '1080P', type: 'success' }
  }
  else if (maxDim >= 1280) {
    return { label: '720P', type: 'primary' }
  }
  else {
    return { label: 'SD', type: 'secondary' }
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
 * 重要说明：
 * - 由于 GitHub 仓库的图片数据可能不完整（如 desktop 只有1张），
 * - 所有环境（包括 CI）都优先使用线上数据源获取完整数据
 * - 只有明确指定 --github 参数时才使用 GitHub API（调试用）
 */
async function processSeries(seriesId, seriesConfig) {
  console.log('')
  console.log(`Processing series: ${seriesConfig.name} (${seriesId})`)
  console.log('-'.repeat(40))

  let files = null
  let localRepoPath = null

  // 只有指定 --local 参数时才尝试从本地读取
  if (USE_LOCAL) {
    const localResult = fetchWallpapersFromLocal(seriesConfig)
    if (localResult) {
      files = localResult.files
      localRepoPath = localResult.repoPath
    }
    else {
      console.log('  ⚠️ --local specified but local repository not found!')
    }
  }

  // 注意：由于 GitHub 仓库的图片数据可能不完整，
  // 优先使用线上数据源，但需要验证数据完整性

  if (!files) {
    if (FORCE_GITHUB) {
      // 强制模式：直接使用 GitHub API（调试用）
      console.log('  --github flag detected, fetching from GitHub API...')
      files = await fetchWallpapersFromGitHub(seriesConfig)
    }
    else {
      // 所有环境：优先从线上拉取预生成数据（数据最完整）
      console.log('  Fetching from online...')
      const onlineData = await fetchDataFromOnline(seriesId, seriesConfig)

      // 验证线上数据的完整性
      const expectedMinCounts = {
        desktop: 100, // 电脑壁纸至少应该有100张
        mobile: 50, // 手机壁纸至少应该有50张
        avatar: 30, // 头像至少应该有30张
      }

      const minCount = expectedMinCounts[seriesId] || 1
      const actualCount = onlineData?.indexData?.total || 0

      if (onlineData && actualCount >= minCount) {
        // 线上数据完整，使用线上数据
        console.log(`  ✅ Online data validated: ${actualCount} items (min: ${minCount})`)

        // 直接复制线上数据到本地
        console.log(`  Successfully fetched online data for ${seriesConfig.name}`)

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
          wallpapers: [], // 线上模式不返回详细数据
          fromOnline: true,
        }
      }
      else {
        // 线上数据不完整或不可用
        if (onlineData) {
          console.warn(`  ⚠️ Online data incomplete: ${actualCount} items (expected min: ${minCount})`)
        }
        else {
          console.warn(`  ⚠️ Online data unavailable`)
        }

        // 不回退到 GitHub API，而是报错停止构建
        throw new Error(`
❌ 数据源问题检测：
- 系列: ${seriesConfig.name}
- 线上数据: ${actualCount} 项 (期望最少: ${minCount} 项)
- 为避免用不完整数据覆盖完整数据，构建已停止
- 请检查线上数据源或使用 --github 参数强制使用 GitHub API
        `)
      }
    }
  }

  if (files.length === 0) {
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
