import fs from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeData as awaitDecode, encodeData } from '../src/utils/common/codec.js'
import { prepareDeploymentData, validateDeploymentSnapshot } from '../scripts/prepare-deploy-data.js'
import { syncWallpaperAssets } from '../scripts/sync-wallpaper-assets.js'
import { resolvePagesDeployment, writePublicationResult } from '../scripts/record-pages-deployment.js'

const temporaryRoots = []
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
  vi.unstubAllEnvs()
  vi.resetModules()
})

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-deploy-snapshot-'))
  temporaryRoots.push(root)
  return root
}
function write(root, name, value) {
  const target = path.join(root, name)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(value))
}
function envelope(items, extra = {}) {
  return { total: items.length, blob: encodeData(JSON.stringify(items)), ...extra }
}
function snapshot(root) {
  for (const series of ['desktop', 'mobile', 'avatar', 'video']) {
    const item = { id: `${series}-1`, category: 'topic', filename: 'one.mp4', mediaType: series === 'video' ? 'video' : 'image', path: `/wallpaper/${series}/topic/one.mp4`, thumbnailPath: `/thumbnail/${series}/topic/one.webp`, previewPath: `/preview/${series}/topic/one.mp4`, jobId: 'job-1', publicationId: 'pub-1', publicationJobCount: 1, sha256: 'a'.repeat(64) }
    write(root, `${series}/index.json`, envelope([{ name: 'topic', file: 'topic.json', count: 1 }], { total: 1, categoryCount: 1 }))
    write(root, `${series}/topic.json`, envelope([item]))
    write(root, `${series}/latest.json`, envelope([item]))
    write(root, `${series}.json`, envelope([item]))
  }
  const item = { date: '2026-11-12', urlbase: '/th?id=OHR.example' }
  write(root, 'bing/index.json', { total: 1, years: [{ year: 2026, file: '2026.json', count: 1 }] })
  write(root, 'bing/2026.json', { year: 2026, total: 1, items: [item] })
  write(root, 'bing/latest.json', { total: 1, items: [item] })
  return { images: { 'wallpaper/video/topic/one.mp4': { jobId: 'job-1', publicationId: 'pub-1', publicationJobCount: 1, sha256: 'a'.repeat(64) } } }
}

describe('部署快照完整性', () => {
  it('五系列索引、分类、全量、latest和publication均完整时验收通过', () => {
    const root = fixture()
    const metadata = snapshot(root)
    expect(validateDeploymentSnapshot(root, { publicationId: 'pub-1', videoMetadata: metadata }).totals).toEqual({ desktop: 1, mobile: 1, avatar: 1, video: 1, bing: 1 })
  })
  it.each(['video/topic.json', 'bing/2026.json', 'avatar.json'])('缺少%s时失败，禁止以残缺数据继续部署', missing => {
    const root = fixture()
    snapshot(root)
    fs.unlinkSync(path.join(root, missing))
    expect(() => validateDeploymentSnapshot(root)).toThrow()
  })
  it('分类计数、索引引用越界或publication漏项会失败', () => {
    const root = fixture()
    const metadata = snapshot(root)
    write(root, 'video/index.json', envelope([{ name: 'topic', file: '../outside.json', count: 1 }], { total: 1 }))
    expect(() => validateDeploymentSnapshot(root)).toThrow(/路径|引用/)
    snapshot(root)
    metadata.images['wallpaper/video/topic/one.mp4'].publicationJobCount = 2
    expect(() => validateDeploymentSnapshot(root, { publicationId: 'pub-1', videoMetadata: metadata })).toThrow(/发布|publication/)
  })
  it('元数据存在但完整视频数据遗漏对应任务时失败', () => {
    const root = fixture()
    const metadata = snapshot(root)
    for (const name of ['video/topic.json', 'video/latest.json', 'video.json']) write(root, name, envelope([]))
    write(root, 'video/index.json', envelope([{ name: 'topic', file: 'topic.json', count: 0 }], { total: 0, categoryCount: 1 }))
    expect(() => validateDeploymentSnapshot(root, { publicationId: 'pub-1', videoMetadata: metadata })).toThrow(/发布|publication/)
  })
  it('保留既有Bing历史资源字段，不把完整性校验变成静默历史数据清理', () => {
    const root = fixture()
    snapshot(root)
    const legacy = { date: '2019-11-03', urlbase: '1920x1080.jpg' }
    write(root, 'bing/index.json', { total: 1, years: [{ year: 2019, file: '2019.json', count: 1 }] })
    write(root, 'bing/2019.json', { total: 1, items: [legacy] })
    write(root, 'bing/latest.json', { total: 1, items: [legacy] })
    expect(validateDeploymentSnapshot(root).totals.bing).toBe(1)
  })
  it('同身份分类记录和完整数据内容不一致时拒绝，防止旧预览路径进入资产库', () => {
    const root = fixture()
    snapshot(root)
    const data = JSON.parse(fs.readFileSync(path.join(root, 'video/topic.json')))
    const records = JSON.parse((awaitDecode(data.blob)))
    records[0].previewPath = '/preview/video/topic/stale.mp4'
    records[0].displayTitle = '旧标题'
    write(root, 'video/topic.json', envelope(records))
    expect(() => validateDeploymentSnapshot(root)).toThrow(/内容|记录/)
  })
  it('latest记录不能沿用旧审核内容，即使路径身份一致', () => {
    const root = fixture()
    snapshot(root)
    const data = JSON.parse(fs.readFileSync(path.join(root, 'video/latest.json')))
    const records = JSON.parse(awaitDecode(data.blob))
    records[0].description = '过时描述'
    write(root, 'video/latest.json', envelope(records))
    expect(() => validateDeploymentSnapshot(root)).toThrow(/内容|记录/)
  })
})

