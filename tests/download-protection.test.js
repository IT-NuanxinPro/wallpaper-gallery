import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleDownloadPermit } from '../server/download-permit.js'
import { issueDownloadTicket, verifyDownloadTicket } from '../workers/download-guard/tickets.js'
import { handleDownloadFile } from '../server/download-file.js'
import { buildWallpaperDetailRecord } from '../src/utils/wallpaper/detailRecords.js'
import { checkDownloadRequest } from '../workers/download-guard/index.js'
import { authorizeWallpaperDownload } from '../src/services/downloadProtectionService.js'
import { downloadChallenge, requestDownloadChallenge, settleDownloadChallenge } from '../src/services/downloadVerification.js'
import { encodeWallpaperShareToken } from '../src/utils/wallpaper/share.js'

const wallpaper = { path: '/wallpaper/desktop/a.jpg', filename: 'a.jpg', _series: 'desktop' }
const resource = encodeWallpaperShareToken('desktop:path:/wallpaper/desktop/a.jpg')
const siteKey = '1x00000000000000000000AA'
const post = (body = {resource}, headers = {}) => new Request('https://wallpaper.061129.xyz/api/download-permit', { method: 'POST', headers: {'Content-Type':'application/json', Origin:'https://wallpaper.061129.xyz', 'CF-Connecting-IP':'203.0.113.5', ...headers}, body:JSON.stringify(body) })
const internal = (body = {}) => new Request('https://download-guard.internal/check', {method:'POST', body:JSON.stringify({ip:'203.0.113.5',hostname:'wallpaper.061129.xyz',resource,challengeToken:'',...body})})
const limiter = success => ({limit:vi.fn(async()=>({success}))})
const environment = () => ({REQUEST_RATE:limiter(true),FREE_DOWNLOADS:limiter(true),MAX_DOWNLOADS:limiter(true),FILE_DOWNLOADS:limiter(true),TURNSTILE_SITE_KEY:siteKey,DOWNLOAD_SIGNING_SECRET:'test-signing-secret-at-least-32-bytes',TURNSTILE_SECRET_KEY:'server-only',DOWNLOAD_HOSTNAMES:'wallpaper.061129.xyz'})
afterEach(()=>{ if(downloadChallenge.value)settleDownloadChallenge(downloadChallenge.value.id);vi.unstubAllEnvs() })

