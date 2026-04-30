# 🚀 Fork 部署指南 (Cloudflare Pages 托管版)

本文档为想要 Fork 本项目的开发者提供完整的配置指南。本项目采用 **GitHub Actions (高性能构建)** + **Cloudflare Pages (全球 CDN 托管)** 的混合方案，彻底解决了单页应用（SPA）在 SEO 和路由上的痛点。

---

## 📋 目录

1. [快速开始](#1-快速开始)
2. [GitHub Secrets 配置 (核心)](#2-github-secrets-配置-核心)
3. [Cloudflare Pages 设置](#3-cloudflare-pages-设置)
4. [Supabase 登录、用户系统与统计 (可选)](#4-supabase-登录用户系统与统计-可选)
5. [常见问题](#5-常见问题)

---

## 1. 快速开始

### 1.1 Fork 项目
点击 GitHub 页面右上角的 **Fork** 按钮，将项目克隆到你的账户。

### 1.2 本地运行
```bash
git clone https://github.com/你的用户名/wallpaper-gallery.git
cd wallpaper-gallery
pnpm install
pnpm dev # 本地开发模式
```

### 1.3 核心架构说明
*   **构建端 (GitHub Actions)**：利用 GitHub 的高性能服务器，自动克隆巨大的图床仓库、同步 JSON 数据并执行生产环境打包。
*   **托管端 (Cloudflare Pages)**：仅作为静态文件服务器，通过全球 CDN 分发，并识别 `_redirects` 文件以支持 200 状态码路由，完美适配 Google/百度收录。

### 1.4 Fork 后不会自动继承的内容
Fork 只会复制仓库代码，不会复制你原仓库或上游仓库里的以下配置：

- GitHub Actions Secrets
- 本地 `.env.local`
- Cloudflare Pages 项目设置
- Supabase 项目、Auth Providers 与 URL 配置

这意味着：

- 只想浏览壁纸时，Fork 后补齐部署配置即可。
- 想启用登录、个人中心、喜欢 / 收藏、下载历史与统计时，需要在你自己的 Supabase 项目里重新配置。

---

## 2. GitHub Secrets 配置 (核心)

为了让 GitHub Actions 能够自动将打包好的文件推送到你的 Cloudflare，必须配置以下 Secrets。

**操作路径**：GitHub 仓库 -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**。

| Secret 名称 | 必需 | 说明 | 获取方式 |
| :--- | :---: | :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | **是** | Cloudflare 身份令牌 | [个人资料] -> [API 令牌] -> [创建自定义令牌] -> 给予 **Pages:编辑** 权限 |
| `CLOUDFLARE_ACCOUNT_ID` | **是** | 账户唯一标识 | Cloudflare 控制台 -> [概述] -> 右侧栏 [账户 ID] |
| `VITE_SUPABASE_URL` | 否 | Supabase 项目地址 | 用于启用登录、个人中心、喜欢 / 收藏与统计能力 |
| `VITE_SUPABASE_ANON_KEY` | 否 | Supabase 匿名 Key | 用于启用登录、个人中心、喜欢 / 收藏与统计能力 |
| `SUPABASE_SERVICE_ROLE_KEY` | 否 | Supabase 服务端密钥 | 用于工作流执行 `pnpm sync:assets`，同步 `wallpaper_assets` |

如果你保留仓库默认的 [`deploy.yml`](../.github/workflows/deploy.yml)，并且希望工作流继续执行 `pnpm sync:assets`，就必须额外配置：

- `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

补充说明：

- `pnpm sync:assets` 会把当前 `public/data` 中解析出的所有系列资产全量写入远端 `wallpaper_assets`
- 它适合在 CI 中配合最新图床数据执行，不适合拿本地过期数据直接同步线上
- 如果你只想核对远端状态，请优先做只读查询，而不是先跑同步

---

## 3. Cloudflare Pages 设置

### 3.1 创建 Pages 项目
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 进入 **Workers 和 Pages** -> **创建** -> **Pages** -> **连接到 Git**。
3. 关联你的仓库，项目名称建议设置为 `wallpaper-gallery-prod`（**需与 deploy.yml 中的 projectName 保持一致**）。

### 3.2 禁用自动构建 (重要步骤)
由于我们使用 GitHub Actions 主动推送产物，必须关闭 Cloudflare 的自动检测，否则会造成重复构建且速度极慢。
1. 在 Cloudflare 项目页点击 **设置** -> **构建与部署**。
2. 在 **分支控制** 处点击“编辑”。
3. **取消勾选** “启用自动生产分支部署”。
4. 在 **预览分支** 处选择 “无（禁用自动分支部署）”。

---

## 4. Supabase 登录、用户系统与统计 (可选)

如果你只需要一个可浏览的静态壁纸站，可以不接 Supabase。

如果你希望启用以下能力，就需要自己创建并配置 Supabase：

- 登录 / 注册 / 邮箱登录
- GitHub、Google、Linux.do OAuth
- 个人中心
- 喜欢、收藏夹、下载历史
- 浏览量 / 下载量统计

### 4.1 创建 Supabase 项目

1. 登录 [Supabase](https://supabase.com/) 并创建新项目。
2. 在项目设置中记录以下值：
   - `Project URL`
   - `anon public key`
   - `service_role key`
3. 将它们分别填到：
   - GitHub Actions Secrets
   - 本地 `.env.local`

### 4.2 配置本地环境变量

可直接参考 [`.env.example`](../.env.example)。

本地开发至少建议配置：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

如果你本地要执行 `pnpm sync:assets`，还需要：

- `SUPABASE_SERVICE_ROLE_KEY`

### 4.3 配置 Supabase Auth URL

由于前端会把 OAuth 和邮箱验证统一回跳到 `/auth/callback`，你需要在 Supabase 后台补齐 URL 配置。

推荐至少添加：

- `Site URL`：你的线上站点根地址，例如 `https://your-project.pages.dev`
- `Redirect URL`：`https://your-project.pages.dev/auth/callback`
- 本地开发地址：`http://localhost:5173/auth/callback`

如果你有自定义域名，也要把自定义域名对应的 `/auth/callback` 一并加入允许列表。

### 4.4 启用登录方式

在 Supabase 控制台的 `Authentication -> Providers` 中，按需开启：

- `Email`
- `GitHub`
- `Google`
- `Linux.do`（如果你要接这个 Provider）

如果你希望支持账号中心里的“绑定 / 解绑第三方账号”，还需要在 Auth Providers 中打开：

- `Enable Manual Linking`

### 4.5 执行 SQL 脚本

新建 Supabase 项目时，建议按下面顺序执行：

1. [scripts/supabase-init.sql](../scripts/supabase-init.sql)
2. [scripts/supabase-user-system.sql](../scripts/supabase-user-system.sql)

原因：

- `supabase-init.sql` 负责初始化匿名统计表、RPC 与热门统计查询。
- `supabase-user-system.sql` 负责创建 `profiles`、`user_preferences`、`user_wallpaper_likes`、`user_collections`、`user_download_history`、`wallpaper_assets`，并补齐 Auth 触发器与现有 `image_stats` 的兼容修复。

如果你的 Supabase 项目已经是旧版本结构，建议重新检查 `wallpaper_assets` 是否至少满足以下条件：

- `series` 约束包含 `video`
- 存在 `duration_seconds` 字段
- `image_stats` 唯一键已升级为 `(series, image_id)`

这些字段与约束缺失时，动态壁纸的 `wallpaper_assets` 同步会失败。

如果你是从只做统计的旧项目升级过来，再根据现状按需使用：

- [scripts/supabase-migration.sql](../scripts/supabase-migration.sql)
- [scripts/supabase-linuxdo-support.sql](../scripts/supabase-linuxdo-support.sql)

时间字段说明：

- 表里继续使用 `TIMESTAMPTZ`
- 查询展示北京时间时，推荐使用 `AT TIME ZONE 'Asia/Shanghai'` + `to_char(...)`

详细架构说明请查看 [Supabase统计系统.md](./Supabase统计系统.md)。

<details>
<summary>点击展开 SQL 脚本</summary>

```sql
-- 直接复制 scripts/supabase-init.sql 全部内容到 Supabase SQL Editor 执行
```
</details>

---

## 5. 常见问题

### Q: 部署成功了，但页面没有任何图片数据？
**A:** 请检查 GitHub Actions 的运行日志。重点查看 `Copy data from image repository` 这一步是否报错。如果克隆图床仓库失败，`public/data` 目录将为空，导致网站无数据。

### Q: 刷新页面出现 404 错误？
**A:** 请确保 `public/_redirects` 文件存在于你的仓库中。GitHub Actions 构建完成后，该文件应出现在 `dist` 根目录下，Cloudflare 才会识别并启用 200 状态码重定向。

### Q: 部署显示 "Authentication error" (403)？
**A:** 请检查 `CLOUDFLARE_API_TOKEN`。确保它拥有 **“账户”级别** 的 `Cloudflare Pages:编辑` 权限。不要使用“区域”令牌，Pages 部署属于账户级操作。

### Q: 为什么我 Fork 之后看得到“登录”按钮，但点进去提示 Supabase Auth 未配置？
**A:** 这是预期行为。仓库现在默认展示登录入口，但 Fork 不会继承你的 Supabase 配置。你需要自己补齐：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Supabase Auth 的 `Site URL` / `Redirect URL`
- 对应的 Auth Providers 和 SQL 脚本
