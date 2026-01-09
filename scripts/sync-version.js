#!/usr/bin/env node
/**
 * Android 版本同步脚本
 * 用于同步 package.json 和 android/app/build.gradle 的版本号
 *
 * 用法：
 *   node scripts/sync-version.js [version] [--bump patch|minor|major]
 *
 * 示例：
 *   node scripts/sync-version.js                # 仅同步，不改版本
 *   node scripts/sync-version.js 1.2.0          # 设置指定版本
 *   node scripts/sync-version.js --bump patch   # 自动升级补丁版本 1.0.1 -> 1.0.2
 *   node scripts/sync-version.js --bump minor   # 自动升级次版本 1.0.1 -> 1.1.0
 *   node scripts/sync-version.js --bump major   # 自动升级主版本 1.0.1 -> 2.0.0
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')

const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json')
const BUILD_GRADLE_PATH = path.join(ROOT_DIR, 'android/app/build.gradle')

/**
 * 解析版本号
 */
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) {
    throw new Error(`无效的版本号格式: ${version}，应为 x.y.z`)
  }
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  }
}

/**
 * 版本号升级
 */
function bumpVersion(version, type) {
  const { major, minor, patch } = parseVersion(version)

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      throw new Error(`无效的升级类型: ${type}`)
  }
}

/**
 * 计算 Android versionCode
 * 规则：major * 10000 + minor * 100 + patch
 * 例如：1.2.3 -> 10203
 */
function calculateVersionCode(version) {
  const { major, minor, patch } = parseVersion(version)
  return major * 10000 + minor * 100 + patch
}

/**
 * 读取 package.json 版本
 */
function getPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'))
  return pkg.version
}

/**
 * 更新 package.json 版本
 */
function updatePackageVersion(newVersion) {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'))
  pkg.version = newVersion
  fs.writeFileSync(PACKAGE_JSON_PATH, `${JSON.stringify(pkg, null, 2)}\n`)
  console.log(`✅ package.json 版本已更新为 ${newVersion}`)
}

/**
 * 更新 build.gradle 版本
 */
function updateBuildGradle(versionName, versionCode) {
  let content = fs.readFileSync(BUILD_GRADLE_PATH, 'utf-8')

  // 更新 versionCode
  content = content.replace(
    /versionCode\s+\d+/,
    `versionCode ${versionCode}`,
  )

  // 更新 versionName
  content = content.replace(
    /versionName\s+"[^"]+"/,
    `versionName "${versionName}"`,
  )

  fs.writeFileSync(BUILD_GRADLE_PATH, content)
  console.log(`✅ build.gradle 已更新：versionName="${versionName}", versionCode=${versionCode}`)
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2)

  let newVersion = null
  let bumpType = null

  // 解析参数
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bump' && args[i + 1]) {
      bumpType = args[i + 1]
      i++
    }
    else if (!args[i].startsWith('-')) {
      newVersion = args[i]
    }
  }

  // 获取当前版本
  const currentVersion = getPackageVersion()
  console.log(`📦 当前版本: ${currentVersion}`)

  // 确定目标版本
  if (newVersion) {
    // 使用指定版本
    parseVersion(newVersion) // 验证格式
  }
  else if (bumpType) {
    // 自动升级
    newVersion = bumpVersion(currentVersion, bumpType)
    console.log(`🚀 版本升级 (${bumpType}): ${currentVersion} -> ${newVersion}`)
  }
  else {
    // 仅同步
    newVersion = currentVersion
    console.log('🔄 同步版本到 Android...')
  }

  // 计算 versionCode
  const versionCode = calculateVersionCode(newVersion)
  console.log(`📱 Android versionCode: ${versionCode}`)

  // 更新文件
  if (newVersion !== currentVersion) {
    updatePackageVersion(newVersion)
  }
  updateBuildGradle(newVersion, versionCode)

  console.log('\n✨ 版本同步完成!')
  console.log(`   版本号: ${newVersion}`)
  console.log(`   versionCode: ${versionCode}`)
}

main()