describe('下载入口与限流服务',()=>{
 it('限流只信任边缘IP，不把客户端自报身份或上游地址交给服务',async()=>{
  const guard={fetch:vi.fn(async r=>{const b=await r.json();expect(b).toEqual({ip:'203.0.113.5',hostname:'wallpaper.061129.xyz',resource,challengeToken:''});return Response.json({code:'allowed',ticket:'test.signature',downloadUrl:'/api/download-file?ticket=test.signature'})})}
  const r=await handleDownloadPermit(post({resource,ip:'spoof',url:'https://evil.test'}),{DOWNLOAD_GUARD:guard})
  expect(r.status).toBe(200);expect(r.headers.get('Cache-Control')).toBe('no-store');expect(guard.fetch).toHaveBeenCalledOnce()
 })
 it('未配置服务、跨站、非法身份和超长请求均不能放行',async()=>{
  expect((await handleDownloadPermit(post(),{})).status).toBe(503)
  expect((await handleDownloadPermit(post({resource},{Origin:'https://evil.test'}),{})).status).toBe(403)
  expect((await handleDownloadPermit(post({resource:'bad!'}),{})).status).toBe(400)
  expect((await handleDownloadPermit(post({resource,junk:'a'.repeat(9000)}),{})).status).toBe(400)
 })
 it('低频直接放行，不请求验证码；额度key不存明文IP',async()=>{
  const env=environment(),fetchImpl=vi.fn()
  expect((await checkDownloadRequest(internal(),env,{fetchImpl})).status).toBe(200)
  expect(fetchImpl).not.toHaveBeenCalled();expect(env.MAX_DOWNLOADS.limit).toHaveBeenCalledOnce()
  expect(env.FREE_DOWNLOADS.limit.mock.calls[0][0].key).toMatch(/^[a-f0-9]{64}$/)
 })
 it('超过免验证额度才要求验证，未通过不消耗成功下载额度',async()=>{
  const env=environment();env.FREE_DOWNLOADS=limiter(false)
  const r=await checkDownloadRequest(internal(),env)
  expect(r.status).toBe(403);expect(await r.json()).toEqual({code:'challenge_required',siteKey})
  expect(env.MAX_DOWNLOADS.limit).not.toHaveBeenCalled()
 })
 it.each([{success:false},{success:true,hostname:'evil.test',action:'wallpaper_download'},{success:true,hostname:'wallpaper.061129.xyz',action:'login'}])('验证必须同时匹配success/域名/action：%j',async result=>{
  const env=environment();env.FREE_DOWNLOADS=limiter(false)
  const r=await checkDownloadRequest(internal({challengeToken:'token'}),env,{fetchImpl:async()=>Response.json(result)})
  expect(r.status).toBe(403);expect(env.MAX_DOWNLOADS.limit).not.toHaveBeenCalled()
 })
 it('正确验证码经服务端校验后仍受硬额度约束',async()=>{
  const env=environment();env.FREE_DOWNLOADS=limiter(false);env.MAX_DOWNLOADS=limiter(false)
  const fetchImpl=vi.fn(async(_url,options)=>{expect(JSON.parse(options.body)).toMatchObject({secret:'server-only',response:'token'});return Response.json({success:true,hostname:'wallpaper.061129.xyz',action:'wallpaper_download'})})
  const r=await checkDownloadRequest(internal({challengeToken:'token'}),env,{fetchImpl})
  expect(r.status).toBe(429);expect(r.headers.get('Retry-After')).toBe('60')
 })
 it('请求洪泛先限流，验证码服务错误返回503且不放行',async()=>{
  const env=environment();env.REQUEST_RATE=limiter(false);const fetchImpl=vi.fn()
  expect((await checkDownloadRequest(internal({challengeToken:'token'}),env,{fetchImpl})).status).toBe(429);expect(fetchImpl).not.toHaveBeenCalled()
  env.REQUEST_RATE=limiter(true);env.FREE_DOWNLOADS=limiter(false)
  expect((await checkDownloadRequest(internal({challengeToken:'token'}),env,{fetchImpl:async()=>{throw Error('network')}})).status).toBe(503)
 })
})

describe('客户端下载授权',()=>{
 it('低频无弹窗，高频挑战通过后重试同一资源',async()=>{
  const challenge=vi.fn(async()=> 'verified'), fetchImpl=vi.fn().mockResolvedValueOnce(Response.json({code:'challenge_required',siteKey},{status:403})).mockResolvedValueOnce(Response.json({code:'allowed',ticket:'test.signature',downloadUrl:'/api/download-file?ticket=test.signature'}))
  await authorizeWallpaperDownload(wallpaper,'desktop',{fetchImpl,challenge})
  expect(challenge).toHaveBeenCalledOnce();expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({resource,challengeToken:'verified'})
 })
 it.each([429,503])('HTTP%s不会自动重试或弹验证绕过',async status=>{
  const fetchImpl=vi.fn(async()=>Response.json({code:'error'},{status})),challenge=vi.fn()
  await expect(authorizeWallpaperDownload(wallpaper,'desktop',{fetchImpl,challenge})).rejects.toThrow(status===429?'60 秒':'暂时不可用')
  expect(fetchImpl).toHaveBeenCalledOnce();expect(challenge).not.toHaveBeenCalled()
 })
 it('取消验证立即清除弹窗，迟到token不污染下一次请求',async()=>{
  const controller=new AbortController();const first=requestDownloadChallenge(siteKey,{signal:controller.signal});const oldId=downloadChallenge.value.id
  const outcome=expect(first).rejects.toMatchObject({name:'AbortError'});controller.abort();await outcome;expect(downloadChallenge.value).toBeNull()
  const second=requestDownloadChallenge(siteKey);const next=downloadChallenge.value.id;settleDownloadChallenge(oldId,'late');expect(downloadChallenge.value.id).toBe(next)
  settleDownloadChallenge(next,'good');await expect(second).resolves.toBe('good')
 })
})


