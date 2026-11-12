#!/usr/bin/env node
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { validateDeploymentSnapshot } from './lib/deploymentSnapshot.js'

export { validateDeploymentSnapshot } from './lib/deploymentSnapshot.js'

const SHA = /^[a-f0-9]{40}$/

export async function prepareDeploymentData({ repository = 'IT-NuanxinPro/nuanXinProPic', branch = 'main', token, outputDir = 'public/data', publicationId = '', minimumDataRef = '', frontendSha = '', runId = '', runAttempt = '', fetchImpl = fetch } = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
    throw new Error('图床仓库配置无效')
  if (!!publicationId !== !!minimumDataRef || (minimumDataRef && !SHA.test(minimumDataRef)))
    throw new Error('publication_id与minimum_data_ref必须同时提供，且最低版本必须为完整SHA')
  const base = `https://api.github.com/repos/${repository}`
  async function request(route) {
    const response = await fetchImpl(`${base}${route}`, { headers: { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'wallpaper-gallery-data-snapshot', ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
    if (!response.ok)
      throw new Error(`读取图床完整数据失败（HTTP ${response.status}）`)
    return response.json()
  }
  // 本函数只在部署串行执行权取得后运行；固定此刻最新HEAD，之后所有文件来自同一SHA。
  const dataSha = (await request(`/git/ref/heads/${encodeURIComponent(branch)}`)).object?.sha
  if (!SHA.test(dataSha || ''))
    throw new Error('图床未返回有效HEAD SHA')
  if (minimumDataRef) {
    const comparison = await request(`/compare/${minimumDataRef}...${dataSha}`)
    if (!['ahead', 'identical'].includes(comparison.status))
      throw new Error('最新数据HEAD不包含minimum_data_ref，拒绝回退或错配部署')
  }
  const commit = await request(`/git/commits/${dataSha}`)
  const tree = await request(`/git/trees/${commit.tree.sha}?recursive=1`)
  if (tree.truncated || !Array.isArray(tree.tree))
    throw new Error('图床目录不完整，拒绝部分数据部署')
  const entries = tree.tree.filter(item => item.type === 'blob' && item.path.endsWith('.json') && (item.path.startsWith('data/') || item.path.startsWith('bing/meta/') || item.path === 'metadata/video.json'))
    .sort((left, right) => Number(left.path.startsWith('bing/meta/')) - Number(right.path.startsWith('bing/meta/')) || left.path.localeCompare(right.path))
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-deploy-data-'))
  const staged = path.join(temporary, 'data')
  fs.mkdirSync(staged)
  let videoMetadata
  try {
    for (const entry of entries) {
      const segments = entry.path.split('/')
      if (segments.some(segment => !segment || ['.', '..'].includes(segment) || segment.includes('\\') || [...segment].some(character => character.charCodeAt(0) < 32)))
        throw new Error('图床目录包含非法路径')
      const blob = await request(`/git/blobs/${entry.sha}`)
      if (blob.encoding !== 'base64' || typeof blob.content !== 'string')
        throw new Error('图床数据blob编码无效')
      const bytes = Buffer.from(blob.content, 'base64')
      const hash = crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
      if (hash !== entry.sha)
        throw new Error('图床数据blob摘要与固定快照不符')
      const value = JSON.parse(bytes.toString('utf8'))
      if (entry.path === 'metadata/video.json') {
        videoMetadata = value
        continue
      }
      const relative = entry.path.startsWith('bing/meta/') ? `bing/${entry.path.slice('bing/meta/'.length)}` : entry.path.slice('data/'.length)
      const target = path.join(staged, relative)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, bytes)
    }
    // bing/meta 是Bing权威源，不允许缺失后悄悄沿用data/bing旧副本。
    if (!entries.some(item => item.path === 'bing/meta/index.json'))
      throw new Error('图床快照缺少bing/meta/index.json')
    const validation = validateDeploymentSnapshot(staged, { publicationId, videoMetadata })
    const tags = await request('/tags?per_page=100')
    const cdnVersion = tags.find(item => /^v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(item.name))?.name
    if (!cdnVersion)
      throw new Error('图床没有有效静态CDN tag')
    const target = path.resolve(outputDir)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    const replacement = `${target}.snapshot-${crypto.randomUUID()}`
    const backup = `${target}.previous-${crypto.randomUUID()}`
    fs.cpSync(staged, replacement, { recursive: true })
    const existed = fs.existsSync(target)
    if (existed)
      fs.renameSync(target, backup)
    try {
      fs.renameSync(replacement, target)
    }
    catch (error) {
      if (existed)
        fs.renameSync(backup, target)
      throw error
    }
    if (existed)
      fs.rmSync(backup, { recursive: true, force: true })
    const marker = `gallery-data:${dataSha}:run:${runId}:attempt:${runAttempt}`
    return { dataSha, cdnVersion, marker, publicationId, minimumDataRef, frontendSha, totals: validation.totals }
  }
  finally { fs.rmSync(temporary, { recursive: true, force: true }) }
}

async function main() {
  const result = await prepareDeploymentData({ repository: process.env.VIDEO_DATA_REPOSITORY || 'IT-NuanxinPro/nuanXinProPic', token: process.env.GITHUB_TOKEN, publicationId: process.env.PUBLICATION_ID || '', minimumDataRef: process.env.MINIMUM_DATA_REF || '', frontendSha: process.env.FRONTEND_SHA || '', runId: process.env.GITHUB_RUN_ID || '', runAttempt: process.env.GITHUB_RUN_ATTEMPT || '' })
  fs.mkdirSync('.deployment', { recursive: true })
  fs.writeFileSync('.deployment/snapshot.json', `${JSON.stringify(result, null, 2)}\n`)
  if (process.env.GITHUB_OUTPUT)
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `data_sha=${result.dataSha}\ncdn_version=${result.cdnVersion}\ndeployment_marker=${result.marker}\n`)
  console.log(`已验收五系列完整数据，SHA=${result.dataSha}，计数=${JSON.stringify(result.totals)}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
