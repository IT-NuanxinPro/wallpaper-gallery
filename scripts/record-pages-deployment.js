#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

function matchesDeployment(deployment, marker, frontendSha) {
  const metadata = deployment?.deployment_trigger?.metadata
  return deployment?.environment === 'production' && metadata?.branch === 'main' && metadata.commit_message === marker && metadata.commit_hash === frontendSha
}

export async function resolvePagesDeployment({ accountId, projectName, token, marker, frontendSha, fetchImpl = fetch, timeoutMs = 300000, pollMs = 10000, sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)) } = {}) {
  if (!accountId || !projectName || !token || !marker || !/^[a-f0-9]{40}$/.test(frontendSha || ''))
    throw new Error('缺少准确关联Pages部署所需的配置')
  const deadline = Date.now() + timeoutMs
  while (Date.now() <= deadline) {
    const response = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}/deployments?env=production&per_page=25`, { headers: { Authorization: `Bearer ${token}` } })
    const body = await response.json()
    if (!response.ok || !body.success || !Array.isArray(body.result))
      throw new Error(`读取Cloudflare部署结果失败（HTTP ${response.status}）`)
    const matching = body.result.filter(item => matchesDeployment(item, marker, frontendSha))
    if (matching.length > 1)
      throw new Error('发现多个同标识Pages部署，拒绝猜测真实部署ID')
    if (matching.length === 1) {
      const deployment = matching[0]
      if (deployment.latest_stage?.name === 'deploy' && deployment.latest_stage.status === 'success' && deployment.id)
        return deployment
      if (['failure', 'canceled', 'cancelled'].includes(deployment.latest_stage?.status))
        throw new Error('本次Pages部署未成功')
    }
    if (Date.now() >= deadline)
      break
    await sleep(Math.min(pollMs, deadline - Date.now()))
  }
  throw new Error('尚未找到与本次前端、数据和Actions运行完全匹配的成功Pages部署')
}

export function writePublicationResult({ publicationId, minimumDataRef, dataSha, pagesDeployment, marker, frontendSha, outputDir = '.deployment/result' } = {}) {
  if (!/^[A-Z0-9-]{1,100}$/i.test(publicationId || '') || !/^[a-f0-9]{40}$/.test(minimumDataRef || '') || !/^[a-f0-9]{40}$/.test(dataSha || '') || !matchesDeployment(pagesDeployment, marker, frontendSha) || pagesDeployment.latest_stage?.name !== 'deploy' || pagesDeployment.latest_stage.status !== 'success' || !/^[\w-]{1,100}$/.test(pagesDeployment.id || ''))
    throw new Error('Pages发布结果无效或与本次数据快照不匹配')
  const result = { publicationId, minimumDataRef, dataSha, pagesDeploymentId: pagesDeployment.id }
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, 'publication-result.json'), `${JSON.stringify(result, null, 2)}\n`)
  return result
}

async function main() {
  const snapshot = JSON.parse(fs.readFileSync('.deployment/snapshot.json', 'utf8'))
  const deployment = await resolvePagesDeployment({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID, projectName: process.env.PAGES_PROJECT_NAME || 'wallpaper-gallery-prod', token: process.env.CLOUDFLARE_API_TOKEN, marker: snapshot.marker, frontendSha: snapshot.frontendSha })
  if (snapshot.publicationId)
    writePublicationResult({ ...snapshot, pagesDeployment: deployment })
  if (process.env.GITHUB_OUTPUT)
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `pages_deployment_id=${deployment.id}\n`)
  console.log(`Pages部署已精确验收：${deployment.id}，data=${snapshot.dataSha}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