it('下载票据不能伪造、改资源、改IP或过期，下载重放仍受请求额度限制', async () => {
 const secret='test-signing-secret-at-least-32-bytes',now=Date.now()
 const payload={resource,ip:'hashed-ip',hostname:'wallpaper.061129.xyz',expires:now+120000}
 const ticket=await issueDownloadTicket(payload,secret)
 expect(await verifyDownloadTicket(ticket,secret,payload,now)).toMatchObject({resource})
 expect(await verifyDownloadTicket(ticket+'x',secret,payload,now)).toBeNull()
 expect(await verifyDownloadTicket(ticket,secret,{...payload,ip:'another-ip'},now)).toBeNull()
 expect(await verifyDownloadTicket(ticket,secret,payload,now+120001)).toBeNull()
 const env=environment()
 const permit=await checkDownloadRequest(internal(),env)
 const allowed=await permit.json()
 const redeemed=await checkDownloadRequest(new Request('https://download-guard.internal/redeem',{method:'POST',body:JSON.stringify({ip:'203.0.113.5',hostname:'wallpaper.061129.xyz',challengeToken:'',method:'GET',ticket:allowed.ticket})}),env)
 expect(await redeemed.json()).toMatchObject({code:'allowed',resource})
 env.REQUEST_RATE=limiter(false)
 expect((await checkDownloadRequest(internal({ticket:allowed.ticket}),env)).status).toBe(429)
})

it('下载文件端点先验证票据，再从固定详情桶解析上游；拒绝时零回源', async () => {
 const record=buildWallpaperDetailRecord(wallpaper,'v1.5.2')
 const fetchImpl=vi.fn(async()=>new Response('image-bytes',{headers:{'Content-Type':'image/jpeg'}}))
 const env={DOWNLOAD_GUARD:{fetch:vi.fn(async()=>Response.json({code:'allowed',resource}))},ASSETS:{fetch:vi.fn(async()=>Response.json({schema:1,items:{[resource]:record}}))}}
 const request=new Request('https://wallpaper.061129.xyz/api/download-file?ticket=test.signature',{headers:{'CF-Connecting-IP':'203.0.113.5'}})
 const response=await handleDownloadFile(request,env,{fetchImpl})
 expect(response.status).toBe(200);expect(response.headers.get('Content-Disposition')).toContain('attachment');expect(await response.text()).toBe('image-bytes')
 expect(fetchImpl.mock.calls[0][0]).toBe(record.downloadUrl)
 env.DOWNLOAD_GUARD.fetch.mockResolvedValue(Response.json({code:'invalid_ticket'},{status:403}));fetchImpl.mockClear()
 expect((await handleDownloadFile(request,env,{fetchImpl})).status).toBe(403);expect(fetchImpl).not.toHaveBeenCalled()
})

it('短时票据重复GET仍检查文件限流，不因有效签名绕过30次额度', async () => {
 const env=environment()
 const permit=await (await checkDownloadRequest(internal(),env)).json()
 env.FILE_DOWNLOADS=limiter(false)
 const request=new Request('https://download-guard.internal/redeem',{method:'POST',body:JSON.stringify({ip:'203.0.113.5',hostname:'wallpaper.061129.xyz',challengeToken:'',method:'GET',ticket:permit.ticket})})
 expect((await checkDownloadRequest(request,env)).status).toBe(429)
 expect(env.FILE_DOWNLOADS.limit).toHaveBeenCalledOnce()
})

it('授权返回外站URL不交给原生下载器', async () => {
 await expect(authorizeWallpaperDownload(wallpaper,'desktop',{fetchImpl:async()=>Response.json({code:'allowed',downloadUrl:'https://evil.test/file'})})).rejects.toThrow('暂时不可用')
})


it('Pages路由明确执行两个下载Function，不覆盖搜索和预览页面', () => {
 const routes=JSON.parse(readFileSync(new URL('../public/_routes.json',import.meta.url),'utf8'))
 expect(routes.include).toContain('/api/download-permit')
 expect(routes.include).toContain('/api/download-file')
 expect(routes.include).not.toContain('/*')
})