describe('部署数据缓存版本', () => {
  it('实际数据SHA独立于静态CDN tag，并用于所有数据请求', async () => {
    vi.stubEnv('VITE_DATA_REVISION', 'b'.repeat(40))
    const constants = await import('../src/utils/config/constants.js')
    expect(constants.DATA_CACHE_BUSTER).toBe(`?v=${'b'.repeat(40)}`)
    expect(constants.CDN_VERSION).toMatch(/^v\d+\.\d+\.\d+/)
    expect(constants.SERIES_CONFIG.video.indexUrl).toContain('b'.repeat(40))
  })
})

describe('部署资产同步控制', () => {
  it('视频发布只upsert，不查询既有资产也不执行removed', async () => {
    const root = fixture()
    snapshot(root)
    const writes = []
    const client = { from: table => ({ upsert: async batch => { writes.push({ table, batch }); return {} }, select: () => { throw new Error('must not query removal keys') }, update: () => { throw new Error('must not remove') } }) }
    const result = await syncWallpaperAssets({ supabase: client, dataDir: root, removalPolicy: 'upsert-only' })
    expect(result.active).toBe(5)
    expect(result.removed).toBe(0)
    expect(writes.flatMap(item => item.batch)).toHaveLength(5)
  })
  it('快照缺失时任何外部资产写入前失败', async () => {
    const root = fixture()
    snapshot(root)
    fs.unlinkSync(path.join(root, 'video/topic.json'))
    const from = vi.fn()
    await expect(syncWallpaperAssets({ supabase: { from }, dataDir: root, removalPolicy: 'mark-missing' })).rejects.toThrow()
    expect(from).not.toHaveBeenCalled()
  })
})

describe('真实Pages部署关联', () => {
  it('只接受与本次commit标记、branch、production和成功状态完全匹配的部署', async () => {
    const run = { id: 'pages-own', environment: 'production', deployment_trigger: { metadata: { branch: 'main', commit_hash: 'f'.repeat(40), commit_message: 'gallery-data:revision:run:42:attempt:1' } }, latest_stage: { name: 'deploy', status: 'success' } }
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ success: true, result: [{ ...run, id: 'unrelated-latest', deployment_trigger: { metadata: { branch: 'main', commit_hash: 'e'.repeat(40) } } }, run] }) }))
    expect((await resolvePagesDeployment({ accountId: 'account', projectName: 'gallery', token: 'token', marker: run.deployment_trigger.metadata.commit_message, frontendSha: 'f'.repeat(40), fetchImpl, timeoutMs: 10 })).id).toBe('pages-own')
  })
  it('错配或失败部署不会生成publication成功artifact', async () => {
    const root = fixture()
    expect(() => writePublicationResult({ publicationId: 'pub-1', minimumDataRef: 'a'.repeat(40), dataSha: 'b'.repeat(40), pagesDeployment: { id: 'other', latest_stage: { status: 'failure' } }, marker: 'd'.repeat(40), outputDir: root })).toThrow()
    expect(fs.existsSync(path.join(root, 'publication-result.json'))).toBe(false)
  })
})

function githubFixture(root, { comparison = 'ahead', omit = '', corruptBingCopy = false } = {}) {
  const files = new Map()
  function walk(directory, relative = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const name = path.posix.join(relative, entry.name)
      if (entry.isDirectory()) walk(path.join(directory, entry.name), name)
      else if (name !== omit) files.set(name.startsWith('bing/') ? `bing/meta/${name.slice(5)}` : `data/${name}`, fs.readFileSync(path.join(directory, entry.name)))
    }
  }
  walk(root)
  files.set('metadata/video.json', Buffer.from(JSON.stringify({ images: { 'wallpaper/video/topic/one.mp4': { jobId: 'job-1', publicationId: 'pub-1', publicationJobCount: 1, sha256: 'a'.repeat(64) } } })))
  if (corruptBingCopy) files.set('data/bing/index.json', Buffer.from('{"total":0}'))
  const blobs = new Map()
  const tree = []
  for (const [name, bytes] of files) {
    const sha = crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
    tree.push({ type: 'blob', path: name, sha })
    blobs.set(sha, { encoding: 'base64', content: bytes.toString('base64') })
  }
  tree.push({ type: 'blob', path: 'wallpaper/video/private-large.mp4', sha: 'never-download-media' })
  const requested = []
  const fetchImpl = vi.fn(async (url) => {
    const route = new URL(url).pathname.replace('/repos/owner/pictures', '')
    requested.push(route)
    let value
    if (route === '/git/ref/heads/main') value = { object: { sha: 'c'.repeat(40) } }
    else if (route.startsWith('/compare/')) value = { status: comparison }
    else if (route === `/git/commits/${'c'.repeat(40)}`) value = { tree: { sha: 'tree-sha' } }
    else if (route === '/git/trees/tree-sha') value = { tree }
    else if (route === '/tags') value = [{ name: 'v1.5.7' }]
    else if (route.startsWith('/git/blobs/')) value = blobs.get(route.slice('/git/blobs/'.length))
    if (!value) throw new Error(`Unexpected snapshot request ${route}`)
    return { ok: true, json: async () => value }
  })
  return { fetchImpl, requested }
}

