# Fork 部署指南

校对日期：2026-11-11，适用网站 v5.5.0 工作区。部署方式为 GitHub Actions 构建、Cloudflare Pages 托管静态文件与 Functions。Fork 不会继承 Secrets、数据库、OAuth 或域名配置。

## 本地启动

使用 Node.js 22、pnpm 9：

```sh
git clone https://github.com/你的用户名/wallpaper-gallery.git
cd "wallpaper-gallery"
pnpm install --frozen-lockfile
pnpm dev
```

需要更新数据时执行 `pnpm sync`，它从图床 GitHub Raw 拉取普通系列及 Bing 元数据并更新详情。已有 `public/data` 可用于本地启动，媒体仍需访问对应图源。

## 选择部署范围

| 范围 | 需要的配置 |
| --- | --- |
| 浏览、搜索、预览、分享详情 | Pages 项目、Functions、图源与站点域名 |
| 登录、喜欢、收藏、实时统计 | 加上自己的 Supabase 项目、完整当前结构和 Auth 配置 |
| 默认自动部署全部步骤 | 加上资源同步的 service role 及统计导出配置 |
| 桌面安装包 | 另行维护 Pake 仓库、桌面桥接配置和构建权限 |

默认 [deploy.yml](../.github/workflows/deploy.yml) 会执行 `sync:assets`、统计导出和热门标签导出；Supabase 并非该工作流的可省略配置。若只部署浏览站，应在自己的 Fork 明确跳过远程资源同步、统计导出及独立统计工作流，保留数据复制和 `pnpm build:seo`。

## Secrets 与环境变量

| 名称 | 使用位置 | 用途 |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions Secret | Pages 发布权限 |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions Secret | Pages 所在账户 |
| `VITE_SUPABASE_URL` | 本地环境、构建及导出 | Supabase 项目地址 |
| `VITE_SUPABASE_ANON_KEY` | 本地环境、构建及导出 | 公开客户端凭据，访问受 RLS/授权限制 |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅维护进程/CI Secret | 全量同步 `wallpaper_assets` |
| `VITE_UMAMI_WEBSITE_ID` | 构建环境 | 可选的网站分析项目 ID |
| `VITE_IMAGE_BASE_URL` / `VITE_IMAGE_PROXY_ENABLED` | 构建环境 | 可选的图片入口配置 |

参考 [.env.example](../.env.example)，同时核对 [.env.production](../.env.production) 中的上游网站分析 ID。每个 Fork 应配置自己的项目，不把访客数据发送给不相关部署。

`VITE_*` 会打包进浏览器，不能承载 service role。仅在 Cloudflare 控制台填写构建变量不会自动传递给 GitHub Actions，需在工作流构建步骤的 `env` 中显式配置。

## Cloudflare Pages

1. 创建 Pages 项目。可以使用直接上传项目由 Actions 发布；如果关联 Git，关闭重复的自动生产/预览构建。
2. 将工作流 `pages deploy dist --project-name=... --branch=main` 的项目名改成自己的。
3. 保留根目录 [functions](../functions)；它需要与 `dist` 一起由支持 Pages Functions 的 Wrangler 流程部署。
4. 构建命令使用 `pnpm build:seo`，生成公共页预渲染和详情桶。
5. 核对 [public/_routes.json](../public/_routes.json)：`/images/*`、`/wallpaper/*`、`/api/desktop-release` 交给 Functions，其余公共页使用预渲染文件。

不能只将 `dist` 当普通静态目录拖拽上传后，就认为详情边缘函数已生效。也不要恢复全局 `/* /index.html 200` 重写，它会破坏不存在页面的真实状态及详情处理。

本地检查生产路由可使用已有 Wrangler：

```sh
pnpm build:seo
wrangler pages dev "dist" --ip 127.0.0.1 --port 8790 --compatibility-date 2026-11-10
```

`pnpm preview` 只验证 Vite 输出与本地图片中间件，不等价于上述 Pages 环境。

## 更换站点和图源

站点域名目前有多处明确约束，不是只改一项环境变量即可换站：

- [share.js](../src/utils/wallpaper/share.js) 的 `WALLPAPER_SITE_ORIGIN`，路由 SEO 和详情 canonical 依赖它。
- [router/index.js](../src/router/index.js)、[index.html](../index.html)、[robots.txt](../public/robots.txt) 中的站点地址；sitemap 由构建重新生成。
- [imageDelivery.js](../src/utils/wallpaper/imageDelivery.js)、[detailRecords.js](../src/utils/wallpaper/detailRecords.js)、[desktopWallpaperService.js](../src/services/desktopWallpaperService.js) 的允许来源与完整资源校验。
- 桌面安装包下载链接、OAuth 桥接、Pake 配置，以及 Cloudflare 自定义域名。
- 工作流中的图床仓库、[sync-data.js](../scripts/sync-data.js) 的 GitHub Raw 地址、[constants.js](../src/utils/config/constants.js) 和图片入口的固定仓库。

只继续引用上游图床时，也需遵守对应媒体授权，见 [版权说明](../COPYRIGHT.md)。不要通过取消来源校验实现任意 URL 代理。

## Supabase 接入

Auth 的 Site URL 使用自己的站点地址，Redirect URLs 包含生产及本地 `/auth/callback`。按实际需求配置 Email、GitHub、Google 或 Linux.do，并核对第三方账号绑定需要的 Manual Linking 设置。

当前前端需要规范资源身份、用户关系、统计事件与分页查询等对象。**旧 `supabase-init.sql` 加 `supabase-user-system.sql` 并不是当前完整数据库的一键安装方案。** 它们仍用于理解基础表与历史演进；统计 v2 迁移需要完整资产映射和配套暂存数据。

新项目应先在测试数据库校验结构、RLS、权限、关系汇总触发器和当前 RPC，再接入正式构建。已有数据库按 [Supabase 系统说明](Supabase统计系统.md) 与 [迁移文档](统计口径与迁移.md) 核对，不能直接重复执行历史迁移。

`pnpm sync:assets` 会批量 upsert 最新资源并将不在当前元数据的资源标记 `removed`；不能用本地过期或不完整数据运行线上同步。

## 工作流与验收

| 工作流 | 触发与作用 |
| --- | --- |
| `deploy.yml` | main 推送、手动、计划任务；同步资源及统计，测试，构建并部署 |
| `export-stats.yml` | 手动/计划任务；完整导出统计与热门标签，提交统计目录 |
| `release-version.yml` | 版本文件/说明变更或手动；用 `gh` 发布网站版本 Release |
| `desktop-release.yml` | 桌面桥接/图标/工作流变更或手动；调用 Pake 构建安装包 |

默认仓库引用上游 Pake 可复用工作流。Fork 需自行配置发布目标和权限；普通网页更新无需触发桌面构建。

上线验收至少核对：首页/系列/专题正常；有效详情返回 200 且有正文、canonical、关键样式；不存在详情返回 404；图片入口返回图片而非 HTML；`version.json` 为本次网站版本；有 Supabase 时再检查登录、计数口径及操作反馈。

Google、百度提交与是否收录是两件事，构建成功和 HTTP 200 不代表搜索平台必然收录。