describe('固定HEAD数据准备', () => {
  it('只下载数据对象并以Bing权威源覆盖旧副本，干净替换旧public/data', async () => {
    const root = fixture()
    snapshot(root)
    const output = fixture()
    write(output, 'stale-category.json', { mustDisappear: true })
    const github = githubFixture(root, { corruptBingCopy: true })
    const result = await prepareDeploymentData({ repository: 'owner/pictures', outputDir: output, publicationId: 'pub-1', minimumDataRef: 'a'.repeat(40), frontendSha: 'f'.repeat(40), runId: '42', runAttempt: '1', fetchImpl: github.fetchImpl })
    expect(result.dataSha).toBe('c'.repeat(40))
    expect(result.cdnVersion).toBe('v1.5.7')
    expect(result.marker).toContain(`gallery-data:${'c'.repeat(40)}:run:42:attempt:1`)
    expect(fs.existsSync(path.join(output, 'stale-category.json'))).toBe(false)
    expect(validateDeploymentSnapshot(output).totals.bing).toBe(1)
    expect(github.requested).not.toContain('/git/blobs/never-download-media')
  })
  it('引用文件缺失时保留既有输出，不执行网络同步回退', async () => {
    const root = fixture()
    snapshot(root)
    const output = fixture()
    write(output, 'previous.json', { keep: true })
    const github = githubFixture(root, { omit: 'video/topic.json' })
    await expect(prepareDeploymentData({ repository: 'owner/pictures', outputDir: output, fetchImpl: github.fetchImpl })).rejects.toThrow(/缺少/)
    expect(JSON.parse(fs.readFileSync(path.join(output, 'previous.json')))).toEqual({ keep: true })
    expect(fs.readdirSync(output)).toEqual(['previous.json'])
  })
  it('最新HEAD不含最低发布commit时拒绝下载和本地覆盖', async () => {
    const root = fixture()
    snapshot(root)
    const github = githubFixture(root, { comparison: 'behind' })
    await expect(prepareDeploymentData({ repository: 'owner/pictures', publicationId: 'pub-1', minimumDataRef: 'a'.repeat(40), outputDir: fixture(), fetchImpl: github.fetchImpl })).rejects.toThrow(/minimum_data_ref/)
    expect(github.requested.some(route => route.startsWith('/git/blobs/'))).toBe(false)
  })
})

describe('真实Pages结果落盘', () => {
  it('验收成功才写实际数据SHA和真实Pages ID', () => {
    const root = fixture()
    const deployment = { id: 'pages-own-id', environment: 'production', deployment_trigger: { metadata: { branch: 'main', commit_hash: 'f'.repeat(40), commit_message: 'unique-marker' } }, latest_stage: { name: 'deploy', status: 'success' } }
    const result = writePublicationResult({ publicationId: 'pub-1', minimumDataRef: 'a'.repeat(40), dataSha: 'b'.repeat(40), pagesDeployment: deployment, marker: 'unique-marker', frontendSha: 'f'.repeat(40), outputDir: root })
    expect(result).toEqual({ publicationId: 'pub-1', minimumDataRef: 'a'.repeat(40), dataSha: 'b'.repeat(40), pagesDeploymentId: 'pages-own-id' })
    expect(JSON.parse(fs.readFileSync(path.join(root, 'publication-result.json')))).toEqual(result)
  })
})

describe('部署工作流边界', () => {
  it('所有部署排队，拿执行权后checkout最新main，构建成功再upsert和发布', () => {
    const source = fs.readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')
    expect(source).toMatch(/queue: max/)
    expect(source).toMatch(/cancel-in-progress: false/)
    expect(source).toMatch(/ref: main/)
    expect(source).toContain('minimum_data_ref:')
    expect(source).toContain('VITE_DATA_REVISION:')
    expect(source).not.toContain('pnpm sync\n')
    expect(source.indexOf('- name: Build')).toBeLessThan(source.indexOf('- name: Sync wallpaper assets'))
    expect(source).toContain("inputs.publication_id && 'upsert-only' || 'mark-missing'")
    expect(source).toContain('video-publication-result')
  })
})
